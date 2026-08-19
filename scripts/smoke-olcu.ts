/**
 * Ev ölçüsü denetimi.
 *
 *   npm run smoke:olcu
 *
 * İki soruyu birden kontrol ediyor:
 *
 *  1. **Saçmalıyor mu?** Tavuğu çay bardağıyla, eti kaşıkla ölçen bir satır
 *     çıkmamalı. Katalogdaki bütün malzemeler taranıp yasak eşleşme aranıyor.
 *  2. **Tutarlı mı?** "2 su bardağı un" grama çevrilip geri döndürüldüğünde
 *     yine 2 su bardağı çıkmalı. Gidiş ve dönüş aynı tabloyu kullanmazsa
 *     tarif sessizce bozuluyor.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import {
  formatAmount,
  measureFormOf,
  toHouseholdMeasure,
} from '../src/data/catalog/ev-olcusu.ts';
import { gramsFor } from '../src/data/catalog/olcu.ts';
import { RECIPES } from '../src/data/recipes/index.ts';

const BY_SLUG = new Map(INGREDIENTS.map((i) => [i.slug, i]));

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

// ── Örnek dönüşümler ───────────────────────────────────────────────

console.log('\n════ ÖRNEK DÖNÜŞÜMLER');
const samples: [string, number][] = [
  ['un', 110], ['un', 220], ['un', 30],
  ['seker', 170], ['seker', 12],
  ['su', 200], ['sut', 100], ['zeytinyagi', 15],
  ['bal', 21], ['domates-salcasi', 33], ['yogurt', 206],
  ['pirinc', 170], ['bulgur', 80],
  ['tuz', 6], ['karabiber', 2], ['pul-biber', 0.5], ['kimyon', 2.5],
  ['sarimsak', 12],
  ['maydanoz', 8], ['maydanoz', 20], ['maydanoz', 30], ['maydanoz', 60], ['dereotu', 12],
  ['yumurta', 110], ['kuru-sogan', 220], ['kuru-sogan', 83],
  ['limon', 30], ['limon', 60], ['limon', 120], ['misket-limonu', 20],
  ['domates', 130], ['domates', 30], ['havuc', 80], ['enginar', 480],
  // Ev ölçüsü olmaması gerekenler
  ['tavuk-but', 800], ['dana-kusbasi', 600], ['levrek', 700],
  ['patlican', 500], ['kasar', 150],
];

for (const [slug, g] of samples) {
  const ing = BY_SLUG.get(slug);
  if (!ing) {
    console.log(`  ⚠ ${slug} katalogda yok`);
    continue;
  }
  const form = measureFormOf(slug, ing.category);
  console.log(
    `  ${ing.nameTr.padEnd(18)} ${String(g).padStart(5)} g  →  ` +
      `${formatAmount(slug, ing.category, g).padEnd(34)} [${form}]`,
  );
}

// ── Denetimler ─────────────────────────────────────────────────────

console.log('\n════ DENETİM');

/** Kaşık/bardak asla verilmemesi gereken kategoriler. */
const SOLID = ['protein', 'deniz', 'sarkuteri', 'mantar'];
const VOLUME = new Set(['su-bardagi', 'cay-bardagi', 'yemek-kasigi', 'tatli-kasigi', 'cay-kasigi']);

const solidLeak: string[] = [];
for (const ing of INGREDIENTS) {
  if (!SOLID.includes(ing.category)) continue;
  for (const g of [5, 30, 100, 300, 800]) {
    const m = toHouseholdMeasure(ing.slug, ing.category, g);
    if (m && VOLUME.has(m.measureId)) solidLeak.push(`${ing.nameTr} ${g}g → ${m.text}`);
  }
}
check(solidLeak.length === 0, `ete/balığa kaşık-bardak verilmiyor${solidLeak.length ? ` (${solidLeak.slice(0, 3).join(' | ')})` : ''}`);

// Gidiş-dönüş: "2 su bardağı un" → gram → geri
const roundTrip: [string, number, string][] = [
  ['un', 2, 'su bardağı'],
  ['seker', 1, 'su bardağı'],
  ['pirinc', 1, 'su bardağı'],
  ['su', 1, 'çay bardağı'],
  ['zeytinyagi', 3, 'yemek kaşığı'],
  ['domates-salcasi', 2, 'yemek kaşığı'],
  ['tuz', 1, 'tatlı kaşığı'],
  ['yogurt', 1, 'su bardağı'],
];

/**
 * Asıl değişmez: gram karşılığı korunmalı. Birim adının aynı çıkması şart
 * değil — "1 çay bardağı su" ile "yarım su bardağı" aynı şey, ikisi de doğru.
 * Bu yüzden çevrilen ölçünün gram karşılığı girdiye yakın mı diye bakıyoruz.
 */
console.log('');
for (const [slug, amount, unit] of roundTrip) {
  const ing = BY_SLUG.get(slug)!;
  const grams = gramsFor(amount, unit, slug, ing.category);
  const back = toHouseholdMeasure(slug, ing.category, grams);
  const backGrams = back ? gramsFor(back.count, back.text.split(' ').slice(-2).join(' '), slug, ing.category) : 0;
  const drift = back ? Math.abs(backGrams - grams) / grams : 1;
  check(
    back !== null && drift <= 0.12,
    `${amount} ${unit} ${ing.nameTr} → ${grams} g → ${back?.text ?? 'çevrilemedi'}` +
      (back ? ` (sapma %${Math.round(drift * 100)})` : ''),
  );
}

// Yoğunluk gerçekten uygulanıyor mu?
const unBardak = gramsFor(1, 'su bardağı', 'un', 'tahil');
const suBardak = gramsFor(1, 'su bardağı', 'su', 'diger');
console.log('');
check(unBardak > 90 && unBardak < 130, `1 su bardağı un ${unBardak} g (su: ${suBardak} g)`);
check(suBardak === 200, '1 su bardağı su 200 g');

// Tariflerde kaç satır ev ölçüsüne çevrilebiliyor?
let total = 0;
let converted = 0;
for (const r of RECIPES) {
  for (const c of r.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;
      total += 1;
      if (toHouseholdMeasure(ri.slug, ing.category, ri.grams)) converted += 1;
    }
  }
}
const pct = Math.round((converted / total) * 100);
console.log('');
console.log(`  ${converted} / ${total} malzeme satırı ev ölçüsüne çevrildi (%${pct})`);
check(pct >= 45, `satırların en az yarısına yakını ev ölçüsü alıyor (%${pct})`);

console.log(fail ? `\n${fail} denetim başarısız\n` : '\nTüm denetimler geçti\n');
process.exit(fail ? 1 : 0);
