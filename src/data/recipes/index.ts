/**
 * Tarif kataloğu.
 *
 * Yükleme sırasında iki şey doğrulanıyor ve hata varsa uygulama açılmıyor:
 *  1. Her tarifin kategorisi tanımlı mı
 *  2. Her malzeme slug'ı katalogda var mı
 *
 * İkincisi kritik: tarifte yazım hatası olan bir slug sessizce görmezden
 * gelinirse tarif eksik malzemeyle görünür ve "elimde ne var" eşleştirmesi
 * yanlış sonuç verir.
 */

import { BY_SLUG } from '@/data/catalog';

import { CATEGORY_BY_ID, DISH_CATEGORIES } from './kategoriler';
import { ITHAL_TR } from './ithal-tr';
import { ITHAL_YEMEKCOM } from './ithal-yemekcom';
import { KOMSU_UZAKDOGU } from './komsu-uzakdogu';
import { TR_CORBA_SULU } from './tr-corba-sulu';
import { TR_ICECEK } from './tr-icecek';
import { TR_IZGARA_DENIZ } from './tr-izgara-deniz';
import { TR_SEBZE_HAMUR } from './tr-sebze-hamur';
import { buildRecipe, type CuisineId, type Recipe } from './types';

const RAW = [
  ...TR_CORBA_SULU,
  ...TR_ICECEK,
  ...TR_IZGARA_DENIZ,
  ...TR_SEBZE_HAMUR,
  ...KOMSU_UZAKDOGU,
  ...ITHAL_YEMEKCOM,
  ...ITHAL_TR,
];

/**
 * Aynı yemek birden çok kaynakta varsa sıra RAW dizisinde belirleniyor,
 * önce gelen kazanıyor:
 *
 *  1. **Elle yazılanlar** — çok bileşenli ve kürate edilmiş, hepsinin önünde.
 *  2. **yemek.com** — özeti, porsiyonu ve fotoğrafı gerçek.
 *  3. **nefisyemektarifleri** — en geniş korpus ama özeti ilk adımın kopyası,
 *     porsiyonu neredeyse hep varsayılan ve fotoğrafı yok.
 *
 *  Yani "Mercimek Çorbası" her üçünde de varsa kullanıcı elle yazılanı,
 *  yoksa fotoğraflı olanı görüyor.
 */
const seenSlug = new Set<string>();
export const DUPLICATES: string[] = [];

export const RECIPES: Recipe[] = RAW.filter((r) => {
  if (seenSlug.has(r.s)) {
    DUPLICATES.push(r.s);
    return false;
  }
  seenSlug.add(r.s);
  return true;
}).map(buildRecipe);

// ── Doğrulama ──────────────────────────────────────────────────────

{
  const problems: string[] = [];

  for (const r of RECIPES) {
    if (!CATEGORY_BY_ID.has(r.categoryId)) {
      problems.push(`${r.slug}: bilinmeyen kategori "${r.categoryId}"`);
    }

    for (const slug of r.allSlugs) {
      if (!BY_SLUG.has(slug)) problems.push(`${r.slug}: katalogda olmayan malzeme "${slug}"`);
    }

    if (!r.components.some((c) => c.steps.length > 0)) {
      problems.push(`${r.slug}: hiç pişirme adımı yok`);
    }
  }

  if (problems.length) {
    throw new Error(`Tarif verisinde ${problems.length} sorun:\n  ${problems.join('\n  ')}`);
  }
}

// ── Erişim ─────────────────────────────────────────────────────────

export const RECIPE_BY_SLUG = new Map(RECIPES.map((r) => [r.slug, r]));

export function recipesByCategory(categoryId: string): Recipe[] {
  return RECIPES.filter((r) => r.categoryId === categoryId);
}

export function recipesByCuisine(cuisine: CuisineId): Recipe[] {
  return RECIPES.filter((r) => r.cuisine === cuisine);
}

/** Ana malzemesi verilen slug olan tarifler — "senin mutfağın" bölümü için. */
export function recipesWithIngredient(slug: string): Recipe[] {
  return RECIPES.filter((r) => r.allSlugs.includes(slug));
}

/**
 * "Elimde ne var" eşleştirmesi.
 *
 * Tuz, su, un gibi her mutfakta bulunan şeyleri eksik saymak anlamsız;
 * onlar `pantryFree` kabul ediliyor ve eksik listesine girmiyor.
 *
 * **Sıralama neden eksik sayısı değil:** Türk kahvesinin malzemesi kahve +
 * su + şeker; ikisi zaten serbest sayıldığı için geriye tek malzeme kalıyor
 * ve sen hiç kahve seçmemiş olsan bile "1 eksik" çıkıyordu. Böylece on
 * malzemesinin sekizi elinde olan güvecin önüne geçiyordu. Artık üç şeye
 * birden bakıyoruz:
 *
 *  1. **Kapsama** — tarifin ne kadarı elinde (have / needed)
 *  2. **Kullanım** — senin seçtiklerinin ne kadarını kullanıyor
 *  3. **Ana malzeme bağı** — ete bakıyorsan etsiz tarif cevap değil
 *
 * Ayrıca tek malzemeli "tarifler" listeye hiç girmiyor: "elimde ne var"
 * sorusunun cevabı tek malzemeli bir şey olamaz.
 */
const PANTRY_FREE = new Set(['tuz', 'su', 'seker', 'un', 'sivi-yag', 'karabiber', 'nisasta']);

/** Kilerde seçilince tarifin yönünü belirleyen kategoriler. */
const MAIN_CATEGORIES = new Set(['protein', 'deniz', 'sarkuteri', 'mantar', 'baklagil']);

export interface RecipeMatch {
  recipe: Recipe;
  missing: string[];
  matched: string[];
  have: number;
  needed: number;
  /** 0–1 sıralama puanı — grup içi sıralama buna göre. */
  score: number;
}

export function matchPantry(pantrySlugs: Set<string>): RecipeMatch[] {
  if (!pantrySlugs.size) return [];

  // Kullanıcı ana malzeme seçtiyse (et, balık, mantar, bakliyat) tarif
  // bunlardan en az birini kullanmalı; yoksa bağlam kopuyor.
  const pickedMains = [...pantrySlugs].filter((s) =>
    MAIN_CATEGORIES.has(BY_SLUG.get(s)?.category ?? ''),
  );

  const out: RecipeMatch[] = [];

  for (const recipe of RECIPES) {
    const needed = recipe.allSlugs.filter((s) => !PANTRY_FREE.has(s));
    // Tek malzemeli tarif kilerde anlamlı bir cevap değil.
    if (needed.length < 3) continue;

    const matched = needed.filter((s) => pantrySlugs.has(s));
    if (!matched.length) continue;

    const missing = needed.filter((s) => !pantrySlugs.has(s));
    const coverage = matched.length / needed.length;
    const usage = matched.length / pantrySlugs.size;

    // Ana malzeme seçildiyse tarif onlardan birini kullanıyor mu?
    const usesMain = pickedMains.some((s) => recipe.allSlugs.includes(s));
    if (pickedMains.length && !usesMain) continue;

    out.push({
      recipe,
      missing,
      matched,
      have: matched.length,
      needed: needed.length,
      // Kapsama ağır basıyor; kullanım ikinci, tarifin kısalığı üçüncü.
      score: coverage * 0.6 + usage * 0.3 + Math.min(1, 6 / needed.length) * 0.1,
    });
  }

  return out.sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
}

export const RECIPE_STATS = {
  total: RECIPES.length,
  byCategory: Object.fromEntries(
    DISH_CATEGORIES.map((c) => [c.id, RECIPES.filter((r) => r.categoryId === c.id).length]),
  ),
  byCuisine: RECIPES.reduce<Record<string, number>>((acc, r) => {
    acc[r.cuisine] = (acc[r.cuisine] ?? 0) + 1;
    return acc;
  }, {}),
};

export * from './kategoriler';
export * from './types';
