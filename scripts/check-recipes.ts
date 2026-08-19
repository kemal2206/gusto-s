/**
 * Tarif verisi denetimi.
 *
 *   npm run check:recipes
 *
 * `src/data/recipes/index.ts` yüklenirken zaten doğrulama yapıyor ve sorun
 * varsa hata fırlatıyor; bu script o doğrulamayı çalıştırıp kapsamı raporluyor.
 * Boş kalan kategori ve hiç kullanılmayan malzeme buradan görünüyor.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import { DISH_CATEGORIES, RECIPES, RECIPE_STATS } from '../src/data/recipes/index.ts';
import { CUISINE_LABELS_TR, type CuisineId } from '../src/data/recipes/types.ts';

console.log(`\n════ TARİF KATALOĞU ════`);
console.log(`  toplam: ${RECIPE_STATS.total} tarif`);

console.log('\n── KATEGORİ DAĞILIMI');
for (const c of DISH_CATEGORIES) {
  const n = RECIPE_STATS.byCategory[c.id] ?? 0;
  const flag = n === 0 ? '   ← BOŞ' : '';
  console.log(`  ${c.emoji} ${c.labelTr.padEnd(22)} ${String(n).padStart(3)}${flag}`);
}

console.log('\n── MUTFAK DAĞILIMI');
for (const [k, n] of Object.entries(RECIPE_STATS.byCuisine).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${CUISINE_LABELS_TR[k as CuisineId].padEnd(22)} ${String(n).padStart(3)}`);
}

console.log('\n── BİLEŞEN YAPISI');
const multi = RECIPES.filter((r) => r.components.length > 1);
console.log(`  tek bileşenli:  ${RECIPES.length - multi.length}`);
console.log(`  çok bileşenli:  ${multi.length}`);
for (const r of multi) {
  console.log(`     ${r.title} → ${r.components.map((c) => `${c.kind}:${c.title}`).join(' + ')}`);
}

// ── Katalog kapsamı ────────────────────────────────────────────────
const used = new Set(RECIPES.flatMap((r) => r.allSlugs));
const unused = INGREDIENTS.filter((i) => !used.has(i.slug));

console.log('\n── KATALOG KULLANIMI');
console.log(`  tariflerde geçen malzeme: ${used.size} / ${INGREDIENTS.length}`);
console.log(`  hiç kullanılmayan:        ${unused.length}`);
if (unused.length) {
  console.log(`     ${unused.slice(0, 40).map((i) => i.nameTr).join(', ')}${unused.length > 40 ? '…' : ''}`);
}

const steps = RECIPES.flatMap((r) => r.components.flatMap((c) => c.steps));
console.log(`\n  toplam pişirme adımı: ${steps.length}`);
console.log(`  ortalama adım/tarif:  ${(steps.length / RECIPES.length).toFixed(1)}`);
console.log('');
