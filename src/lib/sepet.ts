/**
 * Sepete ne girer, ne kadar girer.
 *
 * Aynı kural üç ekranda birden lazım: tarif sayfası, menü kurucusu, kendi
 * tarifin. Tek yerde durmasaydı biri suyu atlayıp öbürü atlar, biri iki
 * bileşende geçen tereyağını toplarken öbürü toplamazdı.
 */

import type { Recipe } from '@/data/recipes';
import { scaleFactorFor, scaleGrams } from '@/lib/profile-filter';

/**
 * Alışveriş listesine yazılmayacak malzemeler.
 *
 * Yalnızca su: "4 su bardağı su" diye bir market satırı yok. Tuz, un, yağ
 * burada değil — onlar da bitiyor ve alınması gerekiyor.
 *
 * `PANTRY_FREE` ile (bkz. `data/recipes/index.ts`) karıştırılmamalı: o küme
 * "bu tarif elindekiyle çıkar mı" sorusunun kümesi, bu ise "bunu markette
 * arar mısın" sorusunun. İkisi aynı değil.
 */
export const NOT_SHOPPED = new Set(['su']);

export interface BasketLine {
  /** Katalog malzemesinde slug; elle yazılmış satırda `metin:` önekli anahtar. */
  slug: string;
  /** Miktar bilinmiyorsa 0 — sepette miktar satırı hiç yazılmıyor. */
  grams: number;
  /** Katalogda karşılığı olmayan satırın kullanıcının yazdığı hâli. */
  label?: string;
}

/**
 * Katalogda karşılığı olmayan satır için anahtar.
 *
 * `metin:` öneki slug'larla çakışmayı imkânsız kılıyor (slug'larda iki nokta
 * yok). Küçültme Türkçe kurallarıyla, yoksa "Ekmek" ile "EKMEK" iki ayrı
 * satır oluyor.
 */
export const textKey = (raw: string): string =>
  `metin:${raw.trim().toLocaleLowerCase('tr-TR')}`;

/**
 * Satırları malzeme başına tekilleştirir ve alınmayacakları atar.
 *
 * Bir tarif tereyağını hem sosta hem ana bileşende isteyebiliyor. Markette
 * iki kez tereyağı aranmaz, toplamı aranır — bu yüzden gramlar burada
 * toplanıyor. (Depodaki `addMany` aynı tarifin aynı malzemesini *değiştirdiği*
 * için, toplama işi çağırandan önce burada bitmeli.)
 */
export function consolidate(lines: BasketLine[]): BasketLine[] {
  const map = new Map<string, BasketLine>();
  for (const line of lines) {
    if (NOT_SHOPPED.has(line.slug)) continue;
    const current = map.get(line.slug);
    if (current) current.grams += line.grams;
    else map.set(line.slug, { ...line });
  }
  return [...map.values()];
}

/** Tarifin sepete girecek satırları, hanenin kişi sayısına ölçeklenmiş. */
export function shoppableFor(recipe: Recipe, people: number): BasketLine[] {
  const factor = scaleFactorFor(recipe, people);
  const asIs = Math.abs(factor - 1) < 0.05;

  return consolidate(
    recipe.components
      .flatMap((c) => c.ingredients)
      .map((i) => ({
        slug: i.slug,
        grams: asIs ? i.grams : scaleGrams(i.slug, i.grams, factor),
      })),
  );
}
