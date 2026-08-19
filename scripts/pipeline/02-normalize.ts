/**
 * Adım 2 — ham dosyaları normalize et ve doğrula.
 *
 *   npm run data:normalize
 *
 * Çıktı: data-build/*.json
 *
 * Kritik iş: üçlü TSV seti (bipartit veri) makalenin Springer'daki kenar
 * listesine karşı çapraz doğrulanıyor. `ingr_comp.tsv`'den kenar ağırlıkları
 * yeniden hesaplanıp s2 ile karşılaştırılıyor; tek fark çıkarsa hata veriyor.
 * Böylece ayna kaynağın sadakati her çalıştırmada kanıtlanmış oluyor.
 */

import fs from 'node:fs';

import { BUILD_DIR, build, raw } from './sources.ts';

fs.mkdirSync(BUILD_DIR, { recursive: true });

const lines = (file: string) =>
  fs
    .readFileSync(raw(file), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.length > 0 && !l.startsWith('#'));

// ── Malzemeler ─────────────────────────────────────────────────────

export interface AhnIngredient {
  id: number;
  name: string;
  category: string;
}

const ingredients: AhnIngredient[] = lines('ingr_info.tsv').map((l) => {
  const [id, name, category] = l.split('\t');
  return { id: Number(id), name, category };
});

// ── Bileşikler ─────────────────────────────────────────────────────

export interface AhnCompound {
  id: number;
  name: string;
  cas: string;
}

const compounds: AhnCompound[] = lines('comp_info.tsv').map((l) => {
  const [id, name, cas] = l.split('\t');
  return { id: Number(id), name, cas: cas ?? '' };
});

// ── Bipartit bağlar ────────────────────────────────────────────────

const compoundsByIngredient = new Map<number, number[]>();
let linkCount = 0;

for (const l of lines('ingr_comp.tsv')) {
  const [a, b] = l.split(/\s+/);
  const ing = Number(a);
  const comp = Number(b);
  const list = compoundsByIngredient.get(ing);
  if (list) list.push(comp);
  else compoundsByIngredient.set(ing, [comp]);
  linkCount += 1;
}

// ── Tarif korpusu ──────────────────────────────────────────────────

const recipes: { cuisine: string; ingredients: string[] }[] = [];
const recipeFreq = new Map<string, number>();
const cuisineCount = new Map<string, number>();

for (const l of lines('srep00196-s3.csv')) {
  const parts = l.split(',').filter(Boolean);
  const cuisine = parts[0];
  const items = parts.slice(1);
  recipes.push({ cuisine, ingredients: items });
  cuisineCount.set(cuisine, (cuisineCount.get(cuisine) ?? 0) + 1);
  for (const it of items) recipeFreq.set(it, (recipeFreq.get(it) ?? 0) + 1);
}

// ── Çapraz doğrulama: bipartit veri → s2 kenar ağırlıkları ─────────

const byName = new Map(ingredients.map((i) => [i.name, i.id]));
const compSets = new Map<number, Set<number>>();
for (const [id, list] of compoundsByIngredient) compSets.set(id, new Set(list));

let checked = 0;
let mismatched = 0;
const mismatchExamples: string[] = [];

for (const l of lines('srep00196-s2.csv')) {
  const idx = l.lastIndexOf(',');
  const weight = Number(l.slice(idx + 1));
  const pair = l.slice(0, idx);
  const cut = pair.lastIndexOf(',');
  const a = byName.get(pair.slice(0, cut));
  const b = byName.get(pair.slice(cut + 1));
  if (a == null || b == null) continue;

  const sa = compSets.get(a);
  const sb = compSets.get(b);
  if (!sa || !sb) continue;

  let shared = 0;
  for (const c of sa) if (sb.has(c)) shared += 1;

  checked += 1;
  if (shared !== weight) {
    mismatched += 1;
    if (mismatchExamples.length < 5) {
      mismatchExamples.push(`${pair}: s2=${weight} hesap=${shared}`);
    }
  }
}

console.log(`çapraz doğrulama: ${checked} kenar kontrol edildi, ${mismatched} uyuşmazlık`);
for (const e of mismatchExamples) console.log(`  ${e}`);

if (mismatched > 0) {
  throw new Error(
    'Bipartit veri Springer kenar listesiyle uyuşmuyor — ayna kaynak bozuk olabilir. ' +
      'Bu haldeki veriyle devam etmek yanlış eşleşmeler üretir.',
  );
}

// ── Yaz ────────────────────────────────────────────────────────────

const payload = {
  ingredients: ingredients.map((i) => ({
    ...i,
    compoundIds: compoundsByIngredient.get(i.id) ?? [],
    recipeCount: recipeFreq.get(i.name) ?? 0,
  })),
  compounds,
  stats: {
    ingredients: ingredients.length,
    withCompounds: compoundsByIngredient.size,
    compounds: compounds.length,
    links: linkCount,
    recipes: recipes.length,
    cuisines: Object.fromEntries([...cuisineCount].sort((a, b) => b[1] - a[1])),
    /** Tariflerde hiç geçmeyen malzemeler — aroma endüstrisi botanikleri. */
    neverInRecipe: ingredients.filter((i) => !recipeFreq.has(i.name)).length,
  },
};

fs.writeFileSync(build('ahn.json'), JSON.stringify(payload));
fs.writeFileSync(
  build('recipes.json'),
  JSON.stringify({ recipes, freq: Object.fromEntries(recipeFreq) }),
);

console.log('\n── ÖZET');
for (const [k, v] of Object.entries(payload.stats)) {
  if (typeof v === 'object') continue;
  console.log(`  ${k.padEnd(16)} ${v}`);
}
console.log('\n  mutfak dağılımı:');
for (const [c, n] of Object.entries(payload.stats.cuisines)) {
  console.log(`    ${String(n).padStart(6)}  ${c}`);
}
console.log(`\ndata-build/ahn.json + recipes.json yazıldı`);
