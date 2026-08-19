/**
 * "Canım ne istiyor" filtresi denetimi.
 *
 *   npm run smoke:kesfet
 *
 * Filtrenin asıl derdi şuydu: "acılı" seçen kişiye, içinde bir tutam pul
 * biber geçtiği için acı olmayan tarifler geliyordu — malzeme adına
 * bakılıyordu, tabağın gerçek acılığına değil. Burada her cevabın gerçekten
 * o niteliği taşıyan tarifleri getirdiğini ölçüyoruz.
 */

import { RECIPES } from '../src/data/recipes/index.ts';
import { COLLECTIONS, hasAnimalProduct, plantShare } from '../src/lib/koleksiyon.ts';
import { filterRecipes, type FilterAnswers } from '../src/lib/recipe-filter.ts';
import { dishTaste, heatLevel, ingredientCount, isOnePot } from '../src/lib/recipe-taste.ts';
import { nutritionOf } from '../src/lib/recipe-facts.ts';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

function run(title: string, answers: FilterAnswers) {
  const res = filterRecipes(answers, 20);
  console.log(`\n════ ${title}`);
  console.log(`  ${res.length} tarif`);
  for (const r of res.slice(0, 5)) {
    const t = dishTaste(r.recipe);
    console.log(
      `  ${r.score.toFixed(1).padStart(5)}  ${r.recipe.title.slice(0, 32).padEnd(34)} ` +
        `acı ${t.heat.toFixed(2)} · yağ ${t.fat.toFixed(1)} · ${nutritionOf(r.recipe).kcal} kcal · ` +
        `${ingredientCount(r.recipe)} malzeme${isOnePot(r.recipe) ? ' · tek tencere' : ''}`,
    );
  }
  return res;
}

// ── Acılık ─────────────────────────────────────────────────────────

const acili = run('Tavuk · acılı · iyice acı', {
  'ana-malzeme': 'tavuk',
  tat: 'baharatli',
  acilik: 'cok-aci',
});

const hafif = run('Sebze · hafif ve taze', { 'ana-malzeme': 'sebze', tat: 'hafif' });
const doyurucu = run('Kırmızı et · doyurucu', { 'ana-malzeme': 'kirmizi-et', tat: 'doyurucu' });
const tekTencere = run('Çorba · tek tencere', { 'ana-malzeme': 'corba', yontem: 'tek-tencere' });
const azMalzeme = run('Tavuk · az malzemeli', { 'ana-malzeme': 'tavuk', emek: 'az-malzeme' });

// ── Denetimler ─────────────────────────────────────────────────────

console.log('\n════ DENETİM');

const aciliOk = acili.slice(0, 10).filter((r) => ['acili', 'cok-acili'].includes(heatLevel(r.recipe)));
check(
  acili.length > 0 && aciliOk.length >= 8,
  `acılı istendi, ilk 10'un ${aciliOk.length}'i gerçekten acı`,
);

const hafifKcal = hafif.slice(0, 10).map((r) => nutritionOf(r.recipe).kcal);
const hafifOrt = hafifKcal.reduce((a, b) => a + b, 0) / Math.max(1, hafifKcal.length);
check(hafif.length > 0 && hafifOrt <= 450, `hafif istendi, ilk 10 ortalama ${Math.round(hafifOrt)} kcal`);

const doyKcal = doyurucu.slice(0, 10).map((r) => nutritionOf(r.recipe).kcal);
const doyOrt = doyKcal.reduce((a, b) => a + b, 0) / Math.max(1, doyKcal.length);
check(doyurucu.length > 0 && doyOrt >= 550, `doyurucu istendi, ilk 10 ortalama ${Math.round(doyOrt)} kcal`);
check(doyOrt > hafifOrt + 200, `doyurucu ile hafif arasında ${Math.round(doyOrt - hafifOrt)} kcal fark var`);

const potOk = tekTencere.slice(0, 10).filter((r) => isOnePot(r.recipe));
check(tekTencere.length > 0 && potOk.length >= 8, `tek tencere istendi, ilk 10'un ${potOk.length}'i tek tencere`);

const azOk = azMalzeme.slice(0, 10).filter((r) => ingredientCount(r.recipe) <= 8);
check(azMalzeme.length > 0 && azOk.length >= 8, `az malzeme istendi, ilk 10'un ${azOk.length}'i 8 malzemeyi geçmiyor`);

// Hiçbir cevap boş liste üretmemeli — filtre puanlama, eleme değil.
const combos: [string, FilterAnswers][] = [
  ['tavuk + hafif + 20 dk', { 'ana-malzeme': 'tavuk', tat: 'hafif', sure: '20' }],
  ['balık + acılı + fırın', { 'ana-malzeme': 'balik', tat: 'baharatli', yontem: 'firin' }],
  ['sebze + tek tencere + 20 dk', { 'ana-malzeme': 'sebze', yontem: 'tek-tencere', sure: '20' }],
  ['çorba + hafif + az malzeme', { 'ana-malzeme': 'corba', tat: 'hafif', emek: 'az-malzeme' }],
];
console.log('');
for (const [label, a] of combos) {
  const n = filterRecipes(a, 40).length;
  check(n >= 5, `"${label}" → ${n} tarif`);
}

const protein = run('Tavuk · protein ağırlıklı', {
  'ana-malzeme': 'tavuk',
  hedef: 'yuksek-protein',
});
const azKarb = run('Kırmızı et · az karbonhidrat', {
  'ana-malzeme': 'kirmizi-et',
  hedef: 'dusuk-karbonhidrat',
});

const proteinOk = protein.slice(0, 10).filter((r) => nutritionOf(r.recipe).protein >= 25);
console.log('');
check(proteinOk.length >= 8, `protein hedefi: ilk 10'un ${proteinOk.length}'i 25 g üstünde`);

const karbOk = azKarb.slice(0, 10).filter((r) => {
  const n = nutritionOf(r.recipe);
  const t = n.protein + n.carbs + n.fat;
  return t > 0 && n.carbs / t <= 0.4;
});
check(karbOk.length >= 8, `az karbonhidrat: ilk 10'un ${karbOk.length}'i %40 altında`);


// ── Seçkiler ──────────────────────────────────────────────────────

console.log('');
console.log('════ ÖZEL SEÇKİLER');
for (const c of COLLECTIONS) {
  const n = RECIPES.filter((r) => c.match(r)).length;
  const ilk = filterRecipes({ koleksiyon: c.id }, 3);
  console.log(`  ${c.labelTr.padEnd(18)} ${String(n).padStart(5)} tarif · ${ilk.map((r) => r.recipe.title.slice(0, 22)).join(' · ')}`);
  // Bir seçki raf olmalı, çıkmaz sokak değil.
  check(n >= 100, `${c.labelTr}: ${n} tarif`);
}

/* Seçki sert süzgeç: dışındaki tarif listeye sızmamalı. */
const hizliSonuc = filterRecipes({ koleksiyon: 'hizli' }, 40);
check(
  hizliSonuc.every((r) => r.recipe.totalMinutes <= 15),
  `"15 dakikadan az" listesindeki ${hizliSonuc.length} tarifin hepsi 15 dk altında`,
);

const etsizSonuc = filterRecipes({ koleksiyon: 'etsiz' }, 40);
check(
  etsizSonuc.every((r) => !hasAnimalProduct(r.recipe)),
  `"Etsiz" listesinde hayvansal ürün yok (${etsizSonuc.length} tarif)`,
);

/* Sağlıklı seçkisi gerçekten sebze ağırlıklı mı? */
const saglikli = filterRecipes({ koleksiyon: 'saglikli' }, 20);
const sebzeliOk = saglikli.slice(0, 10).filter((r) => plantShare(r.recipe) >= 0.3);
check(sebzeliOk.length >= 9, `sağlıklı seçkisi: ilk 10'un ${sebzeliOk.length}'i en az üçte bir sebze`);

/* Ana malzemeye özel ayrıntı */
const but = filterRecipes({ 'ana-malzeme': 'tavuk', detay: 'tavuk-but' }, 20);
const butOk = but.slice(0, 10).filter((r) => r.recipe.allSlugs.includes('tavuk-but'));
check(butOk.length >= 9, `tavuk + but: ilk 10'un ${butOk.length}'i but içeriyor`);

const kiyma = filterRecipes({ 'ana-malzeme': 'kirmizi-et', detay: 'et-kiyma' }, 20);
const kiymaOk = kiyma.slice(0, 10).filter((r) =>
  ['dana-kiyma', 'kuzu-kiyma'].some((sl) => r.recipe.allSlugs.includes(sl)),
);
check(kiymaOk.length >= 9, `kırmızı et + kıyma: ilk 10'un ${kiymaOk.length}'i kıymalı`);


// ── Çeşitlilik: aynı cevaplar, farklı tur ─────────────────────────

console.log('');
console.log('════ ÇEŞİTLİLİK (aynı cevaplar, ardışık turlar)');
const ayni: FilterAnswers = { 'ana-malzeme': 'tavuk', tat: 'hafif', sure: '45' };

const shown: Record<string, number> = {};
const turlar: string[][] = [];
for (let tur = 1; tur <= 3; tur += 1) {
  const res = filterRecipes(ayni, 40, { seed: tur, shown });
  turlar.push(res.slice(0, 5).map((r) => r.recipe.slug));
  for (const s of res.slice(0, 10)) shown[s.recipe.slug] = (shown[s.recipe.slug] ?? 0) + 1;
  console.log(`  ${tur}. tur: ${res.slice(0, 3).map((r) => r.recipe.title.slice(0, 26)).join(' · ')}`);
}

const kesisim = turlar[0].filter((x) => turlar[1].includes(x)).length;
console.log('');
check(kesisim <= 2, `1. ve 2. tur ilk beşinde ${kesisim} ortak tarif (5 üzerinden)`);
check(
  turlar[0].join() !== turlar[1].join() && turlar[1].join() !== turlar[2].join(),
  'her tur farklı sıralama üretiyor',
);

/* Tazelik kaliteyi bozmamalı: üçüncü turda da sonuçlar hâlâ tavuklu olmalı. */
const ucuncu = filterRecipes(ayni, 10, { seed: 3, shown });
const ucuncuTavuk = ucuncu.filter((r) =>
  ['tavuk-but', 'tavuk-gogsu', 'hindi', 'bildircin'].some((sl) => r.recipe.allSlugs.includes(sl)),
);
check(ucuncuTavuk.length >= 8, `3. turda ilk ${ucuncu.length} sonucun ${ucuncuTavuk.length}'i hâlâ tavuklu`);

console.log(`\n  korpus: ${RECIPES.length} tarif`);
console.log(fail ? `\n${fail} denetim başarısız\n` : '\nTüm denetimler geçti\n');
process.exit(fail ? 1 : 0);
