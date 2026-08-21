/**
 * Adım 5 — Türk tarif korpusunu içe aktar.
 *
 *   npm run data:tarif             kapsam raporu
 *   npm run data:tarif -- --write  src/data/recipes/ithal-tr.ts üret
 *
 * Kaynak: Kaggle `bit104/turkish-recipes-structured` — 3.320 Türk tarifi,
 * nefisyemektarifleri.com içeriğinden yapılandırılmış. Şeması bizimkine
 * neredeyse birebir uyuyor: kategori, süre, zorluk, pişirme yöntemi,
 * {isim, miktar, birim} malzemeler ve adım dizisi.
 *
 * İki iş yapıyor:
 *  1. Malzeme adlarını katalog slug'larına eşliyor (eş anlamlı + yazım hatası)
 *  2. Mutfak ölçülerini grama çeviriyor (su bardağı, yemek kaşığı, diş…)
 *
 * Malzemesinin %80'inden azı eşleşen tarif alınmıyor: eksik malzemeli tarif
 * hem yanlış görünüyor hem "elimde ne var" eşleştirmesini bozuyor.
 */


import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { refineCategory } from '../../src/data/recipes/ad-kurallari.ts';
import { sanePortions } from '../../src/data/recipes/kategoriler.ts';

import {
  ANIMAL_CATS,
  BY_SLUG,
  esc,
  grams,
  JUNK_TITLE,
  norm,
  NOT_FOOD,
  PROTEIN_GUARD,
  resolve,
  slugify,
} from './eslestirici.ts';
import { raw } from './sources.ts';

const write = process.argv.includes('--write');

const CATEGORY: Record<string, string> = {
  'ana yemek': 'etli-sulu', çorba: 'corba', salata: 'meze-salata',
  kahvaltı: 'kahvalti', tatlı: 'tatli', atıştırmalık: 'meze-salata',
  içecek: 'icecek', turşu: 'meze-salata',
};

const METHOD: Record<string, string> = {
  fırın: 'firin', tencere: 'sulu', tava: 'tava', haşlama: 'haslama',
  ızgara: 'izgara', kızartma: 'kizartma', kavurma: 'tava', ocak: 'tava',
  benmari: 'haslama', 'mutfak robotu': 'karistir', blender: 'karistir',
  'tost makinası': 'tava', buharda: 'buhar',
};

// ── İçe aktarma ────────────────────────────────────────────────────

interface Src {
  tarif_adi: string;
  kategori: string | null;
  porsiyon: number | null;
  hazirlik_suresi_dk: number | null;
  pisirme_suresi_dk: number | null;
  zorluk: string | null;
  pisirme_yontemi: string[] | null;
  malzemeler: { isim: string | null; miktar: number | null; birim: string | null }[] | null;
  yapilis_adimlari: string[] | null;
}


const src = JSON.parse(fs.readFileSync(raw('tr-recipes.json'), 'utf8')) as Src[];

const MIN_COVERAGE = 0.8;
const unmatched = new Map<string, number>();
const seenSlugs = new Set<string>();
const usedIngredients = new Set<string>();
const lines: string[] = [];
let taken = 0;
let skippedCoverage = 0;
let skippedEmpty = 0;
let skippedJunk = 0;
let skippedLie = 0;
let skippedAbsurd = 0;
let injected = 0;

for (const r of src) {
  if (JUNK_TITLE.test(r.tarif_adi ?? '')) {
    skippedJunk += 1;
    continue;
  }
  const steps = (r.yapilis_adimlari ?? []).filter((s) => s && s.trim().length > 5);
  const items = r.malzemeler ?? [];
  if (!steps.length || items.length < 2) {
    skippedEmpty += 1;
    continue;
  }

  const mapped: { slug: string; g: number }[] = [];
  /** Katalogda karşılığı olmayan malzeme adları — ada karşı denetlenecek. */
  const missing: string[] = [];
  let known = 0;
  let dropped = 0;

  for (const m of items) {
    if (!m.isim) continue;
    const s = resolve(m.isim);
    if (s === null) {
      dropped += 1;
      continue;
    }
    if (s === undefined) {
      const key = m.isim.toLocaleLowerCase('tr-TR');
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
      missing.push(norm(m.isim));
      continue;
    }
    known += 1;
    if (!mapped.some((x) => x.slug === s)) mapped.push({ slug: s, g: grams(s, m.miktar, m.birim) });
  }

  const denom = items.length - dropped;
  if (denom <= 0 || known / denom < MIN_COVERAGE || mapped.length < 2) {
    skippedCoverage += 1;
    continue;
  }

  /**
   * Ad, tabakta olmayan bir malzemeyi söylüyor mu?
   *
   * "Kinoa Salatası" tarifinde kinoa yoktu: katalogda kinoa bulunmadığı için
   * satır düştü, kalan 10 malzeme kapsam eşiğini tutturdu ve ortaya kinoasız
   * bir kinoa salatası çıktı. Eşleşmeyen bir malzemenin adı tarif adında
   * geçiyorsa tarif kendini yanlış tanıtıyor demektir — almıyoruz.
   */
  const title = norm(r.tarif_adi);
  const liesInName = missing.some((mi) =>
    mi.split(' ').some((w) => w.length >= 4 && !NOT_FOOD.has(w) && title.includes(w)),
  );
  if (liesInName) {
    skippedLie += 1;
    continue;
  }

  // Adı ana malzemeyi söylüyorsa tabakta gerçekten var mı?
  if (!mapped.some((m) => ANIMAL_CATS.has(BY_SLUG.get(m.slug)?.category ?? ''))) {
    const guard = PROTEIN_GUARD.find(
      (g) => g.re.test(r.tarif_adi) && !(g.not && g.not.test(r.tarif_adi)),
    );
    if (guard) {
      mapped.unshift({ slug: guard.slug, g: guard.g });
      injected += 1;
    }
  }

  /**
   * İmkânsız miktar denetimi.
   *
   * Korpusta "44 kg un" içeren bir poğaça tarifi vardı: kaynaktaki miktar
   * alanı bozuk ve doğrusunu bilmenin yolu yok. Kırpmak uydurma olurdu,
   * bu yüzden tarifi hiç almıyoruz. Beş tarif kaybediyoruz; karşılığında
   * besin, ölçü ve maliyet hesapları bu tariflerle zehirlenmiyor.
   */
  if (mapped.some((m) => m.g > 5000)) {
    skippedAbsurd += 1;
    continue;
  }

  const slug = slugify(r.tarif_adi);
  if (!slug || seenSlugs.has(slug)) continue;
  seenSlugs.add(slug);

  /**
   * Korpusta süre alanı güvenilmez: "1 dk"lık kek tarifleri var. 5 dakikanın
   * altını ve 8 saatin üstünü veri hatası sayıp adım sayısından tahmin ediyoruz.
   */
  const rawMins = (r.hazirlik_suresi_dk ?? 0) + (r.pisirme_suresi_dk ?? 0);
  const mins = rawMins >= 5 && rawMins <= 480 ? Math.round(rawMins) : Math.min(120, 10 + steps.length * 6);
  const method = METHOD[norm((r.pisirme_yontemi ?? [])[0] ?? '')] ?? 'tava';
  const cat = refineCategory(r.tarif_adi, CATEGORY[norm(r.kategori ?? '')] ?? 'etli-sulu');
  const diff = r.zorluk === 'zor' ? 3 : r.zorluk === 'orta' ? 2 : 1;

  /**
   * Porsiyon gramajla tutuyor mu? Kaynakta porsiyon 3.320 tarifin yalnızca
   * 68'inde dolu; kalanı 4 varsayılıyor ve tepsi tatlılarında bu saçma
   * porsiyonlar üretiyordu.
   */
  const totalGrams = mapped.reduce((a, m) => a + m.g, 0);
  const servings = sanePortions(cat, totalGrams, r.porsiyon ?? 4);

  for (const m of mapped) usedIngredients.add(m.slug);
  taken += 1;

  lines.push(
    `  { s: '${slug}', n: '${esc(r.tarif_adi)}', c: '${cat}', m: ${mins}, d: ${diff}, ` +
      `srv: ${servings}, me: '${method}',\n` +
      `    sum: '${esc(steps[0]).slice(0, 110)}',\n` +
      `    ing: [${mapped.map((m) => `['${m.slug}', ${m.g}]`).join(', ')}],\n` +
      `    st: [${steps.slice(0, 8).map((s) => `'${esc(s)}'`).join(', ')}] },`,
  );
}

console.log('\n════ TÜRK TARİF KORPUSU ════');
console.log(`  kaynak:             ${src.length}`);
console.log(`  alınan:             ${taken}`);
console.log(`  atlandı (kapsam):   ${skippedCoverage}`);
console.log(`  atlandı (boş/eksik):${skippedEmpty}`);
console.log(`  atlandı (sağlık iddiası): ${skippedJunk}`);
console.log(`  atlandı (adı malzemesini tutmuyor): ${skippedLie}`);
console.log(`  atlandı (imkânsız miktar): ${skippedAbsurd}`);
console.log(`  ana malzemesi eklendi: ${injected}`);
console.log(`  kullanılan malzeme: ${usedIngredients.size} / ${INGREDIENTS.length}`);

const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(`\n── EŞLEŞMEYEN AD (${unmatched.size} farklı, ilk 25)`);
for (const [n, c] of top) console.log(`  ${String(c).padStart(4)} ${n}`);

if (write) {
  const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:tarif -- --write\` ile yenile.
 *
 * Kaynak: Kaggle \`bit104/turkish-recipes-structured\` (${src.length} tarif),
 * nefisyemektarifleri.com içeriğinden yapılandırılmış.
 *
 * ${taken} tarif alındı. Malzemelerinin %${MIN_COVERAGE * 100}'inden azı katalogla
 * eşleşen tarifler dışarıda bırakıldı; ölçüler grama çevrildi.
 *
 * Kişisel kullanım için içe aktarıldı. Kamuya açık dağıtımdan önce kaynağın
 * lisans durumu netleştirilmeli.
 */

import type { RawRecipe } from './types';

export const ITHAL_TR: RawRecipe[] = [
`;
  fs.writeFileSync('src/data/recipes/ithal-tr.ts', header + lines.join('\n') + '\n];\n');
  console.log(`\nsrc/data/recipes/ithal-tr.ts yazıldı (${taken} tarif)`);
}
