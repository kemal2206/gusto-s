/**
 * Komple menü kurucu — "bana menü hazırla".
 *
 * Tek tarif seçmekten farkı şu: beş tabak birbirini görmeli. Rastgele bir
 * ara sıcak + rastgele bir ana yemek + rastgele bir tatlı seçmek menü değil,
 * liste olur. Burada ana yemek çapa (anchor) seçiliyor, kalan tabaklar ona
 * göre puanlanıyor:
 *
 *  1. **Köprü** — tabaklar arasında paylaşılan aroma bileşiği var mı
 *     (Ahn 2011 flavor network, `LOOKUP.pair`). Bir güçlü bağ yeter;
 *     "bu tatlı ana yemekle şurada buluşuyor" diyebilmek için.
 *  2. **Karşıtlık** — ana yemek yağlıysa salata ekşi olmalı, acılıysa içecek
 *     serinletmeli. Motorun `counterpointTarget` mantığının menü ölçeği.
 *  3. **Tekrar cezası** — ana yemekte patlıcan varsa mezede de patlıcan
 *     istemiyoruz. Aynı malzeme iki tabakta görünürse ağır ceza.
 *
 * Sonuç deterministik değil ama rastgele de değil: `seed` ile aynı cevaplara
 * farklı menü çıkıyor, böylece "yeniden kur" işe yarıyor.
 */

import { BY_SLUG, LOOKUP } from '@/data/catalog';
import { RECIPES, type Recipe } from '@/data/recipes';
import { ZERO_TASTE, type TasteAxis, type TasteVector } from '@/engine';
import { nutritionOf } from '@/lib/recipe-facts';
import { isAllowed, type ProfileFilter } from '@/lib/profile-filter';

// ── Sorular ────────────────────────────────────────────────────────

export type Occasion = 'misafir' | 'aile' | 'ozel-gun' | 'hafif';
export type CuisineLean = 'turk' | 'ege' | 'guneydogu' | 'uzakdogu' | 'farketmez';
export type MenuMain = 'kirmizi-et' | 'tavuk' | 'balik' | 'sebze';
export type Effort = 'kolay' | 'orta' | 'sinirsiz';
export type Heaviness = 'hafif' | 'dengeli' | 'doyurucu';

export interface MenuAnswers {
  vesile?: Occasion;
  mutfak?: CuisineLean;
  ana?: MenuMain;
  emek?: Effort;
  agirlik?: Heaviness;
  /** Kaç kişilik — porsiyon notu için. */
  kisi?: number;
}

// ── Tabaklar ───────────────────────────────────────────────────────

export type CourseId = 'ara-sicak' | 'ana-yemek' | 'salata-meze' | 'tatli' | 'icecek';

export interface CourseDef {
  id: CourseId;
  labelTr: string;
  /** Bu tabağa hangi tarif kategorileri girebilir. */
  categories: string[];
  /** Tabağın ana yemeğe göre istenen tat yönü. */
  wants: Partial<Record<TasteAxis, number>>;
}

export const COURSES: CourseDef[] = [
  {
    id: 'ara-sicak',
    labelTr: 'Ara sıcak',
    categories: ['hamur-isi'],
    wants: {},
  },
  {
    id: 'ana-yemek',
    labelTr: 'Ana yemek',
    categories: ['etli-sulu', 'kebap-izgara', 'deniz', 'dolma-sarma', 'pilav-makarna', 'zeytinyagli'],
    wants: {},
  },
  {
    id: 'salata-meze',
    labelTr: 'Salata veya meze',
    categories: ['meze-salata', 'zeytinyagli'],
    // Salatanın işi ana yemeğin yağını kesmek: ekşi ve ferah olacak.
    wants: { sour: 0.6, fat: -0.3 },
  },
  {
    id: 'tatli',
    labelTr: 'Tatlı',
    categories: ['tatli'],
    wants: { sweet: 0.5 },
  },
  {
    id: 'icecek',
    labelTr: 'İçecek',
    categories: ['icecek'],
    wants: { sour: 0.4 },
  },
];

// ── Yardımcılar ────────────────────────────────────────────────────

/** Her tarifte bulunan, hiçbir şey anlatmayan temel malzemeler. */
const STAPLES = new Set([
  'su', 'tuz', 'karabiber', 'un', 'seker', 'zeytinyagi', 'aycicek-yagi',
  'sivi-yag', 'tereyagi', 'margarin', 'maya', 'kabartma-tozu', 'karbonat',
  'nisasta', 'misir-unu', 'galeta-unu', 'pudra-sekeri',
]);

const MAIN_SLUGS: Record<MenuMain, { slugs?: string[]; categories?: string[] }> = {
  'kirmizi-et': {
    slugs: ['kuzu-but', 'kuzu-pirzola', 'kuzu-incik', 'kuzu-kiyma', 'dana-antrikot',
            'dana-kusbasi', 'dana-kiyma', 'dana-kaburga', 'kavurma', 'kuzu-cigeri'],
  },
  tavuk: { slugs: ['tavuk-but', 'tavuk-gogsu', 'hindi', 'bildircin'] },
  balik: { categories: ['deniz'] },
  sebze: { categories: ['sebze', 'mantar', 'baklagil'] },
};

/** Mutfak yönelimi → tarifte aranan işaretler. */
const LEAN_SIGNALS: Record<CuisineLean, { cuisine?: string; slugs?: string[]; categories?: string[] }> = {
  turk: { cuisine: 'tr' },
  ege: { slugs: ['zeytinyagi', 'dereotu', 'enginar', 'taze-fasulye', 'limon'], categories: ['zeytinyagli'] },
  guneydogu: { slugs: ['isot', 'pul-biber', 'kimyon', 'nar-eksisi', 'bulgur'] },
  uzakdogu: { cuisine: 'uzakdogu' },
  farketmez: {},
};

const EFFORT_CAP: Record<Effort, number> = { kolay: 45, orta: 90, sinirsiz: Number.POSITIVE_INFINITY };

/** Tarifin karakterini taşıyan malzemeler — gram × etki gücüne göre ilk 4. */
function signatureSlugs(recipe: Recipe): string[] {
  const weights = new Map<string, number>();
  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      if (STAPLES.has(ri.slug)) continue;
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;
      weights.set(ri.slug, (weights.get(ri.slug) ?? 0) + ri.grams * ing.potency);
    }
  }
  return [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([slug]) => slug);
}

/** Tarifin tat profili — malzemelerin ağırlıklı ortalaması. */
function tasteOf(recipe: Recipe): TasteVector {
  const out: TasteVector = { ...ZERO_TASTE };
  let total = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;
      const w = ri.grams * ing.potency;
      total += w;
      for (const axis of Object.keys(out) as TasteAxis[]) out[axis] += ing.taste[axis] * w;
    }
  }

  // Malzeme tatları 0–10 ölçeğinde; menü eşiklerini okunabilir tutmak için 0–1.
  if (total > 0) for (const axis of Object.keys(out) as TasteAxis[]) out[axis] /= total * 10;
  return out;
}

export interface Bridge {
  /** Ana yemekteki malzeme. */
  fromSlug: string;
  /** Bu tabaktaki malzeme. */
  toSlug: string;
  aroma: number;
  /** Paylaşılan bileşiklerden ilki — kullanıcıya gerekçe. */
  compoundTr?: string;
}

/** İki tarif arasındaki en güçlü aroma bağı. */
function strongestBridge(a: Recipe, b: Recipe): Bridge | undefined {
  let best: Bridge | undefined;
  let bestScore = 0;

  for (const sa of signatureSlugs(a)) {
    const ia = BY_SLUG.get(sa);
    if (!ia) continue;
    for (const sb of signatureSlugs(b)) {
      if (sa === sb) continue;
      const ib = BY_SLUG.get(sb);
      if (!ib) continue;
      // Akraba malzemeler köprü sayılmaz: "sarımsak tozu ile sarımsak uyuyor"
      // matematiksel olarak doğru ama sofrada bir şey anlatmıyor.
      if (ia.kin && ia.kin === ib.kin) continue;

      const facts = LOOKUP.pair(ia, ib);
      /**
       * Sessiz malzemeler arasındaki bağı öne çıkarmıyoruz: un ile pirinç
       * teknik olarak eşleşiyor ama kimseye bir şey anlatmıyor. Seçimi
       * aroma gücüyle ağırlıklandırıyoruz, gösterilen skor ham aroma kalıyor.
       */
      const voice = ((ia.aromaPower + ib.aromaPower) / 20) * 0.5 + 0.5;
      const weighted = facts.aroma * voice;
      if (weighted > bestScore) {
        bestScore = weighted;
        best = {
          fromSlug: sa,
          toSlug: sb,
          aroma: facts.aroma,
          compoundTr: facts.topCompounds[0]?.nameTr,
        };
      }
    }
  }
  return best;
}

/** Basit, tekrarlanabilir sözde-rastgele. */
function mulberry(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Puanlama ───────────────────────────────────────────────────────

function leanScore(recipe: Recipe, lean: CuisineLean): number {
  const sig = LEAN_SIGNALS[lean];
  let s = 0;
  if (sig.cuisine && recipe.cuisine === sig.cuisine) s += 2;
  if (sig.categories?.includes(recipe.categoryId)) s += 1.5;
  if (sig.slugs) s += Math.min(2, sig.slugs.filter((x) => recipe.allSlugs.includes(x)).length);
  return s;
}

function mainScore(recipe: Recipe, main: MenuMain | undefined): number {
  if (!main) return 0;
  const rule = MAIN_SLUGS[main];
  if (rule.slugs?.some((s) => recipe.allSlugs.includes(s))) return 6;
  if (rule.categories?.some((c) => recipe.allSlugs.some((s) => BY_SLUG.get(s)?.category === c))) {
    // "Sebze" seçildiyse ette de sebze var — et içeren tarifi saymıyoruz.
    if (main === 'sebze') {
      const hasMeat = recipe.allSlugs.some((s) => {
        const cat = BY_SLUG.get(s)?.category;
        return cat === 'protein' || cat === 'deniz' || cat === 'sarkuteri';
      });
      return hasMeat ? 0 : 5;
    }
    return 5;
  }
  return 0;
}

function heavinessScore(recipe: Recipe, want: Heaviness | undefined): number {
  if (!want) return 0;
  const kcal = nutritionOf(recipe).kcal;
  if (!kcal) return 0;
  if (want === 'hafif') return kcal <= 400 ? 2 : kcal <= 550 ? 0.5 : -2;
  if (want === 'doyurucu') return kcal >= 550 ? 2 : kcal >= 400 ? 0.5 : -1.5;
  return kcal >= 350 && kcal <= 650 ? 1.5 : 0;
}

// ── Sonuç ──────────────────────────────────────────────────────────

export interface MenuCourse {
  course: CourseDef;
  recipe: Recipe;
  /** Ana yemekle bağı — ana yemeğin kendisinde yok. */
  bridge?: Bridge;
  /** Kullanıcıya gösterilecek tek satırlık gerekçe. */
  reasonTr: string;
}

export interface Menu {
  courses: MenuCourse[];
  /** 0–1: tabakların birbirine ne kadar bağlı olduğu. */
  coherence: number;
  totalMinutes: number;
  kcalPerPerson: number;
  servings: number;
  seed: number;
}

export function buildMenu(answers: MenuAnswers, profile: ProfileFilter, seed = 1): Menu | null {
  const rnd = mulberry(seed);
  const cap = EFFORT_CAP[answers.emek ?? 'orta'];
  const lean = answers.mutfak ?? 'farketmez';

  /** Ortak ön eleme: profile uygun, süresi tutan, adımı olan tarifler. */
  const eligible = (categories: string[], timeCap: number) =>
    RECIPES.filter(
      (r) =>
        categories.includes(r.categoryId) &&
        r.totalMinutes <= timeCap &&
        r.components.some((c) => c.steps.length >= 2) &&
        // Reçel, turşu, sos: sofrada var ama "tabak" değil, menüye tek başına konmaz.
        !/reçel|marmelat|turşu|şurup|sos tarifi|salçası/i.test(r.title) &&
        isAllowed(r, profile),
    );

  // ── 1. Ana yemek (çapa) ──────────────────────────────────────────
  const mainDef = COURSES.find((c) => c.id === 'ana-yemek')!;
  // Ana yemeğe biraz daha zaman tanınıyor: menünün ağırlık merkezi o.
  const mainPool = eligible(mainDef.categories, cap === Number.POSITIVE_INFINITY ? cap : cap * 1.5);
  if (!mainPool.length) return null;

  const mainRanked = mainPool
    .map((r) => ({
      r,
      score:
        mainScore(r, answers.ana) +
        leanScore(r, lean) +
        heavinessScore(r, answers.agirlik) +
        (answers.vesile === 'ozel-gun' || answers.vesile === 'misafir' ? (r.difficulty - 1) * 0.8 : 0) +
        (answers.vesile === 'hafif' && r.totalMinutes <= 40 ? 1.5 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  // İlk 12 arasından seçiyoruz: hep aynı menü çıkmasın ama kalite düşmesin.
  const anchor = pick(mainRanked.slice(0, 12), rnd)?.r;
  if (!anchor) return null;

  const anchorTaste = tasteOf(anchor);
  const used = new Set(signatureSlugs(anchor));

  const courses: MenuCourse[] = [
    {
      course: mainDef,
      recipe: anchor,
      reasonTr: reasonForAnchor(anchor, answers),
    },
  ];

  let bridgeSum = 0;
  let bridgeCount = 0;

  // ── 2. Diğer tabaklar ────────────────────────────────────────────
  for (const def of COURSES) {
    if (def.id === 'ana-yemek') continue;

    const pool = eligible(def.categories, cap === Number.POSITIVE_INFINITY ? cap : cap + 15);
    if (!pool.length) continue;

    const ranked = pool
      .map((r) => {
        const sig = signatureSlugs(r);
        const repeat = sig.filter((s) => used.has(s)).length;
        const bridge = strongestBridge(anchor, r);
        const taste = tasteOf(r);

        // Karşıtlık: ana yemeğin fazlasını bu tabak dengeliyor mu?
        let counter = 0;
        for (const [axis, want] of Object.entries(def.wants) as [TasteAxis, number][]) {
          const need = want >= 0 ? anchorTaste.fat + anchorTaste.heat : 1;
          counter += want * taste[axis] * (0.5 + need);
        }

        const score =
          (bridge?.aroma ?? 0) * 3 +
          counter * 2 +
          leanScore(r, lean) * 0.6 +
          heavinessScore(r, answers.agirlik) * 0.4 -
          repeat * 4;

        return { r, score, bridge };
      })
      .sort((a, b) => b.score - a.score);

    const chosen = pick(ranked.slice(0, 8), rnd);
    if (!chosen) continue;

    for (const s of signatureSlugs(chosen.r)) used.add(s);
    if (chosen.bridge) {
      bridgeSum += chosen.bridge.aroma;
      bridgeCount += 1;
    }

    courses.push({
      course: def,
      recipe: chosen.r,
      bridge: chosen.bridge,
      reasonTr: reasonForCourse(def, chosen.r, chosen.bridge, anchorTaste),
    });
  }

  // Servis sırasına diz.
  const order: CourseId[] = ['ara-sicak', 'ana-yemek', 'salata-meze', 'tatli', 'icecek'];
  courses.sort((a, b) => order.indexOf(a.course.id) - order.indexOf(b.course.id));

  const servings = Math.max(1, answers.kisi ?? 4);

  return {
    courses,
    coherence: bridgeCount ? bridgeSum / bridgeCount : 0,
    // Tabaklar sırayla değil kısmen birlikte pişiyor; en uzun tabak + kalanların yarısı.
    totalMinutes: estimateMinutes(courses.map((c) => c.recipe.totalMinutes)),
    kcalPerPerson: Math.round(
      courses.reduce((sum, c) => sum + nutritionOf(c.recipe).kcal, 0),
    ),
    servings,
    seed,
  };
}

function pick<T>(list: T[], rnd: () => number): T | undefined {
  if (!list.length) return undefined;
  // Başa doğru ağırlıklı: iyi olanın seçilme şansı yüksek ama tekel değil.
  const i = Math.floor(rnd() ** 1.7 * list.length);
  return list[Math.min(i, list.length - 1)];
}

function estimateMinutes(mins: number[]): number {
  if (!mins.length) return 0;
  const sorted = [...mins].sort((a, b) => b - a);
  return Math.round(sorted[0] + sorted.slice(1).reduce((s, m) => s + m, 0) * 0.5);
}

function reasonForAnchor(r: Recipe, a: MenuAnswers): string {
  if (a.ana === 'balik') return 'Menünün merkezi: deniz ürünü ana yemek.';
  if (a.vesile === 'misafir' || a.vesile === 'ozel-gun') return 'Sofranın merkezine koyduğumuz tabak.';
  return `Menüyü bu tabağın üzerine kurduk (${r.totalMinutes} dk).`;
}

/**
 * Bileşik adları künyede uzun yazılıyor: "1,3,5-undecatriene (a mixture of
 * 1,3(e),5(z)- and 1,3(e),5(e)-isomers)". Ekranda ilk parçası yeter.
 */
function shortCompound(name: string): string {
  const head = name.split('(')[0].trim();
  return head.length > 30 ? `${head.slice(0, 28)}…` : head;
}

function reasonForCourse(
  def: CourseDef,
  r: Recipe,
  bridge: Bridge | undefined,
  anchorTaste: TasteVector,
): string {
  if (bridge && bridge.aroma >= 0.25) {
    const from = BY_SLUG.get(bridge.fromSlug)?.nameTr ?? bridge.fromSlug;
    const to = BY_SLUG.get(bridge.toSlug)?.nameTr ?? bridge.toSlug;
    const via = bridge.compoundTr ? ` (${shortCompound(bridge.compoundTr)})` : '';
    return `${to} ile ${from.toLocaleLowerCase('tr-TR')} ortak aroma bileşiği paylaşıyor${via}.`;
  }

  if (def.id === 'salata-meze' && anchorTaste.fat > 0.18) {
    return 'Ana yemek yağlı; bu ekşi tabak damağı temizliyor.';
  }
  if (def.id === 'icecek' && anchorTaste.heat > 0.06) {
    return 'Ana yemek acılı; bu içecek serinletiyor.';
  }
  if (def.id === 'tatli') {
    return 'Sofrayı kapatan tatlı — ana yemeğin ağırlığına göre seçildi.';
  }
  return 'Sofradaki diğer tabaklarla aynı yöne bakıyor.';
}
