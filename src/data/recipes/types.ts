/**
 * Tarif modeli — **bileşen** temelli.
 *
 * Sorun şuydu: "uskumrunun yanına salatalık seçtim, bunları nasıl birleştireceğim?"
 * Cevap, salatalığın uskumrunun İÇİNE girmemesi. Bir yemek tek bir malzeme
 * yığını değil, her biri kendi yöntemi ve kendi tat hedefi olan **bileşenlerden**
 * oluşuyor:
 *
 *   Izgara uskumru          → bileşen 1: ana      (ızgara, 12 dk)
 *   Yanında salatalık piyaz → bileşen 2: garnitür (çiğ, 10 dk)
 *
 * "Düz antrikot üzerine yaban mersinli sos" da tam olarak bu:
 *
 *   Antrikot                → bileşen 1: ana  (ızgara, 8 dk)
 *   Yaban mersinli sos      → bileşen 2: sos  (redüksiyon, 15 dk, hedef: tatlı-ekşi)
 *
 * Yani en küçük yemek TEK bileşendir (sadece ızgara et). Sos eklemek ikinci bir
 * bileşen açar; o bileşenin kendi tat hedefi olur ve motorun `pairedWith`
 * mekanizması devreye girer — etin yağı sosun hedefini ekşiye kaydırır.
 * Şablon bir kalıp değil, bileşen listesi; kullanıcı istediği kadarını kurar.
 */

import type { ArchetypeId, IngredientRole } from '@/engine';

export type ComponentKind =
  /** Tabağın ana parçası. */
  | 'ana'
  /** Üzerine ya da yanına giden sos. Kendi tat hedefi var. */
  | 'sos'
  /** Yanında servis edilen — pilav, salata, püre. */
  | 'garnitur'
  /** Başlangıç / meze. */
  | 'meze'
  /** Hamur, iç harç gibi ara hazırlıklar. */
  | 'hazirlik';

export const COMPONENT_LABELS_TR: Record<ComponentKind, string> = {
  ana: 'Ana',
  sos: 'Sos',
  garnitur: 'Yanında',
  meze: 'Meze',
  hazirlik: 'Hazırlık',
};

export type CookMethod =
  | 'izgara'
  | 'komur'
  | 'tava'
  | 'firin'
  | 'haslama'
  | 'sulu'
  | 'kizartma'
  | 'buhar'
  | 'wok'
  | 'cig'
  | 'karistir'
  | 'dinlendir';

export const METHOD_LABELS_TR: Record<CookMethod, string> = {
  izgara: 'Izgara',
  komur: 'Kömür ateşi',
  tava: 'Tavada',
  firin: 'Fırında',
  haslama: 'Haşlama',
  sulu: 'Sulu pişirme',
  kizartma: 'Kızartma',
  buhar: 'Buharda',
  wok: 'Wokta',
  cig: 'Pişirmeden',
  karistir: 'Karıştırarak',
  dinlendir: 'Dinlendirerek',
};

export type CuisineId = 'tr' | 'levanten' | 'yunan-balkan' | 'iran-kafkas' | 'uzakdogu';

export const CUISINE_LABELS_TR: Record<CuisineId, string> = {
  tr: 'Türk',
  levanten: 'Levanten',
  'yunan-balkan': 'Yunan ve Balkan',
  'iran-kafkas': 'İran ve Kafkas',
  uzakdogu: 'Uzak Doğu',
};

// ── Çözümlenmiş biçim ──────────────────────────────────────────────

export interface RecipeIngredient {
  slug: string;
  grams: number;
  role?: IngredientRole;
  /** "ince doğranmış", "közlenmiş" gibi hazırlık notu. */
  note?: string;
  optional?: boolean;
}

export interface RecipeComponent {
  kind: ComponentKind;
  title: string;
  method: CookMethod;
  minutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Bu bileşenin hedef tat profili — motor dengeyi buna göre ölçer. */
  archetypeId?: ArchetypeId;
}

export interface Recipe {
  slug: string;
  title: string;
  summary: string;
  cuisine: CuisineId;
  categoryId: string;
  servings: number;
  totalMinutes: number;
  difficulty: 1 | 2 | 3;
  components: RecipeComponent[];
  tags: string[];
  /**
   * Tarifin kendi fotoğrafı. Yalnızca kaynağında fotoğraf olan korpusta dolu;
   * boşken arayüz kategori rengine ve yer tutucuya düşüyor.
   */
  imageUrl?: string;
  /**
   * Kaynağından gelen, porsiyon başına besin değeri.
   *
   * Doluysa yetkilidir ve hesaplanmaz: kaynak tarifi gerçekten ölçmüşse
   * bizim tahminimiz onun yerine geçmemeli. Boşsa `nutritionOf` malzemelerden
   * ve pişirme yönteminden hesaplıyor.
   */
  nutrition?: { kcal: number; protein: number; carbs: number; fat: number };
  /** Tüm bileşenlerdeki malzeme slug'ları — filtreleme için düzleştirilmiş. */
  allSlugs: string[];
}

// ── Ham yazım biçimi ───────────────────────────────────────────────
//
// 200 tarif elle yazılacağı için alanlar kısa. Tek bileşenli tarifler düz
// yazılıyor; sos/garnitür isteyenler `comp` dizisi açıyor.

/** [slug, gram] ya da [slug, gram, not] */
export type RawRecipeIngredient = [string, number] | [string, number, string];

export interface RawComponent {
  /** Bileşen tipi. Yoksa 'ana'. */
  k?: ComponentKind;
  t: string;
  me: CookMethod;
  mi: number;
  ing: RawRecipeIngredient[];
  st: string[];
  ar?: ArchetypeId;
}

export interface RawRecipe {
  s: string;
  n: string;
  /** Kategori id — kategoriler.ts */
  c: string;
  /** Mutfak. Yoksa 'tr'. */
  k?: CuisineId;
  /** Toplam dakika. */
  m: number;
  srv?: number;
  d?: 1 | 2 | 3;
  sum: string;
  tags?: string[];
  /** Tarif fotoğrafının adresi — kaynağında varsa. */
  img?: string;
  /** Kaynağından gelen porsiyon başına besin değeri: [kcal, protein, karbonhidrat, yağ]. */
  nut?: [number, number, number, number];

  // Tek bileşenli kısayol
  me?: CookMethod;
  ing?: RawRecipeIngredient[];
  st?: string[];
  ar?: ArchetypeId;

  // Çok bileşenli
  comp?: RawComponent[];
}

function toIngredients(raw: RawRecipeIngredient[]): RecipeIngredient[] {
  return raw.map(([slug, grams, note]) => ({ slug, grams, note }));
}

export function buildRecipe(r: RawRecipe): Recipe {
  const components: RecipeComponent[] = r.comp
    ? r.comp.map((c) => ({
        kind: c.k ?? 'ana',
        title: c.t,
        method: c.me,
        minutes: c.mi,
        ingredients: toIngredients(c.ing),
        steps: c.st,
        archetypeId: c.ar,
      }))
    : [
        {
          kind: 'ana',
          title: r.n,
          method: r.me ?? 'tava',
          minutes: r.m,
          ingredients: toIngredients(r.ing ?? []),
          steps: r.st ?? [],
          archetypeId: r.ar,
        },
      ];

  const allSlugs = [...new Set(components.flatMap((c) => c.ingredients.map((i) => i.slug)))];

  return {
    slug: r.s,
    title: r.n,
    summary: r.sum,
    cuisine: r.k ?? 'tr',
    categoryId: r.c,
    servings: r.srv ?? 4,
    totalMinutes: r.m,
    difficulty: r.d ?? 1,
    components,
    tags: r.tags ?? [],
    imageUrl: r.img,
    nutrition: r.nut
      ? { kcal: r.nut[0], protein: r.nut[1], carbs: r.nut[2], fat: r.nut[3] }
      : undefined,
    allSlugs,
  };
}
