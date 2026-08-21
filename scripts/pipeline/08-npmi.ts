/**
 * Adım 8 — kültürel önseli kendi korpusumuzdan hesapla.
 *
 *   npm run data:npmi             rapor ve kalibrasyon
 *   npm run data:npmi -- --write  src/data/catalog/npmi-tr.ts üret
 *
 * ── Neden ──────────────────────────────────────────────────────────
 *
 * Motorun üç sinyalinden biri "mutfak geleneği" (`priorNpmi`). Şu an bu
 * sinyal 388 elle kürate edilmiş çiftten geliyor ve ağın **14.532 kenarının
 * yalnızca %2,7'sini** kaplıyor. Kalan %97,3 sadece kimyayla çalışıyor —
 * oysa Ahn et al.'in kendi bulgusu kimyanın tek başına yetmediği.
 *
 * `gelenek.ts` dosyasının kendi notu da bunu söylüyordu: "Aşama 2'de bu liste
 * korpustan hesaplanan NPMI ile değişecek."
 *
 * Artık 3.481 gerçek Türk tarifimiz var. Malzemelerin birlikte geçme
 * istatistiği, Türk mutfağının ne ile neyi yan yana koyduğunun doğrudan
 * kanıtı — hem de Ahn'ın ağırlıklı Batılı korpusundan ödünç almadan.
 *
 * ── Matematik ──────────────────────────────────────────────────────
 *
 * Normalize edilmiş karşılıklı bilgi (NPMI):
 *
 *   p(a,b) = birlikte geçtiği tarif / toplam tarif
 *   PMI    = log( p(a,b) / (p(a)·p(b)) )
 *   NPMI   = PMI / −log p(a,b)              ∈ [−1, +1]
 *
 * Ham birlikte geçme sayısı işe yaramaz: tuz her tarifte var, o yüzden her
 * şeyle "birlikte geçiyor". NPMI bunu normalize ediyor — soru "birlikte kaç
 * kere geçtiler" değil, "tesadüfen beklenenden ne kadar fazla".
 *
 * −log p(a,b) bölmesi PMI'ı [−1,1] aralığına sıkıştırıyor; nadir çiftlerin
 * PMI'ı doğal olarak şişkin olduğu için bu düzeltme şart.
 *
 * ── Denetimler ─────────────────────────────────────────────────────
 *
 *  1. **En az 8 tarifte birlikte.** Altında istatistik değil gürültü.
 *  2. **NPMI > 0.** Negatif, "birbirinden kaçınıyorlar" demek; motor şu an
 *     bunu kullanmıyor, o yüzden yazmıyoruz.
 *  3. **Elle kürate edilene dokunulmuyor.** `gelenek.ts` yetkili katman.
 *     Kuzu ile kuru nane orada 0.9; korpusta az geçiyorsa bile 0.9 kalır.
 */

import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { CLASSIC_PAIRS } from '../../src/data/catalog/gelenek.ts';
import { RECIPES } from '../../src/data/recipes/index.ts';

const write = process.argv.includes('--write');

const MIN_CO = 8;
const N = RECIPES.length;

// ── Sayım ──────────────────────────────────────────────────────────

const single = new Map<string, number>();
const co = new Map<string, number>();
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

for (const r of RECIPES) {
  const slugs = [...new Set(r.allSlugs)].sort();
  for (const s of slugs) single.set(s, (single.get(s) ?? 0) + 1);
  for (let i = 0; i < slugs.length; i += 1) {
    for (let j = i + 1; j < slugs.length; j += 1) {
      const k = key(slugs[i], slugs[j]);
      co.set(k, (co.get(k) ?? 0) + 1);
    }
  }
}

// ── NPMI ───────────────────────────────────────────────────────────

interface Pair {
  a: string;
  b: string;
  count: number;
  npmi: number;
}

const pairs: Pair[] = [];
for (const [k, count] of co) {
  if (count < MIN_CO) continue;
  const [a, b] = k.split('|');
  const pa = (single.get(a) ?? 0) / N;
  const pb = (single.get(b) ?? 0) / N;
  const pab = count / N;
  if (pa <= 0 || pb <= 0 || pab <= 0) continue;

  const pmi = Math.log(pab / (pa * pb));
  const npmi = pmi / -Math.log(pab);
  if (npmi <= 0) continue;
  pairs.push({ a, b, count, npmi });
}

pairs.sort((x, y) => y.npmi - x.npmi);

// ── Güç ölçeğine çevirme ───────────────────────────────────────────

/**
 * NPMI ile elle verilen güç aynı ölçekte değil. Çeviriyi uydurmuyoruz:
 * elle kürate edilmiş 388 çiftin korpustaki NPMI'ına bakıp iki ölçeği
 * birbirine oturtuyoruz. Aşağıdaki rapor bu karşılaştırmayı basıyor.
 */
const npmiOf = new Map(pairs.map((p) => [key(p.a, p.b), p.npmi]));
const known: { strength: number; npmi: number }[] = [];
for (const [a, b, strength] of CLASSIC_PAIRS) {
  const n = npmiOf.get(key(a, b));
  if (n !== undefined) known.push({ strength, npmi: n });
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const medKnownNpmi = median(known.map((k) => k.npmi));
const medKnownStrength = median(known.map((k) => k.strength));

/**
 * **Ölçek dönüşümü doğrusal DEĞİL, ve bunun ölçülmüş bir sebebi var.**
 *
 * Önce medyanları eşleyen doğrusal bir çarpan denedim (3.50) ve iki şeyi
 * birden bozdu: en güçlü 18 çiftin hepsi tavana yapışıp 0.90 oldu, yani
 * sıralama bilgisi kayboldu.
 *
 * Daha önemlisi, kalibrasyon raporu iki ölçeğin **korele olmadığını**
 * gösterdi:
 *
 *   elle "ikonik" (≥0.80)      → korpusta NPMI medyanı 0.243
 *   elle "çok yaygın" (0.60+)  → korpusta NPMI medyanı 0.187
 *   elle "yaygın" (0.40+)      → korpusta NPMI medyanı 0.211
 *
 * Aralarında düzenli bir artış yok. Sebebi şu: ikisi farklı şeyi ölçüyor.
 * Kürasyon "bu ikisi olmadan o yemek olmaz" diyor; NPMI "bu ikisi sık sık
 * aynı tarifte" diyor. Kuzu ile kuru nane ikonik ama korpusta kuzu tarifi
 * az; kabartma tozu ile vanilya 313 tarifte birlikte ama kimse buna
 * "eşleşme" demez.
 *
 * O yüzden NPMI'ı kürasyonun ölçeğine ZORLAMIYORUZ. Kendi sıralamasını
 * koruyup 0.30–0.85 bandına yerleştiriyoruz — tavanın altında kalıyor,
 * çünkü korpustan çıkan bir istatistik elle "ikonik" denmiş bir eşleşmenin
 * önüne geçmemeli.
 */
const NPMI_FULL = 0.5;
const strengthOf = (npmi: number) =>
  0.3 + 0.55 * Math.min(1, Math.max(0, npmi) / NPMI_FULL);

// ── Rapor ──────────────────────────────────────────────────────────

const BY_SLUG = new Map(INGREDIENTS.map((i) => [i.slug, i.nameTr]));
const nameOf = (s: string) => BY_SLUG.get(s) ?? s;

console.log('\n════ KORPUSTAN KÜLTÜREL ÖNSEL (NPMI) ════');
console.log(`  tarif:                  ${N}`);
console.log(`  malzeme çifti (≥${MIN_CO} tarif): ${[...co.values()].filter((c) => c >= MIN_CO).length}`);
console.log(`  NPMI > 0 olan:          ${pairs.length}`);
console.log(`  elle kürate edilmiş:    ${CLASSIC_PAIRS.length}`);
console.log(`  ikisinde de olan:       ${known.length}`);

console.log('\n── ÖLÇEK KALİBRASYONU');
console.log(`  elle verilen gücün medyanı: ${medKnownStrength.toFixed(2)}`);
console.log(`  aynı çiftlerin NPMI medyanı: ${medKnownNpmi.toFixed(3)}`);
console.log('  → doğrusal çarpan KULLANILMIYOR; gerekçe kodda.');

/**
 * İki ölçek gerçekten aynı şeyi mi ölçüyor? Elle "ikonik" denen çiftlerin
 * korpusta da yüksek çıkması bekleniyor. Çıkmıyorsa ya kürasyon ya korpus
 * gerçeği yansıtmıyor demektir ve bunu bilmek gerekir.
 */
const bands = [
  ['ikonik (≥0.80)', (s: number) => s >= 0.8],
  ['çok yaygın (0.60–0.79)', (s: number) => s >= 0.6 && s < 0.8],
  ['yaygın (0.40–0.59)', (s: number) => s >= 0.4 && s < 0.6],
  ['ara sıra (<0.40)', (s: number) => s < 0.4],
] as const;
console.log('\n  elle verilen güç        →  korpustaki NPMI medyanı');
for (const [label, test] of bands) {
  const xs = known.filter((k) => test(k.strength)).map((k) => k.npmi);
  if (!xs.length) continue;
  console.log(`    ${label.padEnd(24)} ${median(xs).toFixed(3)}   (${xs.length} çift)`);
}

console.log('\n── KORPUSUN EN GÜÇLÜ ÇİFTLERİ (elle yazılmayanlar)');
const handSet = new Set(CLASSIC_PAIRS.map(([a, b]) => key(a, b)));
let shown = 0;
for (const p of pairs) {
  if (handSet.has(key(p.a, p.b))) continue;
  console.log(
    `  ${p.npmi.toFixed(3)}  →  ${strengthOf(p.npmi).toFixed(2)}   ` +
      `${nameOf(p.a)} + ${nameOf(p.b)}`.padEnd(44) + `${p.count} tarif`,
  );
  if (++shown >= 18) break;
}

const fresh = pairs.filter((p) => !handSet.has(key(p.a, p.b)));
console.log(`\n  elle yazılmayan yeni önsel: ${fresh.length}`);
console.log(`  önsel kapsamı: %2.7 → %${(((fresh.length + CLASSIC_PAIRS.length) / 14532) * 100).toFixed(1)}`);

if (write) {
  const lines = fresh.map(
    (p) =>
      `  ['${p.a}', '${p.b}', ${strengthOf(p.npmi).toFixed(2)}],` +
      `  // ${p.count} tarif · NPMI ${p.npmi.toFixed(3)}`,
  );
  const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:npmi -- --write\` ile yenile.
 *
 * Kültürel önselin korpustan hesaplanan katmanı: ${N} Türk tarifinde
 * malzemelerin birlikte geçme istatistiğinden (NPMI) çıkarıldı.
 *
 * ${fresh.length} çift. En az ${MIN_CO} tarifte birlikte geçenler alındı; NPMI değeri
 * kendi sıralamasını koruyarak yerleştirildi (0.30–0.85 bandı).
 *
 * **\`gelenek.ts\` yetkili katman.** Orada elle yazılmış bir çift varsa bu
 * dosyadaki değeri değil onunki geçerli — kürasyon, istatistiğin göremediği
 * şeyi biliyor (nadir ama ikonik eşleşmeler).
 */

import type { ClassicPair } from './gelenek';

export const NPMI_PAIRS: ClassicPair[] = [
${lines.join('\n')}
];
`;
  fs.writeFileSync('src/data/catalog/npmi-tr.ts', header);
  console.log(`\nsrc/data/catalog/npmi-tr.ts yazıldı (${fresh.length} çift)`);
}
