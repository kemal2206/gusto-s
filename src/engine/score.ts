/**
 * Bileşik skorlama ve **zincir kuralı** — motorun giriş kapısı.
 *
 *   score(x) = W.aroma·aromaWithDish + W.balance·balanceGain
 *            + W.prior·culinaryPrior + W.role·roleFit + anchorBonus − ceza
 *
 * Zincir kuralı skordan önce gelir: adayın, o ana kadar seçilmiş malzemelerden
 * en az biriyle **gösterilebilir bir bağı** olmak zorunda (kimya / tat / gelenek).
 * Bağsız aday hiç listelenmez — kullanıcı rastgele malzeme görmemeli.
 *
 * Diyet ve alerji ise skorda DEĞİL sert filtrede. Hiçbir ağırlık onları geçemez.
 */

import type {
  DishComponent,
  DishState,
  EngineOptions,
  Ingredient,
  IngredientRole,
  Reason,
  ScoreWeights,
  Suggestion,
  SuggestionLink,
  TasteAxis,
} from './types';
import { clamp01, effectiveAroma } from './affinity';
import {
  ARCHETYPES,
  type AxisWeights,
  type BalanceTarget,
  counterpointTarget,
  dishProfile,
  dishTotalGrams,
  effectiveWeight,
  evaluateBalance,
  optimizeDose,
  overshootPenalty,
  suggestedDose,
} from './balance';
import type { AffinityLookup, PairFacts } from './lookup';

export type PresetId = 'kimyasal' | 'denge' | 'geleneksel';

export interface Preset {
  id: PresetId;
  labelTr: string;
  description: string;
  weights: ScoreWeights;
}

/**
 * Üç büyük düğme. Kayar çubuk yok — hedef kullanıcı için 0.42 ile 0.47
 * arasındaki fark anlamsız, seçim yükü ise gerçek.
 */
export const PRESETS: Record<PresetId, Preset> = {
  kimyasal: {
    id: 'kimyasal',
    labelTr: 'Kimyasal uyum',
    description: 'Ortak aroma bileşiği en çok olanlar önce.',
    weights: { aroma: 0.55, balance: 0.2, prior: 0.15, role: 0.1 },
  },
  denge: {
    id: 'denge',
    labelTr: 'Tat dengesi',
    description: 'Tabakta eksik kalan tadı tamamlayanlar önce.',
    weights: { aroma: 0.2, balance: 0.55, prior: 0.15, role: 0.1 },
  },
  geleneksel: {
    id: 'geleneksel',
    labelTr: 'Mutfak geleneği',
    description: 'Türk mutfağında birlikte en sık kullanılanlar önce.',
    weights: { aroma: 0.2, balance: 0.2, prior: 0.5, role: 0.1 },
  },
};

/**
 * Zincir adımlarının varsayılan ağırlıkları.
 *
 * Preset'ler kullanıcının bilinçli tercihi; zincirde ise böyle bir tercih yok,
 * sadece iyi bir yemek isteniyor. Üç sinyal de söz sahibi olmalı: yalnızca
 * dengeye bakınca kuzu etinin yanına kuru nane değil kuru domates çıkıyor,
 * ki bu Türk mutfağı açısından yanlış.
 */
/**
 * Lezzet Lab zincirinin ağırlıkları — **ölçülerek** seçildi.
 *
 * Önceki değerler `aroma 0.30 · denge 0.27 · gelenek 0.33` idi ve denge
 * payı fazla düşüktü: sosun aromatik adımında kremalı bir sosa vanilya,
 * tatlı-ekşi bir sosa dereotu öneriliyordu. Katalog genelinde ölçüldü
 * (`npm run denetim:oneri -- --tara`, 104 ana malzeme × 7 tat hedefi,
 * ana yemek ve sos birlikte, 12.409 öneri):
 *
 *   ağırlık                      hedeften uzaklaştıran   ortalama bağ
 *   0.30 / 0.27 / 0.33  (eski)          %1.40                0.694
 *   0.24 / 0.43 / 0.23                  %1.00                0.686
 *   0.20 / 0.52 / 0.18  (yeni)          %0.71                0.677
 *
 * Karşı ölçüt şarttı: dengeyi tek başına artırmak kimyasal bağı zayıf
 * adayları öne çıkarabilirdi ve Lab'in bütün iddiası "gerekçesiz seçenek
 * göstermemek". Bağ gücü %2,5 düştü — ihmal edilebilir.
 *
 * Gelenek payını 0.33'ten 0.18'e indirmenin motorun mutfak bilgisini
 * zedeleyip zedelemediği ayrıca ölçüldü (`degerlendirme:motor`, birini
 * dışarıda bırak): recall@10 %48,0 → %48,0, yani hiç değişmedi. Yalnızca
 * recall@5 iki puan düştü. Kültürel önsel hâlâ ağın içinde; ağırlığı
 * azalınca kaybolmuyor.
 */
export const CHAIN_WEIGHTS: ScoreWeights = {
  aroma: 0.2,
  balance: 0.52,
  prior: 0.18,
  role: 0.1,
};

export const LINK_DEFAULTS = {
  minAromaLink: 0.12,
  minBalanceLink: 0.05,
  minPriorLink: 0.25,
} as const;

export const DEFAULT_OPTIONS: EngineOptions = {
  mode: 'benzerlik',
  weights: PRESETS.denge.weights,
  requireLink: true,
  limit: 12,
};

/**
 * Tutarlılık primi.
 *
 * Tek bir malzemeye bağlı olmak yetmez. Uskumrunun yanına salatalık,
 * "ikisi bir bileşik paylaşıyor" diye gelirse tabak dağılıyor. Bu prim,
 * tabaktaki malzemelerin ÇOĞUYLA bağlı olan adayı öne çıkarıyor.
 */
const COHERENCE_BONUS = 0.18;

/** Uyum tablosunun "geri plan" kademesinin skor cezası. */
const DEMOTE_PENALTY = 0.22;

/**
 * Akrabalık cezası — aynı şeyin ikinci hâli.
 *
 * Taze nane ile kuru nane neredeyse aynı bileşik setine sahip, motor ikisini de
 * mükemmel eşleşme sanıyor. Sert filtre yerine ağır ceza: limon + limon kabuğu
 * gibi gerçekten birlikte kullanılan çiftler yine de listeye girebilsin.
 */
const KIN_PENALTY = 0.45;

/**
 * Arketip seçilmediyse denge hesaplanamaz. O ağırlığı boşa harcamak yerine
 * kalan terimlere paylaştırıyoruz.
 */
function normalizeWeights(w: ScoreWeights, hasArchetype: boolean): ScoreWeights {
  const base = hasArchetype ? w : { ...w, balance: 0 };
  const total = base.aroma + base.balance + base.prior + base.role;
  if (total <= 0) return { aroma: 1, balance: 0, prior: 0, role: 0 };
  return {
    aroma: base.aroma / total,
    balance: base.balance / total,
    prior: base.prior / total,
    role: base.role / total,
  };
}

const FOCUS_WEIGHT = 4;

/**
 * Odak eksenleri ağırlığa çevirir. Odaklanılmayan eksen 0 değil 1:
 * "tatlı-ekşi dengesi" derken tuzu tamamen yok saymak da yanlış olur.
 */
function buildAxisWeights(focusAxes?: TasteAxis[]): AxisWeights | undefined {
  if (!focusAxes?.length) return undefined;
  const weights: AxisWeights = {};
  for (const axis of focusAxes) weights[axis] = FOCUS_WEIGHT;
  return weights;
}

interface Relation {
  aroma: number;
  prior: number;
  perComponent: { component: DishComponent; facts: PairFacts }[];
  strongest?: { name: string; facts: PairFacts };
}

/**
 * Adayın tabakla ilişkisi.
 *
 * `0.6·max + 0.4·ağırlıklı ortalama`: aşçı gibi düşünüyoruz — bir malzemenin
 * ana malzemeyle güçlü bağı olması, her şeye ortalama uyumundan değerlidir.
 * Ama ortalama da sıfırlanmıyor, yoksa kalanla çatışan şeyler geçer.
 */
function relationToDish(
  dish: DishState,
  candidate: Ingredient,
  lookup: AffinityLookup,
): Relation {
  const related = [...dish.components, ...(dish.pairedWith ?? [])];
  if (!related.length) return { aroma: 0, prior: 0, perComponent: [] };

  let maxAroma = 0;
  let maxPrior = 0;
  let sumW = 0;
  let sumAroma = 0;
  let sumPrior = 0;
  let strongest: Relation['strongest'];
  const perComponent: Relation['perComponent'] = [];

  for (const component of related) {
    const facts = lookup.pair(candidate, component.ingredient);
    perComponent.push({ component, facts });

    const w = effectiveWeight(component.grams, component.ingredient.potency);
    const prior = facts.prior ?? 0;

    if (facts.aroma > maxAroma) {
      maxAroma = facts.aroma;
      strongest = { name: component.ingredient.nameTr, facts };
    }
    if (prior > maxPrior) maxPrior = prior;

    sumW += w;
    sumAroma += facts.aroma * w;
    sumPrior += prior * w;
  }

  return {
    aroma: clamp01(0.6 * maxAroma + 0.4 * (sumW > 0 ? sumAroma / sumW : 0)),
    prior: clamp01(0.6 * maxPrior + 0.4 * (sumW > 0 ? sumPrior / sumW : 0)),
    perComponent,
    strongest,
  };
}

/**
 * Zincir bağlarını çıkarır. Boş dizi dönerse aday listelenmez.
 * Sıralama: en güçlü bağ başta, çapa (son seçim) bağı öncelikli.
 */
function buildLinks(
  relation: Relation,
  balanceGain: number,
  opts: EngineOptions,
): { links: SuggestionLink[]; linked: number; total: number } {
  const minAroma = opts.minAromaLink ?? LINK_DEFAULTS.minAromaLink;
  const minPrior = opts.minPriorLink ?? LINK_DEFAULTS.minPriorLink;
  const minBalance = opts.minBalanceLink ?? LINK_DEFAULTS.minBalanceLink;

  const links: SuggestionLink[] = [];
  /** Kaç FARKLI malzemeye bağlandı — tutarlılık bunun üzerinden ölçülüyor. */
  let linked = 0;

  for (const { component, facts } of relation.perComponent) {
    const isAnchor = component.ingredient.id === opts.anchorIngredientId;
    const base = {
      withSlug: component.ingredient.slug,
      withName: component.ingredient.nameTr,
      isAnchor,
    };

    let hasLink = false;

    if (facts.aroma >= minAroma && facts.sharedCount > 0) {
      hasLink = true;
      links.push({
        ...base,
        kind: 'kimya',
        strength: facts.sharedCount,
        compounds: facts.topCompounds,
      });
    }
    if ((facts.prior ?? 0) >= minPrior) {
      hasLink = true;
      links.push({ ...base, kind: 'gelenek', strength: facts.prior! });
    }

    if (hasLink) linked += 1;
  }

  // Tat bağı tek bir malzemeye değil tabağın bütününe.
  if (balanceGain >= minBalance) {
    const anchor = relation.perComponent.find(
      (p) => p.component.ingredient.id === opts.anchorIngredientId,
    );
    links.push({
      kind: 'tat',
      withSlug: anchor?.component.ingredient.slug ?? '',
      withName: anchor?.component.ingredient.nameTr ?? 'tabak',
      strength: balanceGain,
      isAnchor: Boolean(anchor),
    });
  }

  const rank: Record<SuggestionLink['kind'], number> = { kimya: 0, gelenek: 1, tat: 2 };
  links.sort((a, b) => {
    if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
    if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
    return b.strength - a.strength;
  });

  return { links, linked, total: relation.perComponent.length };
}

/** Aday, tabaktaki bir malzemenin başka bir hâli mi? (taze nane ↔ kuru nane) */
function kinClash(dish: DishState, candidate: Ingredient): boolean {
  if (!candidate.kin) return false;
  const all = [...dish.components, ...(dish.pairedWith ?? [])];
  return all.some((c) => c.ingredient.kin === candidate.kin);
}

/** Aday hangi rolde en iyi oturuyor ve o rol tabakta boş mu? */
function roleFit(
  dish: DishState,
  candidate: Ingredient,
  expectedRoles: IngredientRole[] | undefined,
): { fit: number; role: IngredientRole; fillsGap: boolean } {
  const present = new Set(dish.components.map((c) => c.role));
  const candidateRoles = [...new Set<IngredientRole>([candidate.defaultRole, ...candidate.roles])];

  if (!expectedRoles?.length) {
    return { fit: 0.5, role: candidate.defaultRole, fillsGap: false };
  }

  let best = { fit: 0.15, role: candidate.defaultRole, fillsGap: false };

  for (const role of candidateRoles) {
    if (!expectedRoles.includes(role)) continue;
    const fillsGap = !present.has(role);
    const fit = fillsGap ? 1 : 0.45;
    if (fit > best.fit) best = { fit, role, fillsGap };
  }

  return best;
}

function passesHardFilters(candidate: Ingredient, dish: DishState, o: EngineOptions): boolean {
  const used = [...dish.components, ...(dish.pairedWith ?? [])];
  if (used.some((c) => c.ingredient.id === candidate.id)) return false;
  if (o.excludeIngredientIds?.includes(candidate.id)) return false;

  if (o.excludeAllergens?.length) {
    if (candidate.allergenTags.some((t) => o.excludeAllergens!.includes(t))) return false;
  }
  if (o.requireDietTags?.length) {
    if (!o.requireDietTags.every((t) => candidate.dietTags.includes(t))) return false;
  }
  if (o.allowedRoles?.length) {
    const roles = new Set<IngredientRole>([candidate.defaultRole, ...candidate.roles]);
    if (![...roles].some((r) => o.allowedRoles!.includes(r))) return false;
  }
  if (o.allowedCategories?.length && !o.allowedCategories.includes(candidate.category)) {
    return false;
  }
  if (o.cuisines?.length && !candidate.cuisines.some((c) => o.cuisines!.includes(c))) {
    return false;
  }
  return true;
}

/**
 * Tabağa eklenebilecek malzemeleri skorlar ve zincir kuralını uygular.
 *
 * Tipik kullanım (Lezzet Lab zinciri):
 *   1. adım — kullanıcı ana malzemeyi seçer (antrikot)
 *   2. adım — karakter soruları arketipi ve odak eksenlerini belirler
 *   3+ adım — bu fonksiyon her rol için aday üretir, `anchorIngredientId`
 *             son seçime ayarlanır, bağsız adaylar listeden düşer
 */
export function suggestAdditions(
  dish: DishState,
  candidates: Ingredient[],
  lookup: AffinityLookup,
  options: Partial<EngineOptions> = {},
): Suggestion[] {
  const opts: EngineOptions = { ...DEFAULT_OPTIONS, ...options };
  const archetype = dish.archetypeId ? ARCHETYPES[dish.archetypeId] : undefined;
  const w = normalizeWeights(opts.weights, Boolean(archetype));
  const totalGrams = dishTotalGrams(dish);

  // Yanında servis edilen şey hedefi kaydırıyor: yağlı bir etin üzerine giden
  // sos, tek başına tadılacak bir sostan daha ekşi olmalı.
  const spec: BalanceTarget | undefined = archetype
    ? {
        target: dish.pairedWith?.length
          ? counterpointTarget(archetype.target, dishProfile({ components: dish.pairedWith }))
          : archetype.target,
        tolerance: archetype.tolerance,
        axisWeights: buildAxisWeights(opts.focusAxes),
      }
    : undefined;

  const suggestions: Suggestion[] = [];

  for (const candidate of candidates) {
    if (!passesHardFilters(candidate, dish, opts)) continue;

    const relation = relationToDish(dish, candidate, lookup);
    const aromaTerm = effectiveAroma(relation.aroma, relation.prior, opts.mode);

    // Doz sabit oran değil, rolün pratik aralığında hedefe en çok yaklaştıran miktar.
    const dose =
      spec && opts.fixedGrams == null
        ? optimizeDose(dish, spec, candidate, opts.doseBounds)
        : undefined;

    const grams = opts.fixedGrams ?? dose?.grams ?? suggestedDose(candidate, totalGrams);
    const balance =
      dose?.evaluation ??
      (spec && opts.fixedGrams != null
        ? evaluateBalance(dish, spec, candidate, opts.fixedGrams)
        : undefined);
    const balanceTerm = balance?.gain ?? 0;

    // ── ZİNCİR KURALI ─────────────────────────────────────────────
    const { links, linked, total } = buildLinks(relation, balanceTerm, opts);
    if (opts.requireLink !== false && links.length === 0) continue;

    // Tutarlılık: tabaktaki kaç malzemeyle bağlı? Son seçim biraz fazla sayılır,
    // zincirin devamlılığı korunsun diye.
    const anchorLinked = links.some((l) => l.isAnchor);
    const coherence =
      total > 0 ? clamp01((linked + (anchorLinked ? 0.5 : 0)) / (total + 0.5)) : 0;

    const role = roleFit(dish, candidate, archetype?.expectedRoles);

    let penalty = balance ? overshootPenalty(balance) : 0;
    if (relation.aroma < 0.03 && relation.prior <= 0) penalty += 0.25;
    if (kinClash(dish, candidate)) penalty += KIN_PENALTY;

    /**
     * Uyum cezası — korpusta ana malzemenin yemek türünde seyrek görülen
     * malzeme listeden düşmüyor ama öne de çıkmıyor.
     */
    if (opts.demoteIngredientIds?.includes(candidate.id)) penalty += DEMOTE_PENALTY;

    const score = clamp01(
      w.aroma * aromaTerm +
        w.balance * balanceTerm +
        w.prior * relation.prior +
        w.role * role.fit +
        COHERENCE_BONUS * coherence -
        penalty,
    );

    // ── gerekçeler ────────────────────────────────────────────────
    const reasons: Reason[] = [];

    if (opts.mode === 'zitlik' && relation.strongest) {
      reasons.push({ kind: 'zitlik', withName: relation.strongest.name });
    }

    if (balance?.moved.length) {
      const top = balance.moved[0];
      reasons.push({ kind: 'denge', axis: top.axis, from: top.from, to: top.to, target: top.target });
    }

    if (role.fillsGap) reasons.push({ kind: 'rol', role: role.role });

    for (const o of balance?.overshoot ?? []) {
      reasons.push({ kind: 'uyari-fazla', axis: o.axis, value: o.value, limit: o.limit });
    }

    suggestions.push({
      ingredient: candidate,
      score,
      links,
      coherence,
      linkedTo: { linked, total },
      breakdown: {
        aroma: aromaTerm,
        balance: balanceTerm,
        prior: relation.prior,
        role: role.fit,
        penalty,
      },
      suggestedGrams: grams,
      reasons,
    });
  }

  /**
   * Tutarlılık kapısı — gevşetmeli.
   *
   * Önce "tabağın çoğuyla bağlı" adayları alıyoruz. Yeterince aday kalmazsa
   * (zincir uzadıkça bu olabiliyor, özellikle bileşik verisi seyrek olan
   * baharatlarda) kapıyı açıyoruz: boş liste göstermek, zayıf bağlı ama
   * gerekçesi yazılı bir seçenek göstermekten daha kötü.
   */
  const minCoherence = opts.minCoherence ?? 0.5;
  const MIN_POOL = 3;

  const coherent = suggestions.filter((s) => s.coherence >= minCoherence);
  const pool = coherent.length >= MIN_POOL ? coherent : suggestions;

  pool.sort((a, b) => b.score - a.score);
  return pool.slice(0, opts.limit ?? 12);
}
