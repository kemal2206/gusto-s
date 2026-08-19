/**
 * Sızıntı denetimi — "makarna istedim, pizza geldi".
 *
 *   npm run smoke:sizinti
 *
 * Her seçenek için ayrı ayrı soruyor: **kullanıcı bunu seçtiğinde gelen ilk
 * 20 tarif gerçekten bu mu?**
 *
 * Kritik nokta: doğrulama ölçütü filtrenin kendi kuralından **bağımsız**
 * yazıldı. Aynı kuralı kullansaydık test kendi kendini onaylar, "makarna"
 * kuralı "tahıl içeren her şey" olduğu için pizzayı da doğru sayardı.
 * Buradaki ölçütler kullanıcının niyetini anlatıyor: makarna istedim demek,
 * tabakta makarna var demek.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import { RECIPES, type Recipe } from '../src/data/recipes/index.ts';
import { COLLECTIONS } from '../src/lib/koleksiyon.ts';
import { filterRecipes, type FilterAnswers } from '../src/lib/recipe-filter.ts';
import { dishTaste, heatLevel, ingredientCount, isOnePot } from '../src/lib/recipe-taste.ts';
import { nutritionOf } from '../src/lib/recipe-facts.ts';

const BY = new Map(INGREDIENTS.map((i) => [i.slug, i]));

/** Bir malzeme kümesinin tabaktaki gram payı — su sayılmıyor. */
function share(recipe: Recipe, test: (slug: string) => boolean): number {
  let hit = 0;
  let total = 0;
  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      if (ri.slug === 'su' || ri.slug === 'et-suyu' || ri.slug === 'tavuk-suyu') continue;
      total += ri.grams;
      if (test(ri.slug)) hit += ri.grams;
    }
  }
  return total > 0 ? hit / total : 0;
}

const cat = (slug: string) => BY.get(slug)?.category ?? '';
const has = (r: Recipe, slugs: string[]) => slugs.some((s) => r.allSlugs.includes(s));
const hasCat = (r: Recipe, cats: string[]) => r.allSlugs.some((s) => cats.includes(cat(s)));

const TAVUK = ['tavuk-but', 'tavuk-gogsu', 'hindi', 'bildircin'];
const KIRMIZI = [
  'kuzu-but', 'kuzu-pirzola', 'kuzu-incik', 'kuzu-kiyma', 'dana-antrikot',
  'dana-kusbasi', 'dana-kiyma', 'dana-kaburga', 'kavurma', 'kuzu-cigeri',
];
const MAKARNA = ['makarna', 'eriste', 'sehriye', 'arpa-sehriye', 'pirinc-eristesi', 'ramen-eristesi', 'kuskus'];

interface Case {
  label: string;
  answers: FilterAnswers;
  /** Kullanıcının niyetini anlatan bağımsız ölçüt. */
  ok: (r: Recipe) => boolean;
  /** İlk 20'de en az kaçı tutmalı. */
  min?: number;
}

const CASES: Case[] = [
  // ── Ana malzeme ──────────────────────────────────────────────────
  {
    label: 'Tavuk',
    answers: { 'ana-malzeme': 'tavuk' },
    ok: (r) => share(r, (s) => TAVUK.includes(s)) >= 0.1,
  },
  {
    label: 'Kırmızı et',
    answers: { 'ana-malzeme': 'kirmizi-et' },
    ok: (r) => share(r, (s) => KIRMIZI.includes(s)) >= 0.1,
  },
  {
    label: 'Balık',
    answers: { 'ana-malzeme': 'balik' },
    ok: (r) => share(r, (s) => cat(s) === 'deniz') >= 0.1,
  },
  {
    label: 'Sebze',
    answers: { 'ana-malzeme': 'sebze' },
    ok: (r) =>
      !hasCat(r, ['protein', 'deniz', 'sarkuteri']) &&
      share(r, (s) => ['sebze', 'mantar', 'baklagil'].includes(cat(s))) >= 0.25,
  },
  {
    label: 'Makarna ve pilav',
    answers: { 'ana-malzeme': 'hamur' },
    // Çorba bu kutuda olmamalı, şehriyesi olsa bile.
    ok: (r) => r.categoryId !== 'corba' && (has(r, MAKARNA) || r.categoryId === 'pilav-makarna'),
  },
  {
    label: 'Çorba',
    answers: { 'ana-malzeme': 'corba' },
    ok: (r) => r.categoryId === 'corba',
  },

  // ── Ana malzemeye özel ayrıntı ───────────────────────────────────
  {
    label: 'Tavuk · but',
    answers: { 'ana-malzeme': 'tavuk', detay: 'tavuk-but' },
    ok: (r) => r.allSlugs.includes('tavuk-but'),
  },
  {
    label: 'Tavuk · göğüs',
    answers: { 'ana-malzeme': 'tavuk', detay: 'tavuk-gogus' },
    ok: (r) => r.allSlugs.includes('tavuk-gogsu'),
  },
  {
    label: 'Et · kıyma',
    answers: { 'ana-malzeme': 'kirmizi-et', detay: 'et-kiyma' },
    ok: (r) => has(r, ['dana-kiyma', 'kuzu-kiyma']),
  },
  {
    label: 'Et · parça',
    answers: { 'ana-malzeme': 'kirmizi-et', detay: 'et-parca' },
    ok: (r) => has(r, ['dana-kusbasi', 'kuzu-but', 'dana-antrikot', 'kuzu-pirzola', 'kuzu-incik', 'dana-kaburga']),
  },
  {
    label: 'Balık · küçük',
    answers: { 'ana-malzeme': 'balik', detay: 'balik-kucuk' },
    ok: (r) => has(r, ['hamsi', 'uskumru', 'palamut']),
  },
  {
    label: 'Balık · beyaz',
    answers: { 'ana-malzeme': 'balik', detay: 'balik-beyaz' },
    ok: (r) => has(r, ['levrek', 'cipura', 'alabalik']),
  },
  {
    label: 'Deniz · kabuklu',
    answers: { 'ana-malzeme': 'balik', detay: 'deniz-kabuklu' },
    ok: (r) => has(r, ['karides', 'midye', 'kalamar']),
  },
  {
    label: 'Sebze · patlıcan',
    answers: { 'ana-malzeme': 'sebze', detay: 'sebze-patlican' },
    ok: (r) => r.allSlugs.includes('patlican'),
  },
  {
    label: 'Sebze · mantar',
    answers: { 'ana-malzeme': 'sebze', detay: 'sebze-mantar' },
    ok: (r) => hasCat(r, ['mantar']),
  },
  {
    label: 'Çorba · mercimek',
    answers: { 'ana-malzeme': 'corba', detay: 'corba-mercimek' },
    ok: (r) => r.categoryId === 'corba' && has(r, ['kirmizi-mercimek', 'yesil-mercimek']),
  },
  {
    label: 'Çorba · yoğurtlu',
    answers: { 'ana-malzeme': 'corba', detay: 'corba-yogurtlu' },
    ok: (r) => r.categoryId === 'corba' && has(r, ['yogurt', 'suzme-yogurt', 'tarhana']),
  },
  {
    label: 'Hamur · makarna',
    answers: { 'ana-malzeme': 'hamur', detay: 'hamur-makarna' },
    ok: (r) => has(r, MAKARNA),
  },
  {
    label: 'Hamur · pilav',
    answers: { 'ana-malzeme': 'hamur', detay: 'hamur-pilav' },
    ok: (r) => has(r, ['pirinc', 'bulgur', 'ince-bulgur']),
  },


  // ── Tat ve acılık ────────────────────────────────────────────────
  {
    label: 'Acılı',
    answers: { tat: 'baharatli' },
    ok: (r) => ['acili', 'cok-acili'].includes(heatLevel(r)),
  },
  {
    label: 'Acılı · iyice acı',
    answers: { tat: 'baharatli', acilik: 'cok-aci' },
    ok: (r) => ['acili', 'cok-acili'].includes(heatLevel(r)),
  },
  {
    label: 'Tatlımsı',
    answers: { tat: 'tatli' },
    ok: (r) => r.categoryId === 'tatli' || dishTaste(r).sweet >= 4,
  },
  {
    label: 'Hafif ve taze',
    answers: { tat: 'hafif' },
    ok: (r) => {
      const k = nutritionOf(r).kcal;
      return k > 0 && k <= 500 && dishTaste(r).fat <= 3.5;
    },
  },
  {
    label: 'Doyurucu',
    answers: { tat: 'doyurucu' },
    ok: (r) => nutritionOf(r).kcal >= 500,
  },

  // ── Hedef ────────────────────────────────────────────────────────
  {
    label: 'Hedef · hafif',
    answers: { hedef: 'hafif' },
    ok: (r) => {
      const k = nutritionOf(r).kcal;
      return k > 0 && k <= 450;
    },
  },
  {
    label: 'Hedef · protein',
    answers: { hedef: 'yuksek-protein' },
    ok: (r) => nutritionOf(r).protein >= 25,
  },
  {
    label: 'Hedef · az karbonhidrat',
    answers: { hedef: 'dusuk-karbonhidrat' },
    ok: (r) => {
      const n = nutritionOf(r);
      const t = n.protein + n.carbs + n.fat;
      return t > 0 && n.carbs / t <= 0.4;
    },
  },

  // ── Emek ve yöntem ───────────────────────────────────────────────
  { label: 'Az malzemeli', answers: { emek: 'az-malzeme' }, ok: (r) => ingredientCount(r) <= 8 },
  {
    label: 'Kısa tarif',
    answers: { emek: 'az-adim' },
    ok: (r) => r.components.reduce((n, c) => n + c.steps.length, 0) <= 7,
  },
  { label: 'Tek tencerede', answers: { yontem: 'tek-tencere' }, ok: isOnePot },
  {
    label: 'Fırında',
    answers: { yontem: 'firin' },
    ok: (r) => r.components.some((c) => c.method === 'firin'),
  },
  {
    label: 'Izgarada',
    answers: { yontem: 'izgara' },
    ok: (r) => r.components.some((c) => c.method === 'izgara' || c.method === 'komur'),
  },

  // ── Süre ─────────────────────────────────────────────────────────
  { label: '20 dakika', answers: { sure: '20' }, ok: (r) => r.totalMinutes <= 20 },
  { label: 'Yarım saat', answers: { sure: '45' }, ok: (r) => r.totalMinutes <= 45 },
];

// Seçkiler kendi ölçütleriyle sınanıyor — sert süzgeç oldukları için %100 tutmalı.
for (const c of COLLECTIONS) {
  CASES.push({
    label: `Seçki · ${c.labelTr}`,
    answers: { koleksiyon: c.id },
    ok: (r) => c.match(r),
    min: 20,
  });
}

// ── Çalıştır ───────────────────────────────────────────────────────

const TOP = 20;
let fail = 0;

console.log('\n════ SIZINTI DENETİMİ');
console.log(`  Her seçenek için ilk ${TOP} sonuç, bağımsız ölçütle sınanıyor.\n`);

for (const c of CASES) {
  const res = filterRecipes(c.answers, TOP);
  const list = res.slice(0, TOP);
  const bad = list.filter((r) => !c.ok(r.recipe));
  const need = c.min ?? Math.ceil(TOP * 0.85);
  const good = list.length - bad.length;
  const pass = list.length > 0 && good >= Math.min(need, list.length);

  if (!pass) fail += 1;

  console.log(
    `  ${pass ? '✓' : '✗'} ${c.label.padEnd(24)} ${String(good).padStart(2)}/${String(list.length).padStart(2)}` +
      (bad.length ? `   sızan: ${bad.slice(0, 3).map((b) => b.recipe.title.slice(0, 26)).join(' · ')}` : ''),
  );
}

console.log(`\n  ${CASES.length} senaryo · ${fail} sızıntı\n`);
console.log(`  korpus: ${RECIPES.length} tarif\n`);
process.exit(fail ? 1 : 0);
