/**
 * Tat dengesi.
 *
 * Kullanıcının sorusu: "Antrikotun üzerine tatlı-ekşi sos yapıyorum, yaban mersini
 * koydum — bu ekşiliğin tatlı dengesini ne sağlar?"
 *
 * Cevap üç adımda üretiliyor:
 *   1. Tabaktaki mevcut tat profilini hesapla (ağırlıklı ortalama)
 *   2. Arketip hedefinden çıkar → açık (deficit) vektörü
 *   3. Her aday için "eklersem ne olur" simülasyonu yap, mesafedeki iyileşmeyi ölç
 */

import type {
  Archetype,
  ArchetypeId,
  DishState,
  Ingredient,
  TasteAxis,
  TasteVector,
} from './types';
import { TASTE_AXES, ZERO_TASTE } from './types';
import { clamp01 } from './affinity';

const v = (
  sweet: number,
  sour: number,
  salty: number,
  bitter: number,
  umami: number,
  fat: number,
  heat: number,
): TasteVector => ({ sweet, sour, salty, bitter, umami, fat, heat });

/**
 * Hedef profiller. Bunlar mutlak doğru değil, kalibrasyon sabitleri —
 * aşama 3'te bilinen tariflerle doğrulanıp ayarlanacak.
 */
export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  // ── Karakter hedefleri (Lab zincirinin 2. adımı) ────────────────
  'hafif-ferah': {
    id: 'hafif-ferah',
    labelTr: 'Hafif ve ferah',
    description: 'Limonlu, yeşillikli, ağırlık yapmayan. Asit önde, yağ geride.',
    target: v(2, 5.5, 4, 2.5, 4, 3, 1),
    tolerance: 1.5,
    expectedRoles: ['asit', 'yag', 'aromatik', 'bitirici'],
  },
  'doyurucu-derin': {
    id: 'doyurucu-derin',
    labelTr: 'Doyurucu ve derin',
    description: 'Uzun pişmiş, tok tutan. Umami ve yağ önde, biraz asitle açılır.',
    target: v(2.5, 3, 5, 2, 8, 6, 2),
    tolerance: 1.7,
    expectedRoles: ['aromatik', 'yag', 'baharat', 'baglayici', 'zemin'],
  },
  'baharatli-atesli': {
    id: 'baharatli-atesli',
    labelTr: 'Baharatlı',
    description: 'Acı ve keskin. Yakıcılığı yağ taşır, asit dengeler.',
    target: v(2.5, 4, 5, 2.5, 6.5, 4.5, 6.5),
    tolerance: 1.8,
    expectedRoles: ['baharat', 'aromatik', 'yag', 'asit'],
  },
  'dumanli-izgara': {
    id: 'dumanli-izgara',
    labelTr: 'Izgara ve mangal',
    description: 'Kömür ve is notası. Tuz yüksek, ekşilik yağı keser.',
    target: v(2.5, 4.5, 5.5, 3, 7, 5, 3),
    tolerance: 1.8,
    expectedRoles: ['baharat', 'asit', 'yag', 'bitirici'],
  },

  // ── Hazırlık hedefleri ──────────────────────────────────────────
  'tatli-eksi-sos': {
    id: 'tatli-eksi-sos',
    labelTr: 'Tatlı-ekşi sos',
    description: 'Meyveli, parlak, eti kesen sos. Tatlı ile ekşi birbirini tutmalı.',
    target: v(7, 6.5, 3, 1.5, 3, 2, 1),
    tolerance: 1.5,
    expectedRoles: ['asit', 'tatlandirici', 'aromatik', 'yag'],
  },
  'kirmizi-et-sos': {
    id: 'kirmizi-et-sos',
    labelTr: 'Kırmızı et sosu',
    description: 'Derin, doyurucu, hafif ekşilikle dengelenen ağır sos.',
    target: v(3, 4, 5, 2, 7, 5, 2),
    tolerance: 1.6,
    expectedRoles: ['aromatik', 'asit', 'yag', 'baglayici'],
  },
  'kremali-sos': {
    id: 'kremali-sos',
    labelTr: 'Kremalı sos',
    description: 'Yağlılık ön planda; ekşilik ve tuz ağırlığı kırmak için.',
    target: v(2.5, 2, 4.5, 1, 5.5, 7.5, 1),
    tolerance: 1.5,
    expectedRoles: ['yag', 'baglayici', 'aromatik', 'bitirici'],
  },
  'salata-sosu': {
    id: 'salata-sosu',
    labelTr: 'Salata sosu',
    description: 'Ekşilik ve yağ ekseni; küçük bir tatlılık köşeleri yumuşatır.',
    target: v(2.5, 6.5, 4, 2, 2, 5.5, 1),
    tolerance: 1.4,
    expectedRoles: ['asit', 'yag', 'aromatik'],
  },
  corba: {
    id: 'corba',
    labelTr: 'Çorba',
    description: 'Umami temelli, tuz dengeli, bitirici ekşilikle açılan gövde.',
    target: v(2, 2.5, 5, 1.5, 6.5, 4, 1.5),
    tolerance: 1.6,
    expectedRoles: ['zemin', 'aromatik', 'yag', 'bitirici'],
  },
  'izgara-marine': {
    id: 'izgara-marine',
    labelTr: 'Izgara marinasyonu',
    description: 'Asit lifleri gevşetir, yağ taşır, baharat yüzeyde karamelize olur.',
    target: v(3, 5, 5.5, 2, 5, 4.5, 3),
    tolerance: 1.8,
    expectedRoles: ['asit', 'yag', 'baharat', 'aromatik'],
  },
  tatli: {
    id: 'tatli',
    labelTr: 'Tatlı',
    description: 'Tatlılık baskın; bir tutam tuz ve ekşi olmazsa yavan kalır.',
    target: v(8, 2, 1.5, 1.5, 0.5, 5, 0),
    tolerance: 1.5,
    expectedRoles: ['tatlandirici', 'yag', 'baglayici', 'aromatik'],
  },
};

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);

// ── Profil hesabı ──────────────────────────────────────────────────────

/** Bir bileşenin ağırlığı: gramı × etki katsayısı. 2 g safran 200 g patatesi bastırır. */
export const effectiveWeight = (grams: number, potency: number) => grams * potency;

export function dishTotalGrams(dish: DishState): number {
  return dish.components.reduce((s, c) => s + c.grams, 0);
}

/**
 * Tabağın tat profili — bileşenlerin etki-ağırlıklı ortalaması.
 * Nötr bir malzeme eklemek her ekseni seyreltir; bu istenen davranış.
 */
export function dishProfile(dish: DishState): TasteVector {
  let total = 0;
  const acc: TasteVector = { ...ZERO_TASTE };

  for (const c of dish.components) {
    const w = effectiveWeight(c.grams, c.ingredient.potency);
    if (w <= 0) continue;
    total += w;
    for (const axis of TASTE_AXES) acc[axis] += c.ingredient.taste[axis] * w;
  }

  if (total <= 0) return { ...ZERO_TASTE };
  for (const axis of TASTE_AXES) acc[axis] = acc[axis] / total;
  return acc;
}

/** Hedeften sapma. Pozitif = eksik, negatif = fazla kaçmış. */
export function deficit(profile: TasteVector, target: TasteVector): TasteVector {
  const d: TasteVector = { ...ZERO_TASTE };
  for (const axis of TASTE_AXES) d[axis] = target[axis] - profile[axis];
  return d;
}

export type AxisWeights = Partial<Record<TasteAxis, number>>;

/**
 * Normalize edilmiş ağırlıklı RMS mesafe ∈ [0,1] (eksenler 0–10 olduğu için /10).
 *
 * `axisWeights` kullanıcının derdini yansıtır: "ben tatlı-ekşi dengesini soruyorum"
 * dediğinde tuz ve yağ eksenindeki açık, sonucu belirlememelidir.
 */
export function tasteDistance(
  a: TasteVector,
  b: TasteVector,
  axisWeights?: AxisWeights,
): number {
  let sum = 0;
  let weightSum = 0;

  for (const axis of TASTE_AXES) {
    const w = axisWeights?.[axis] ?? 1;
    const diff = a[axis] - b[axis];
    sum += w * diff * diff;
    weightSum += w;
  }

  return weightSum > 0 ? Math.sqrt(sum / weightSum) / 10 : 0;
}

/**
 * Makul bir doz öner. Güçlü malzemeden az, hafif malzemeden çok.
 * Dozaj skorun parçası — 200 g bal ile 5 g bal aynı sonucu vermez, bu yüzden
 * kullanıcıya da gösteriliyor.
 */
export function suggestedDose(ing: Ingredient, dishGrams: number): number {
  const base = Math.max(dishGrams, 50) * 0.08;
  const dose = base / Math.max(ing.potency, 0.25);
  const cap = Math.max(dishGrams * 0.5, 5);
  return Math.round(Math.min(Math.max(dose, 1), cap) * 10) / 10;
}

/** Adayı verilen dozda eklersek oluşacak profil. */
export function simulateAdd(dish: DishState, ing: Ingredient, grams: number): TasteVector {
  return dishProfile({
    ...dish,
    components: [...dish.components, { ingredient: ing, grams, role: ing.defaultRole }],
  });
}

const clampAxis = (x: number) => (x < 0 ? 0 : x > 10 ? 10 : x);

/**
 * Yanında servis edilen şeye göre hedefi kaydırır.
 *
 * Mutfakta yerleşik kural: yağı asit keser, tuz da onu taşır. Yağlı bir antrikotun
 * üzerine giden sos, tek başına içilecek bir sostan daha ekşi ve daha tuzlu olmalı.
 * Katsayılar kalibrasyon sabiti — aşama 3'te bilinen tariflerle ayarlanacak.
 */
export function counterpointTarget(target: TasteVector, accompaniment: TasteVector): TasteVector {
  const excessFat = Math.max(0, accompaniment.fat - 4);
  return {
    ...target,
    sour: clampAxis(target.sour + 0.35 * excessFat),
    salty: clampAxis(target.salty + 0.2 * excessFat),
  };
}

export interface AxisMove {
  axis: TasteAxis;
  from: number;
  to: number;
  target: number;
}

export interface BalanceEvaluation {
  /** Hedefe yaklaşma oranı ∈ [0,1]. Uzaklaştıysa 0. */
  gain: number;
  before: TasteVector;
  after: TasteVector;
  distanceBefore: number;
  distanceAfter: number;
  /** Gözle görülür şekilde değişen eksenler — "neden?" ekranında gösterilir. */
  moved: AxisMove[];
  /** Hedef + tolerans sınırını aşan eksenler. Skorda ceza. */
  overshoot: { axis: TasteAxis; value: number; limit: number }[];
}

const MOVE_THRESHOLD = 0.25;

/**
 * Hedef profil + tolerans. `Archetype` bu şekle yapısal olarak uyuyor;
 * ayrı tip olmasının sebebi `counterpointTarget` ile kaydırılmış hedefi
 * de aynı fonksiyona verebilmek.
 */
export interface BalanceTarget {
  target: TasteVector;
  tolerance: number;
  /** Kullanıcının önemsediği eksenler ağır bassın diye. Yoksa hepsi eşit. */
  axisWeights?: AxisWeights;
}

export function evaluateBalance(
  dish: DishState,
  spec: BalanceTarget,
  ing: Ingredient,
  grams: number,
): BalanceEvaluation {
  const before = dishProfile(dish);
  const after = simulateAdd(dish, ing, grams);

  const distanceBefore = tasteDistance(before, spec.target, spec.axisWeights);
  const distanceAfter = tasteDistance(after, spec.target, spec.axisWeights);

  /**
   * Kazanç **işaretli** — hedeften uzaklaştıran aday ceza alıyor.
   *
   * Önce `clamp01` ile sıfıra kırpılıyordu ve bunun iki sonucu vardı:
   *
   *  1. Uzaklaştıran aday ceza almıyor, sadece prim alamıyordu. Aroma ve
   *     gelenek terimleri onu yine tepeye taşıyabiliyordu — kremalı bir
   *     sosa vanilya, tatlı-ekşi bir sosa dereotu böyle geliyordu.
   *  2. `optimizeDose` bütün zararlı dozları sıfırda eşit görüyor ve ilk
   *     denediğini seçiyordu. İşaretliyken en az zararlı dozu seçiyor.
   *
   * Katalog genelinde ölçüldü (`npm run denetim:oneri`): kırpılı hâlde
   * ilk üç önerinin %2,4'ü tabağı hedeften uzaklaştırıyordu ve bunların
   * 214'ü sosun aromatik adımındaydı.
   *
   * Alt sınır −1: uzaklaşma ne kadar büyük olursa olsun ceza tek bir
   * terimi domine etmesin.
   */
  const ratio = distanceBefore <= 1e-6 ? 0 : (distanceBefore - distanceAfter) / distanceBefore;
  const gain = Math.max(-1, Math.min(1, ratio));

  const moved: AxisMove[] = [];
  const overshoot: BalanceEvaluation['overshoot'] = [];

  for (const axis of TASTE_AXES) {
    if (Math.abs(after[axis] - before[axis]) >= MOVE_THRESHOLD) {
      moved.push({
        axis,
        from: round1(before[axis]),
        to: round1(after[axis]),
        target: round1(spec.target[axis]),
      });
    }
    const limit = spec.target[axis] + spec.tolerance;
    if (after[axis] > limit) {
      overshoot.push({ axis, value: round1(after[axis]), limit: round1(limit) });
    }
  }

  // Gerekçede önce kullanıcının sorduğu eksen görünsün.
  moved.sort((a, b) => {
    const wa = spec.axisWeights?.[a.axis] ?? 1;
    const wb = spec.axisWeights?.[b.axis] ?? 1;
    return wb * Math.abs(b.to - b.from) - wa * Math.abs(a.to - a.from);
  });

  return { gain, before, after, distanceBefore, distanceAfter, moved, overshoot };
}

/** Aşırıya kaçma cezası ∈ [0,1]. */
export function overshootPenalty(evaluation: BalanceEvaluation): number {
  if (!evaluation.overshoot.length) return 0;
  const total = evaluation.overshoot.reduce((s, o) => s + (o.value - o.limit), 0);
  return clamp01(total / 6);
}

/**
 * Doz optimizasyonu.
 *
 * Sabit bir formülle doz vermek yanlış sonuç üretiyor: aynı 8%'lik oran
 * safranı da balı da kapsayamaz. Onun yerine birkaç makul dozu deneyip
 * hedefe en çok yaklaştıranı seçiyoruz — 6 hesap, malzeme başına ihmal edilebilir.
 *
 * Yan fayda: kullanıcıya "ne kadar?" sorusunun cevabı da çıkıyor.
 */
export const DOSE_FRACTIONS = [0.03, 0.06, 0.1, 0.16, 0.25, 0.4] as const;

/**
 * Pişirme pratiğinden gelen doz sınırı, tabak ağırlığının oranı olarak.
 *
 * Sınır koymazsak matematik saçmalıyor: "2 g pirinç" ya da "100 g tereyağı"
 * hedefe daha yakın çıkabiliyor ama mutfakta anlamsız. Aralık, rolün gerçek
 * kullanım miktarını temsil ediyor.
 */
export interface DoseBounds {
  min: number;
  max: number;
}

/** Aralığı geometrik olarak böler — küçük dozlarda çözünürlük daha yüksek olsun. */
function fractionsWithin({ min, max }: DoseBounds, steps = 6): number[] {
  if (min <= 0 || max <= min || steps < 2) return [max];
  const ratio = (max / min) ** (1 / (steps - 1));
  return Array.from({ length: steps }, (_, i) => min * ratio ** i);
}

export function optimizeDose(
  dish: DishState,
  spec: BalanceTarget,
  ing: Ingredient,
  bounds?: DoseBounds,
): { grams: number; evaluation: BalanceEvaluation } {
  // Çok küçük hazırlıklarda oransal doz anlamsızlaşıyor (2 g sosun %3'ü…).
  const base = Math.max(dishTotalGrams(dish), 40);
  const fractions = bounds ? fractionsWithin(bounds) : [...DOSE_FRACTIONS];

  let best: { grams: number; evaluation: BalanceEvaluation } | null = null;

  for (const fraction of fractions) {
    const grams = roundDose(base * fraction);
    if (grams <= 0) continue;

    const evaluation = evaluateBalance(dish, spec, ing, grams);
    // Eşitlikte küçük doz kazanır — az malzemeyle aynı sonuç daha iyidir.
    if (!best || evaluation.gain > best.evaluation.gain + 1e-9) {
      best = { grams, evaluation };
    }
  }

  return best ?? { grams: 1, evaluation: evaluateBalance(dish, spec, ing, 1) };
}

/** Mutfakta yazılabilir sayılara yuvarla: 2,3 g → 2,5 g · 37 g → 35 g. */
function roundDose(grams: number): number {
  if (grams < 5) return Math.max(0.5, Math.round(grams * 2) / 2);
  if (grams < 20) return Math.round(grams);
  return Math.round(grams / 5) * 5;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
