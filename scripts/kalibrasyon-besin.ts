/**
 * Besin hesabının hatasını ölç — dış referans karşısında.
 *
 *   npm run data:datahive          (önce referans seti indir)
 *   npm run kalibrasyon:besin
 *
 * ── Neden bu set ───────────────────────────────────────────────────
 *
 * Önceki hâli Yummly28K kullanıyordu ve **düzeneğin kendi gürültüsü ölçümü
 * boğuyordu**: malzemeler "2 cups chopped onion" gibi serbest metindi,
 * grama çevirmek için kaba yoğunluk tabloları gerekiyordu ve 8.000 tarifin
 * 6.583'ü kapsam eşiğini geçemiyordu. Ölçülen %40'lık hatanın ne kadarının
 * modelden, ne kadarının çeviriden geldiği ayrılamıyordu.
 *
 * `datahiveai/recipes-with-nutrition` bu sorunu ortadan kaldırıyor: her
 * malzemenin ağırlığı **zaten gram**. Birim çevirisi diye bir adım yok.
 * Ayrıca `total_weight_g` alanı sayesinde pişmiş ağırlık hesabımız
 * (`cookedGrams`) ilk kez sınanabiliyor.
 *
 * **Sınırı:** Edamam'ın rakamları da hesaplanmış, laboratuvarda ölçülmüş
 * değil. Bu "gerçekle karşılaştırma" değil, "olgun bir ticari besin
 * motoruyla aynı fikirde miyiz" sınavı.
 *
 * ── Neyi ölçer, neyi ölçmez ────────────────────────────────────────
 *
 * ÖLÇER    malzeme toplamının doğruluğu, sistematik sapma, **kızartma yağı
 *          modelinin katkısı** (yağ oranı yüksek tarifler ayrı ölçülüyor)
 *          ve pişmiş ağırlık tahmini.
 *
 * ÖLÇMEZ   yönteme özel katsayıları. Sette pişirme yöntemi alanı yok;
 *          ızgaranın damlayan yağı ve haşlama suyu bu veriyle
 *          doğrulanamıyor, USDA tablolarındaki hâlleriyle duruyorlar.
 */

import fs from 'node:fs';

import { cookComponent } from '../src/data/catalog/pisirme-donusum.ts';
import { raw } from './pipeline/sources.ts';

// ── İngilizce besin tablosu ────────────────────────────────────────

interface M4 { kcal: number; protein: number; carbs: number; fat: number }

const src = JSON.parse(fs.readFileSync(raw('yemekcom-tarif-besin.json'), 'utf8')) as {
  Ingredient: Record<string, Record<string, string>>;
};

/**
 * İngilizce ad normalizasyonu.
 *
 * İlk ölçümde kütlenin yalnızca %66'sı eşleşiyordu ve kaçanların neredeyse
 * tamamı **çoğul ekiydi**: "eggs", "onions", "apples", "chicken breasts",
 * "strawberries". Tabloda tekil hâlleri var. Ayrıca "boneless, skinless
 * chicken breasts" gibi hazırlık sıfatları eşleşmeyi bozuyor.
 */
const DESCRIPTOR =
  /\b(boneless|skinless|fresh|frozen|dried|chopped|minced|sliced|diced|grated|shredded|ground|large|small|medium|whole|raw|cooked|unsalted|salted|low[- ]fat|fat[- ]free|extra[- ]virgin|virgin|ripe|peeled|cubed|crushed|thinly|finely|roughly|of)\b/g;

function singular(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('sses') || w.endsWith('shes') || w.endsWith('ches')) return w.slice(0, -2);
  if (w.endsWith('oes') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && w.length > 3) return w.slice(0, -1);
  return w;
}

const normEn = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(DESCRIPTOR, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const EN = new Map<string, M4>();
const addEn = (name: string, m: M4) => {
  const n = normEn(name);
  if (!n) return;
  if (!EN.has(n)) EN.set(n, m);
  const sing = n.split(' ').map(singular).join(' ');
  if (sing !== n && !EN.has(sing)) EN.set(sing, m);
};

for (const r of Object.values(src.Ingredient ?? {})) {
  const name = (r['English Name'] ?? '').trim();
  if (!name || Number(r['Serving Size']) !== 100) continue;
  const m = {
    kcal: Number(r.Calorie),
    protein: Number(r.Protein),
    carbs: Number(r.Carbohydrates),
    fat: Number(r.Fat),
  };
  if (!Object.values(m).every(Number.isFinite) || m.kcal < 0 || m.kcal > 950) continue;
  addEn(name, m);
}

/**
 * Tabloda karşılığı olmayan ama korpusta ağır basan kalemler.
 *
 * Ölçüm bunları kütleye göre sıralayıp buldu: et suyu 116 kg, yumurta 106 kg.
 * Değerler USDA'nın tipik satırları.
 */
const EXTRA: [string, M4][] = [
  ['stock', { kcal: 10, protein: 1.5, carbs: 0.5, fat: 0.3 }],
  ['broth', { kcal: 10, protein: 1.5, carbs: 0.5, fat: 0.3 }],
  ['chicken stock', { kcal: 10, protein: 1.5, carbs: 0.5, fat: 0.3 }],
  ['vegetable stock', { kcal: 8, protein: 0.5, carbs: 1.2, fat: 0.1 }],
  ['beef stock', { kcal: 10, protein: 1.5, carbs: 0.5, fat: 0.3 }],
  ['bacon', { kcal: 541, protein: 37, carbs: 1.4, fat: 42 }],
  ['buttermilk', { kcal: 40, protein: 3.3, carbs: 4.8, fat: 0.9 }],
  ['turkey', { kcal: 189, protein: 29, carbs: 0, fat: 7 }],
  ['honey', { kcal: 304, protein: 0.3, carbs: 82, fat: 0 }],
  ['apple', { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 }],
  ['strawberry', { kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3 }],
  ['mushroom', { kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 }],
  ['heavy cream', { kcal: 340, protein: 2.8, carbs: 2.8, fat: 36 }],
  ['sour cream', { kcal: 198, protein: 2.4, carbs: 4.6, fat: 19 }],
  ['cream cheese', { kcal: 342, protein: 6, carbs: 4, fat: 34 }],
  ['brown sugar', { kcal: 380, protein: 0.1, carbs: 98, fat: 0 }],
  ['maple syrup', { kcal: 260, protein: 0, carbs: 67, fat: 0.1 }],
  ['soy sauce', { kcal: 53, protein: 8, carbs: 4.9, fat: 0.6 }],
];
for (const [n, m] of EXTRA) addEn(n, m);

/** Tam ad, sonra tekilleştirilmiş hâl, sonra sondan kısaltarak ara. */
function lookup(name: string): M4 | undefined {
  const n = normEn(name);
  if (!n) return undefined;
  const direct = EN.get(n);
  if (direct) return direct;

  const words = n.split(' ');
  const sing = words.map(singular);
  const singJoined = sing.join(' ');
  if (EN.has(singJoined)) return EN.get(singJoined);

  for (let i = 1; i < sing.length; i += 1) {
    const tail = sing.slice(i).join(' ');
    const hit = EN.get(tail);
    if (hit) return hit;
  }
  return undefined;
}

// ── Referans seti ──────────────────────────────────────────────────

interface Slim {
  name: string;
  servings: number;
  weightG: number;
  cuisine: string;
  ing: [string, number][];
  per: [number, number, number, number];
}

const file = raw('datahive-besin.json');
if (!fs.existsSync(file)) {
  console.error('Referans seti yok. Önce: npm run data:datahive');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Slim[];

const OIL = /\boil\b|butter|shortening|margarine|lard|ghee/i;

/**
 * İngilizce yağ adını katalog slug'ına çevir.
 *
 * `pisirme-donusum.ts` kızartma banyosunu **slug'a bakarak** buluyor: nötr
 * sıvı yağ banyo kurabilir, tereyağı ve zeytinyağı kuramaz. Düzenek
 * İngilizce adı olduğu gibi slug diye verirse kural hiç tetiklenmiyor ve
 * ölçüm modeli sınamamış olur, sadece sessizce atlar.
 */
function oilSlug(name: string): string {
  const n = name.toLowerCase();

  /**
   * **Önce banyo kuramayanlar.** İlk hâlinde bunlar yoktu ve ölçüm bozuluyordu:
   * `OIL` kalıbı "peanut butter"daki *butter*'ı yakalıyor, `oilSlug` da onu
   * varsayılan nötr yağa düşürüyordu. Sonuç, "Reese's Peanut Butter Cupcakes"
   * ve "Buckeyes" gibi tarifleri kızartma banyosu sayıp 1,6 kilo fıstık
   * ezmesini tavada bırakmaktı.
   *
   * Fıstık ezmesi, hindistan cevizi yağı ve vegan margarinler tabağa girer;
   * hiçbiri banyo kurmaz.
   */
  /**
   * Katı hamur yağları da banyo kuramaz. Ölçümde kalan yanlış pozitiflerin
   * hepsi bu kalıptaydı: Kolaczki, turta hamuru, shortcake, suet pudding —
   * hepsinde yağ hamurun içinde, tabakta yeniyor.
   */
  if (/shortening|\blard\b|suet/.test(n)) return 'margarin';
  if (/peanut butter|nut butter|almond butter|cashew butter|tahini/.test(n)) return 'yer-fistigi';
  if (/coconut/.test(n)) return 'hindistan-cevizi';
  if (/olive/.test(n)) return 'zeytinyagi';
  if (/margarine|vegan butter/.test(n)) return 'margarin';
  if (/butter|ghee/.test(n)) return 'tereyagi';
  if (/sesame/.test(n)) return 'susam-yagi';
  if (/sunflower/.test(n)) return 'aycicek-yagi';
  if (/canola|rapeseed/.test(n)) return 'kanola-yagi';
  if (/corn oil/.test(n)) return 'misir-yagi';
  // Nötr kalanlar: vegetable oil, frying oil, peanut oil, shortening, lard.
  return 'sivi-yag';
}

interface Sample {
  naive: M4;
  modelled: M4;
  actual: M4;
  cookedG: number;
  actualG: number;
  oilShare: number;
}

const samples: Sample[] = [];
let lowCoverage = 0;

for (const r of data) {
  const items: { slug: string; category: never; grams: number; per100: M4 }[] = [];
  let massAll = 0;
  let massHit = 0;

  for (const [name, w] of r.ing) {
    massAll += w;
    const m = lookup(name);
    if (!m) continue;
    massHit += w;

    const isOil = OIL.test(name);
    items.push({
      // Yağlarda gerçek slug şart: banyo kuralı yağın cinsine bakıyor.
      slug: isOil ? oilSlug(name) : name,
      category: (isOil ? 'yag' : 'sebze') as never,
      grams: w,
      per100: m,
    });
  }

  /**
   * Kapsam **kütleye** göre ölçülüyor, malzeme sayısına göre değil: bir tutam
   * baharatın eşleşmemesi hesabı bozmaz, 400 g tavuğun eşleşmemesi bozar.
   */
  if (massAll <= 0 || massHit / massAll < 0.85 || items.length < 3) {
    lowCoverage += 1;
    continue;
  }

  const naive = items.reduce(
    (a, i) => ({
      kcal: a.kcal + (i.per100.kcal * i.grams) / 100,
      protein: a.protein + (i.per100.protein * i.grams) / 100,
      carbs: a.carbs + (i.per100.carbs * i.grams) / 100,
      fat: a.fat + (i.per100.fat * i.grams) / 100,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const cooked = cookComponent(items as never, 'tava');
  /** Banyo kurulabilen nötr yağlar — kural yağın cinsine bakıyor. */
  const BATH = new Set(['sivi-yag', 'aycicek-yagi', 'misir-yagi', 'kanola-yagi']);
  const oilG = items.filter((i) => BATH.has(i.slug)).reduce((a, i) => a + i.grams, 0);
  const foodG = items.filter((i) => (i.category as string) !== 'yag').reduce((a, i) => a + i.grams, 0);

  samples.push({
    naive: {
      kcal: naive.kcal / r.servings,
      protein: naive.protein / r.servings,
      carbs: naive.carbs / r.servings,
      fat: naive.fat / r.servings,
    },
    modelled: {
      kcal: cooked.kcal / r.servings,
      protein: cooked.protein / r.servings,
      carbs: cooked.carbs / r.servings,
      fat: cooked.fat / r.servings,
    },
    actual: { kcal: r.per[0], protein: r.per[1], carbs: r.per[2], fat: r.per[3] },
    cookedG: cooked.cookedGrams,
    actualG: r.weightG,
    oilShare: foodG > 0 ? oilG / foodG : 0,
  });
}

// ── Rapor ──────────────────────────────────────────────────────────

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Medyan mutlak yüzde hata — aykırı değerlere ortalamadan dayanıklı. */
const mape = (rows: Sample[], pick: (s: Sample) => number, act: (s: Sample) => number) =>
  median(rows.filter((r) => act(r) > 0).map((r) => (Math.abs(pick(r) - act(r)) / act(r)) * 100));

/** Medyan işaretli sapma — sistematik olarak yüksek mi düşük mü çıkıyoruz. */
const bias = (rows: Sample[], pick: (s: Sample) => number, act: (s: Sample) => number) =>
  median(rows.filter((r) => act(r) > 0).map((r) => ((pick(r) - act(r)) / act(r)) * 100));

console.log('\n════ BESİN HESABI KALİBRASYONU ════');
console.log(`  referans seti:        ${data.length} tarif (datahiveai / Edamam)`);
console.log(`  kütle kapsamı <%85:   ${lowCoverage}`);
console.log(`  ÖLÇÜME GİREN:         ${samples.length}`);
console.log(`  İngilizce tablo:      ${EN.size} anahtar`);

if (!samples.length) {
  console.log('\nÖlçüme giren tarif yok.');
  process.exit(1);
}

const show = (label: string, rows: Sample[]) => {
  if (!rows.length) return;
  console.log(`\n── ${label}  (${rows.length} tarif)`);
  console.log('             medyan mutlak hata      sistematik sapma');
  console.log('             ham toplam   modelli    ham toplam   modelli');
  const lines = [
    ['kalori   ', (s: Sample) => s.naive.kcal, (s: Sample) => s.modelled.kcal, (s: Sample) => s.actual.kcal],
    ['protein  ', (s: Sample) => s.naive.protein, (s: Sample) => s.modelled.protein, (s: Sample) => s.actual.protein],
    ['karbonhid', (s: Sample) => s.naive.carbs, (s: Sample) => s.modelled.carbs, (s: Sample) => s.actual.carbs],
    ['yağ      ', (s: Sample) => s.naive.fat, (s: Sample) => s.modelled.fat, (s: Sample) => s.actual.fat],
  ] as const;
  for (const [name, pn, pm, act] of lines) {
    const a = mape(rows, pn as never, act as never);
    const b = mape(rows, pm as never, act as never);
    const c = bias(rows, pn as never, act as never);
    const d = bias(rows, pm as never, act as never);
    const mark = b < a - 0.05 ? '  ↓' : b > a + 0.05 ? '  ↑' : '';
    console.log(
      `  ${name}  %${a.toFixed(1).padStart(6)}   %${b.toFixed(1).padStart(6)}   ` +
        `${c > 0 ? '+' : ''}${c.toFixed(1).padStart(6)}%  ${d > 0 ? '+' : ''}${d.toFixed(1).padStart(6)}%${mark}`,
    );
  }
};

show('TÜM TARİFLER', samples);
show('BANYO KOŞULU SAĞLANANLAR — nötr yağ en az 200 g ve gıdanın üçte birinden çok', samples.filter((s) => s.oilShare > 0.3));
show('BANYO YOK — model devreye girmiyor', samples.filter((s) => s.oilShare <= 0.3));

/**
 * Pişmiş ağırlık — bugüne kadar hiç doğrulanmamış çıktı.
 *
 * `cookedGrams` porsiyon gramajını söylemek için var ama karşılaştıracak
 * referansımız yoktu. Bu sette `total_weight_g` mevcut.
 */
const withW = samples.filter((s) => s.actualG > 0);
if (withW.length) {
  const err = median(withW.map((s) => (Math.abs(s.cookedG - s.actualG) / s.actualG) * 100));
  const bi = median(withW.map((s) => ((s.cookedG - s.actualG) / s.actualG) * 100));
  console.log(`\n── PİŞMİŞ AĞIRLIK  (${withW.length} tarif)`);
  console.log(`  medyan mutlak hata: %${err.toFixed(1)}`);
  console.log(`  sistematik sapma:   ${bi > 0 ? '+' : ''}${bi.toFixed(1)}%`);
  console.log(
    '  Not: referans HAM toplam ağırlık; bizimki pişmiş. Etin su kaybettiği,\n' +
      '  tahılın su çektiği düşünülürse bir miktar fark beklenen.',
  );
}

console.log(
  '\nNot: sette pişirme yöntemi alanı yok. Ölçülen şey malzeme toplamının ve\n' +
    'kızartma yağı modelinin doğruluğu; ızgara ve haşlama katsayıları bu\n' +
    'veriyle doğrulanamıyor.\n',
);
