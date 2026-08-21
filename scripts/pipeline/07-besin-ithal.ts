/**
 * Adım 7 — malzeme besin değerlerini içe aktar.
 *
 *   npm run data:besin             kapsam raporu
 *   npm run data:besin -- --write  src/data/catalog/besin-ithal.ts üret
 *
 * Kaynak: `data-raw/yemekcom-tarif-besin.json` içindeki `Ingredient` düğümü —
 * 866 malzemenin 100 gram başına değeri, Türkçe adla.
 *
 * **Neden gerekiyor.** `besin.ts` elle yazılmış ~90 malzemeyi gerçek değerle
 * tutuyor, kalan 161 malzeme kategori ortalamasına düşüyor. Ortalama kaba bir
 * yaklaşım: kestane "kuruyemiş" sayılıp 600 kcal ve 18 g protein alıyor, oysa
 * gerçekte 200 kcal ve 2 g protein. Pişirme kaybını modellemenin bir anlamı
 * yok — hata payı zaten bu tablodan geliyor.
 *
 * **Elle yazılanlara dokunulmuyor.** Bu dosya ikinci katman: `macrosFor`
 * önce `besin.ts`'e, sonra buraya, en son kategori ortalamasına bakıyor.
 * Böylece kürate edilmiş değerler yetkili kalıyor ve bu dosya her an
 * yeniden üretilebiliyor.
 *
 * Üç denetim uygulanıyor; hepsi kaynakta gerçekten bulunan bozukluklara karşı:
 *
 *  1. **Kimlik eşleşmesi** — `resolveExact`. Tarif içe aktarımının gevşek
 *     geri düşüşleri ve **eş anlamlı tablosu** burada kapalı. `SYN` tarifte
 *     vekil kabul ediyor ("ton balığı konservesi" → somon); besin değerinde
 *     bu kalıcı hata demek. Aşağıdaki `SAFE_ALIAS` yalnızca gerçekten aynı
 *     şey olan birkaç yazımı geri açıyor.
 *  2. **Atwater tutarlılığı** — 4×protein + 4×karbonhidrat + 9×yağ, yazan
 *     kalorinin 0.6–1.6 katı arasında kalmalı. Bant asimetrik; sebebi
 *     aşağıda, denetimin başında yazılı.
 *  3. **Akla yatkın aralık** — negatif değer, 950 kcal üstü ve toplamı
 *     105 grama sığmayan makro yok. 100–105 arası yuvarlama kabul edilip
 *     kırpılıyor.
 */

import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { INGREDIENT_MACROS } from '../../src/data/catalog/besin.ts';

import { norm, resolveExact } from './eslestirici.ts';
import { raw } from './sources.ts';

const write = process.argv.includes('--write');
const why = process.argv.includes('--neden');

interface SrcIngredient {
  'Turkish Name'?: string;
  'English Name'?: string;
  Calorie?: string;
  Protein?: string;
  Carbohydrates?: string;
  Fat?: string;
  'Serving Size'?: string;
}

const file = JSON.parse(fs.readFileSync(raw('yemekcom-tarif-besin.json'), 'utf8')) as {
  Ingredient: Record<string, SrcIngredient>;
};

const num = (v: string | undefined): number => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

interface Row {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Aynı şeyin farklı yazımı — vekil değil, kimlik.
 *
 * Her satır elle denetlendi: soldaki ile sağdaki gerçekten aynı gıda.
 * "Tam buğday unu" ile "un" arasında fark var ama ikisi de un; medyan
 * ikisini birlikte alıyor. Vekil olanlar (sosis→sucuk, parmesan→kaşar,
 * ton balığı→somon, yulaf→arpa şehriye) kasten burada YOK.
 */
const SAFE_ALIAS: Record<string, string> = {
  'sıcak su': 'su', 'ılık su': 'su', 'soğuk su': 'su', 'kaynar su': 'su', 'içme suyu': 'su',
  'ılık süt': 'sut', 'sıcak süt': 'sut', 'soğuk süt': 'sut', 'çiğ süt': 'sut',
  'deniz tuzu': 'tuz', 'kaya tuzu': 'tuz',
  'buğday unu': 'un', 'tam buğday unu': 'un',
  'lor peyniri': 'lor',
  'olgun muz': 'muz',
  'bayat ekmek kırıntısı': 'galeta-unu', 'ekmek kırıntısı': 'galeta-unu',
  'toz şeker': 'seker', 'kesme şeker': 'seker',
  'süzme yoğurt': 'suzme-yogurt',
  'kuru soğan': 'kuru-sogan', 'büyük boy soğan': 'kuru-sogan', 'orta boy soğan': 'kuru-sogan',
};

const bySlug = new Map<string, Row[]>();
const sourceNames = new Map<string, string[]>();

let total = 0;
let skippedServing = 0;
let skippedUnmatched = 0;
let skippedAtwater = 0;
let skippedRange = 0;

for (const r of Object.values(file.Ingredient ?? {})) {
  total += 1;
  const name = (r['Turkish Name'] ?? '').trim();
  if (!name) continue;

  /**
   * Kaynakta 71 satırda porsiyon "0" yazıyor ve değerler de sıfır; bunlar
   * doldurulmamış kayıtlar. 100 gram başına olmayan satırı ölçekleyemeyiz.
   */
  if (num(r['Serving Size']) !== 100) {
    skippedServing += 1;
    continue;
  }

  const kcal = num(r.Calorie);
  const rawProtein = num(r.Protein);
  const rawCarbs = num(r.Carbohydrates);
  const rawFat = num(r.Fat);
  if (![kcal, rawProtein, rawCarbs, rawFat].every(Number.isFinite)) {
    // Kaynakta 79 satırda makro alanları boş; kalori tek başına işe yaramıyor.
    skippedRange += 1;
    if (why) console.log(`  BOŞ      ${name}`);
    continue;
  }

  /**
   * Denetim 3 — akla yatkın aralık.
   *
   * Kaynakta zeytinyağı "101.2 g yağ", kesme şeker "102 g karbonhidrat"
   * yazıyor. İkisi de yuvarlama artığı, bozuk veri değil: saf yağ 100 g
   * yağdır. 105'e kadar olanı kırpıyoruz, üstünü eliyoruz — kırpmak
   * uydurma değil, ölçüm gürültüsünü temizlemek.
   */
  const CLAMP = 105;
  /**
   * Üst sınır 900 değil 950: saf yağın teorik tavanı 9 kcal/g × 100 g = 900
   * ama ölçüm biraz üstüne çıkıyor. Kuyruk yağı kaynakta 926 kcal ve
   * 100.9 g yağ — kendi içinde tutarlı, sert 900 sınırı onu boşuna eliyordu.
   */
  if (kcal < 0 || kcal > 950 || rawProtein < 0 || rawCarbs < 0 || rawFat < 0) {
    skippedRange += 1;
    if (why) console.log(`  ARALIK   ${name}  ${kcal} kcal · P${rawProtein} K${rawCarbs} Y${rawFat}`);
    continue;
  }
  if (rawProtein > CLAMP || rawCarbs > CLAMP || rawFat > CLAMP || rawProtein + rawCarbs + rawFat > CLAMP) {
    skippedRange += 1;
    if (why) console.log(`  ARALIK   ${name}  ${kcal} kcal · P${rawProtein} K${rawCarbs} Y${rawFat}`);
    continue;
  }
  const protein = Math.min(100, rawProtein);
  const carbs = Math.min(100, rawCarbs);
  const fat = Math.min(100, rawFat);

  /**
   * Denetim 2 — Atwater tutarlılığı, iki yönlü ve asimetrik bant.
   *
   * 4×protein + 4×karbonhidrat + 9×yağ, yazan kaloriye yakın olmalı. Ama
   * bandın iki ucu farklı sebeplerden geniş:
   *
   *  ÜST (1.6×) — **lif**. Lif karbonhidrat sayılıyor ama 4 değil ~2 kcal/g
   *    veriyor. Karabiberin 64 g karbonhidratının 25 g'ı lif; Atwater 325
   *    diyor, gerçek 245. Baharatların hepsi bu yüzden şişiyor ve dar bir
   *    bant onları toptan eliyordu.
   *
   *  ALT (0.6×) — **alkol ve özütler**. Şarabın kalorisi etanolden geliyor
   *    (7 kcal/g), makrolarda görünmüyor: Atwater 11 diyor, yazan 87.
   *    Bunları KABUL ETMİYORUZ — dört makroyla temsil edilemeyen bir
   *    malzemeyi tabloya koymak, kalorisi olup makrosu olmayan bir kayıt
   *    üretir ve toplamı bozar.
   */
  const atwater = protein * 4 + carbs * 4 + fat * 9;
  const ratio = atwater / Math.max(kcal, 1);
  if (kcal > 30 && (ratio > 1.6 || ratio < 0.6)) {
    skippedAtwater += 1;
    if (why) console.log(`  ATWATER  ${name}  yazan ${kcal} · hesaplanan ${atwater.toFixed(0)} · oran ${ratio.toFixed(2)}`);
    continue;
  }

  // Denetim 1 — kimlik eşleşmesi (eş anlamlı vekilleri kapalı).
  const slug = SAFE_ALIAS[norm(name)] ?? resolveExact(name);
  if (!slug) {
    skippedUnmatched += 1;
    continue;
  }

  const arr = bySlug.get(slug) ?? [];
  arr.push({ kcal, protein, carbs, fat });
  bySlug.set(slug, arr);

  const names = sourceNames.get(slug) ?? [];
  if (!names.includes(name)) names.push(name);
  sourceNames.set(slug, names);
}

/**
 * Aynı slug'a birden çok kaynak satırı düşebiliyor: "soğan", "büyük boy
 * soğan", "orta boy soğan" hepsi `kuru-sogan`. Ortalama yerine **medyan**
 * alıyoruz — tek bir bozuk satır ortalamayı kaydırır, medyanı kaydırmaz.
 */
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

const handWritten = new Set(Object.keys(INGREDIENT_MACROS));
const lines: string[] = [];
let added = 0;
let alreadyHand = 0;

for (const [slug, rows] of [...bySlug].sort()) {
  if (handWritten.has(slug)) {
    alreadyHand += 1;
    continue;
  }
  const m = {
    kcal: Math.round(median(rows.map((x) => x.kcal))),
    protein: r1(median(rows.map((x) => x.protein))),
    carbs: r1(median(rows.map((x) => x.carbs))),
    fat: r1(median(rows.map((x) => x.fat))),
  };
  const key = /^[a-z][a-z0-9]*$/.test(slug) ? slug : `'${slug}'`;
  const src = sourceNames.get(slug)!.join(', ');
  lines.push(
    `  ${key}: { kcal: ${m.kcal}, protein: ${m.protein}, carbs: ${m.carbs}, fat: ${m.fat} },` +
      `${rows.length > 1 ? `  // ${rows.length} kayıt: ${src}` : `  // ${src}`}`,
  );
  added += 1;
}

const covered = new Set([...handWritten, ...bySlug.keys()]);
const missing = INGREDIENTS.filter((i) => !covered.has(i.slug));

console.log('\n════ MALZEME BESİN DEĞERLERİ ════');
console.log(`  kaynak satır:            ${total}`);
console.log(`  atlandı (porsiyon ≠100): ${skippedServing}`);
console.log(`  atlandı (aralık dışı):   ${skippedRange}`);
console.log(`  atlandı (Atwater):       ${skippedAtwater}`);
console.log(`  atlandı (ad tutmadı):    ${skippedUnmatched}`);
console.log(`  eşleşen slug:            ${bySlug.size}`);
console.log(`    zaten elle yazılı:     ${alreadyHand}`);
console.log(`    yeni eklenen:          ${added}`);
console.log('');
console.log(`  KATALOG KAPSAMI  ${covered.size} / ${INGREDIENTS.length} malzemede gerçek değer`);
console.log(`    önce (yalnız elle):    ${handWritten.size}`);
console.log(`    kategori ortalamasında kalan: ${missing.length}`);
if (missing.length) {
  console.log(`\n── HÂLÂ ORTALAMAYA DÜŞENLER (${missing.length})`);
  console.log(
    '  ' +
      missing
        .map((i) => i.nameTr)
        .slice(0, 60)
        .join(', '),
  );
}

if (write) {
  const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:besin -- --write\` ile yenile.
 *
 * Kaynak: yemek.com Firebase dökümündeki malzeme besin tablosu
 * (\`data-raw/yemekcom-tarif-besin.json\`, ${total} satır).
 *
 * ${added} malzemenin 100 gram başına değeri. \`besin.ts\`'te elle yazılmış olanlar
 * buraya alınmadı — orası yetkili katman, burası onun altındaki ikinci katman.
 * Her satır katı ad eşleştirmesinden, Atwater tutarlılığından ve aralık
 * denetiminden geçti.
 *
 * **Tahmindir.** Pişirme kaybı, yağ emilimi ve çeşit farkı bu tabloda yok;
 * onları \`pisirme-donusum.ts\` hesaplıyor.
 */

import type { Macros } from './besin';

export const ITHAL_MACROS: Record<string, Macros> = {
`;
  fs.writeFileSync('src/data/catalog/besin-ithal.ts', header + lines.join('\n') + '\n};\n');
  console.log(`\nsrc/data/catalog/besin-ithal.ts yazıldı (${added} malzeme)`);
}
