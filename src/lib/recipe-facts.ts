/**
 * Tarif sayfasındaki bilgi bloklarını gerçek veriden üretir.
 *
 * Yeni tarif arayüzünde kalori, protein, etiketler, alerjenler, besin değerleri
 * ve gereçler için alanlar var. Bunlar sabit yazılırsa yanlış bilgi olur —
 * hepsi tarifin kendi malzemelerinden ve pişirme yönteminden hesaplanıyor.
 */

import { BY_SLUG } from '@/data/catalog';
import { macrosFor, type Macros } from '@/data/catalog/besin';
import { CATEGORY_BY_ID, CUISINE_LABELS_TR, METHOD_LABELS_TR, type Recipe } from '@/data/recipes';

// ── Besin değeri ───────────────────────────────────────────────────

export interface Nutrition extends Macros {
  /** Porsiyon başına mı, tarifin tamamı mı. */
  perServing: boolean;
}

/**
 * Porsiyon başına besin değeri.
 *
 * Malzemelerin gram ağırlıklarıyla 100 g başına değerleri çarpılıp porsiyona
 * bölünüyor. Pişirme kaybı, yağ emilimi ve çeşit farkı hesaba katılmıyor —
 * bu yüzden arayüzde "tahmini" diye geçiyor.
 */
export function nutritionOf(recipe: Recipe): Nutrition {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;
      const m = macrosFor(ri.slug, ing.category);
      const k = ri.grams / 100;
      kcal += m.kcal * k;
      protein += m.protein * k;
      carbs += m.carbs * k;
      fat += m.fat * k;
    }
  }

  const s = Math.max(1, recipe.servings);
  return {
    kcal: Math.round(kcal / s),
    protein: Math.round(protein / s),
    carbs: Math.round(carbs / s),
    fat: Math.round(fat / s),
    perServing: true,
  };
}

// ── Alerjenler ─────────────────────────────────────────────────────

const ALLERGEN_TR: Record<string, string> = {
  gluten: 'Gluten',
  laktoz: 'Süt',
  yumurta: 'Yumurta',
  susam: 'Susam',
  findik: 'Fındık',
  ceviz: 'Ceviz',
  badem: 'Badem',
  fistik: 'Antep fıstığı',
  yerfistigi: 'Yer fıstığı',
  soya: 'Soya',
};

/** Tarifin malzemelerinden gelen alerjenler — sabit liste değil, hesaplanıyor. */
export function allergensOf(recipe: Recipe): string[] {
  const tags = new Set<string>();
  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      for (const a of BY_SLUG.get(ri.slug)?.allergenTags ?? []) tags.add(a);
    }
  }
  return [...tags].map((t) => ALLERGEN_TR[t] ?? t).sort((a, b) => a.localeCompare(b, 'tr'));
}

// ── Etiketler ──────────────────────────────────────────────────────

/**
 * Etiketler tarifin kendisinden çıkıyor: süre, zorluk, kategori, mutfak,
 * ve malzemelere bakarak diyet uygunluğu.
 */
export function tagsOf(recipe: Recipe): string[] {
  const out: string[] = [];

  if (recipe.totalMinutes <= 30) out.push('30 dakikada');
  else if (recipe.totalMinutes >= 120) out.push('Uzun pişirme');

  if (recipe.difficulty === 1) out.push('Kolay');
  if (recipe.difficulty === 3) out.push('Ustalık ister');

  const cat = CATEGORY_BY_ID.get(recipe.categoryId);
  if (cat) out.push(cat.labelTr);

  if (recipe.cuisine !== 'tr') out.push(CUISINE_LABELS_TR[recipe.cuisine]);

  const cats = new Set(
    recipe.components.flatMap((c) =>
      c.ingredients.map((i) => BY_SLUG.get(i.slug)?.category).filter(Boolean),
    ),
  );
  const hasMeat = cats.has('protein') || cats.has('deniz') || cats.has('sarkuteri');
  const hasDairy = cats.has('sut');
  const hasEgg = recipe.allSlugs.includes('yumurta');

  if (!hasMeat && !hasDairy && !hasEgg) out.push('Vegan');
  else if (!hasMeat) out.push('Vejetaryen');

  const n = nutritionOf(recipe);
  if (n.kcal > 0 && n.kcal <= 400) out.push('400 kalori altı');
  if (n.protein >= 25) out.push('Yüksek protein');

  if (recipe.components.length > 1) out.push(`${recipe.components.length} bileşen`);

  return out;
}

// ── Gereçler ───────────────────────────────────────────────────────

const UTENSILS: Record<string, string[]> = {
  firin: ['Fırın tepsisi', 'Fırın eldiveni'],
  izgara: ['Izgara', 'Maşa'],
  komur: ['Mangal', 'Şiş', 'Maşa'],
  tava: ['Geniş tava', 'Spatula'],
  sulu: ['Derin tencere', 'Kepçe'],
  haslama: ['Tencere', 'Süzgeç'],
  kizartma: ['Derin tencere', 'Kevgir', 'Kâğıt havlu'],
  buhar: ['Buharlı pişirici'],
  wok: ['Wok', 'Ahşap spatula'],
  cig: ['Kesme tahtası', 'Keskin bıçak'],
  karistir: ['Karıştırma kabı', 'Çırpma teli'],
  dinlendir: ['Kapaklı kap'],
};

/** Pişirme yöntemlerinden türetilen gereç listesi. */
export function utensilsOf(recipe: Recipe): string[] {
  const out = new Set<string>(['Kesme tahtası', 'Bıçak']);
  for (const c of recipe.components) {
    for (const u of UTENSILS[c.method] ?? []) out.add(u);
  }
  if (recipe.allSlugs.some((s) => ['un', 'irmik', 'nisasta'].includes(s))) out.add('Ölçü kabı');
  return [...out];
}

/** Bileşenlerin pişirme yöntemleri — "Fırında · Tavada" gibi. */
export function methodsOf(recipe: Recipe): string {
  return [...new Set(recipe.components.map((c) => METHOD_LABELS_TR[c.method]))].join(' · ');
}
