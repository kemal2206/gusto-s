/**
 * yemek.com korpusunun süzgeçlerden geçtiğini denetler.
 *
 *   npm run smoke:yemekcom
 *
 * 536 tarifi kataloğa eklemek yetmiyor; asıl soru bu tariflerin uygulamanın
 * her süzgecinde doğru davranıp davranmadığı. Burada beş yol ayrı ayrı
 * yürütülüyor: kategori, kiler eşleşmesi, "canım ne istiyor", diyet profili
 * ve sağlık eliminasyonu.
 *
 * **Bu testin asıl derdi özet alanı.** Eski korpusta `summary` ilk pişirme
 * adımının kopyasıydı; yeni korpusta insan eliyle yazılmış bir tanıtım
 * cümlesi. Diyet süzgeci ada olduğu kadar özete de regex uyguluyor
 * (`profile-filter.ts` içindeki NAME_BLOCK) — çünkü içe aktarılan korpusta
 * malzeme listesi hep dürüst değil. Uzun ve serbest bir özet bu güvenlik
 * ağını yanlış tetikleyebilir: "yanında et yemeklerine de yakışır" diyen
 * sebze yemeği vejetaryene gösterilmez olur. Aşağıda bu sızıntı sayılıyor.
 */

import { BY_SLUG } from '../src/data/catalog/index.ts';
import { ELIMINATIONS } from '../src/data/catalog/eliminasyon.ts';
import { ITHAL_YEMEKCOM } from '../src/data/recipes/ithal-yemekcom.ts';
import {
  matchPantry,
  RECIPE_BY_SLUG,
  RECIPES,
  recipesByCategory,
  DISH_CATEGORIES,
} from '../src/data/recipes/index.ts';
import { isAllowed, type ProfileFilter } from '../src/lib/profile-filter.ts';
import { filterRecipes, type FilterAnswers } from '../src/lib/recipe-filter.ts';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

/** Katalogda gerçekten yer bulan yemek.com tarifleri. */
const YC = new Set(
  ITHAL_YEMEKCOM.map((r) => r.s).filter((s) => {
    const inCatalog = RECIPE_BY_SLUG.get(s);
    // Elle yazılan bir tarif aynı slug'ı kapmışsa bu kayıt katalogda değil.
    return inCatalog && inCatalog.imageUrl;
  }),
);
const ycRecipes = [...YC].map((s) => RECIPE_BY_SLUG.get(s)!);

// ── 1. Aktarım bütünlüğü ───────────────────────────────────────────

console.log('\n════ 1. AKTARIM');
console.log(`  üretilen:   ${ITHAL_YEMEKCOM.length}`);
console.log(`  katalogda:  ${YC.size}`);
console.log(`  toplam tarif: ${RECIPES.length}`);

check(YC.size > 500, `${YC.size} tarif katalogda (>500 bekleniyor)`);
check(
  ycRecipes.every((r) => r.imageUrl?.startsWith('https://')),
  'hepsinin fotoğrafı https adresi',
);
check(
  ycRecipes.every((r) => r.components.some((c) => c.steps.length > 0)),
  'hepsinde pişirme adımı var',
);
check(
  ycRecipes.every((r) => r.servings >= 1 && r.servings <= 24),
  'porsiyon 1–24 aralığında',
);
check(
  ycRecipes.every((r) => r.totalMinutes >= 5 && r.totalMinutes <= 480),
  'süre 5 dk – 8 saat aralığında',
);

/**
 * Özet gerçekten ayrı bir metin mi, yoksa yine ilk adımın kopyası mı?
 * Eski korpusun tek gerçek kusuru buydu; yenisini almanın sebebi de bu.
 */
const echoed = ycRecipes.filter((r) => {
  const first = r.components[0]?.steps[0] ?? '';
  return first.slice(0, 40) === r.summary.slice(0, 40);
});
check(echoed.length < YC.size * 0.05, `özet ilk adımın kopyası değil (${echoed.length} istisna)`);

const realServings = ycRecipes.filter((r) => r.servings !== 4).length;
console.log(`  varsayılan 4 olmayan porsiyon: ${realServings}`);

// ── 2. Kategori süzgeci ────────────────────────────────────────────

console.log('\n════ 2. KATEGORİ SÜZGECİ');
let emptyCats = 0;
for (const c of DISH_CATEGORIES) {
  const all = recipesByCategory(c.id);
  const mine = all.filter((r) => YC.has(r.slug)).length;
  if (all.length === 0) emptyCats += 1;
  console.log(`  ${c.labelTr.padEnd(22)} ${String(all.length).padStart(4)}  (yemek.com: ${mine})`);
}
check(emptyCats === 0, 'boş kategori yok');

/**
 * Yeni korpusun asıl kazancı ince kategorilerdeydi: deniz, zeytinyağlı,
 * içecek ve dolma-sarma raflarında tarif sayısı listeyi doldurmuyordu.
 */
for (const id of ['deniz', 'zeytinyagli', 'dolma-sarma', 'pilav-makarna']) {
  const n = recipesByCategory(id).length;
  check(n >= 39, `${id} rafında ${n} tarif var`);
}

// ── 3. Kiler eşleşmesi ─────────────────────────────────────────────

console.log('\n════ 3. KİLER EŞLEŞMESİ');
const pantries: [string, string[]][] = [
  ['tavuk + sebze', ['tavuk-gogsu', 'kuru-sogan', 'domates', 'sarimsak', 'zeytinyagi', 'patates']],
  ['balık', ['levrek', 'limon', 'zeytinyagi', 'maydanoz', 'kuru-sogan']],
  ['bakliyat', ['kirmizi-mercimek', 'kuru-sogan', 'havuc', 'patates', 'tereyagi']],
];
for (const [label, slugs] of pantries) {
  const res = matchPantry(new Set(slugs));
  const mine = res.filter((m) => YC.has(m.recipe.slug));
  console.log(`  ${label.padEnd(16)} ${String(res.length).padStart(4)} eşleşme, ilki: ${res[0]?.recipe.title}`);
  check(res.length > 0 && mine.length > 0, `${label}: yemek.com tarifleri de eşleşiyor (${mine.length})`);
}

// ── 4. "Canım ne istiyor" süzgeci ──────────────────────────────────

console.log('\n════ 4. KEŞFET SÜZGECİ');
const answerSets: [string, FilterAnswers][] = [
  ['kırmızı et, doyurucu', { 'ana-malzeme': 'kirmizi-et', tat: 'doyurucu' }],
  ['tavuk, fırında', { 'ana-malzeme': 'tavuk', yontem: 'firin' }],
  ['balık', { 'ana-malzeme': 'balik' }],
  ['sebze, hafif', { 'ana-malzeme': 'sebze', tat: 'hafif' }],
  ['çorba, mercimekli', { 'ana-malzeme': 'corba', detay: 'corba-mercimek' }],
  ['20 dakika, az malzeme', { sure: '20', emek: 'az-malzeme' }],
  ['acılı', { tat: 'baharatli', acilik: 'cok-aci' }],
];
for (const [label, ans] of answerSets) {
  const res = filterRecipes(ans, 30);
  const mine = res.filter((r) => YC.has(r.recipe.slug));
  console.log(`  ${label.padEnd(16)} ${String(res.length).padStart(3)} sonuç, ${mine.length} tanesi yemek.com`);
  check(res.length > 0, `${label}: sonuç dönüyor`);
}

// ── 5. Diyet profili ───────────────────────────────────────────────

console.log('\n════ 5. DİYET SÜZGECİ');
const base: ProfileFilter = { diets: [], dislikedSlugs: [], appliances: ['ocak', 'firin'] };
const ANIMAL = new Set(['protein', 'deniz', 'sarkuteri']);

for (const diet of ['vejetaryen', 'vegan', 'glutensiz'] as const) {
  const p = { ...base, diets: [diet] };
  const passed = ycRecipes.filter((r) => isAllowed(r, p));
  console.log(`  ${diet.padEnd(12)} ${String(passed.length).padStart(3)} / ${YC.size} geçti`);
  check(passed.length > 0, `${diet}: en az bir tarif geçiyor`);

  if (diet === 'vejetaryen' || diet === 'vegan') {
    const leaked = passed.filter((r) =>
      r.allSlugs.some((s) => ANIMAL.has(BY_SLUG.get(s)?.category ?? '')),
    );
    check(leaked.length === 0, `${diet}: hayvansal ürün sızmadı${leaked.length ? ` — ${leaked[0].title}` : ''}`);
  }
}

/**
 * Yanlış eleme ölçümü.
 *
 * Bir tarif malzemesinde et yokken, adında da et geçmezken yalnızca
 * ÖZETİNDEKİ bir kelime yüzünden eleniyorsa bu bir kayıp: yeni korpusun
 * uzun özeti güvenlik ağını gereksiz tetiklemiş demektir.
 */
const VEG_NAME =
  /\bet\b|etli|tavuk|piliç|hindi|kuzu|dana|balık|karides|midye|kalamar|hamsi|somon|uskumru|palamut|sucuk|pastırma|kıyma|köfte|kebap|ciğer/i;
const vejP = { ...base, diets: ['vejetaryen' as const] };
const falseBlocked = ycRecipes.filter(
  (r) =>
    !isAllowed(r, vejP) &&
    !r.allSlugs.some((s) => ANIMAL.has(BY_SLUG.get(s)?.category ?? '')) &&
    !VEG_NAME.test(r.title) &&
    VEG_NAME.test(r.summary),
);
console.log(`\n  yalnızca özeti yüzünden elenen etsiz tarif: ${falseBlocked.length}`);
for (const r of falseBlocked.slice(0, 6)) {
  console.log(`     ${r.title}  ←  "${r.summary.slice(0, 78)}…"`);
}
check(
  falseBlocked.length <= 12,
  `özet kaynaklı yanlış eleme 12'yi aşmıyor (${falseBlocked.length})`,
);

// ── 6. Sağlık eliminasyonu ─────────────────────────────────────────

console.log('\n════ 6. ELİMİNASYON SÜZGECİ');
for (const e of ELIMINATIONS) {
  const p = { ...base, eliminations: [e.id] };
  const passed = ycRecipes.filter((r) => isAllowed(r, p));
  const leaked = passed.filter((r) => e.slugs.some((s) => r.allSlugs.includes(s)));
  console.log(`  ${e.labelTr.padEnd(28)} ${String(passed.length).padStart(3)} / ${YC.size} geçti`);
  check(leaked.length === 0, `${e.labelTr}: yasaklı malzeme sızmadı`);
  check(passed.length > 0, `${e.labelTr}: geriye tarif kalıyor`);
}

// ── Sonuç ──────────────────────────────────────────────────────────

console.log(`\n${fail === 0 ? '✓ TÜM DENETİMLER GEÇTİ' : `✗ ${fail} DENETİM BAŞARISIZ`}\n`);
process.exit(fail === 0 ? 0 : 1);
