/**
 * Adım 4 — Türkçe katalogu Ahn malzeme listesine bağla.
 *
 *   npm run data:map                 rapor
 *   npm run data:map -- --write      src/data/catalog/ahn-eslesme.ts üret
 *
 * İki çıktısı var:
 *  1. TR slug → Ahn malzeme id. Eşleşen malzemeler yaklaşık "aroma ailesi"
 *     setini bırakıp GERÇEK bileşik setine geçiyor.
 *  2. Katalogda olmayan ama tariflerde sık geçen Ahn malzemelerinin listesi —
 *     katalog genişletmesinde neyi Türkçeleştireceğimizi bu belirliyor.
 */

import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { build } from './sources.ts';

interface AhnIngredient {
  id: number;
  name: string;
  category: string;
  compoundIds: number[];
  recipeCount: number;
}

const data = JSON.parse(fs.readFileSync(build('ahn.json'), 'utf8')) as {
  ingredients: AhnIngredient[];
};

const write = process.argv.includes('--write');

const norm = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim();

const byName = new Map<string, AhnIngredient>();
for (const a of data.ingredients) byName.set(norm(a.name), a);

/**
 * Elle eşleme.
 *
 * Otomatik eşleştirme burada yetmiyor: bizim katalog kesim ve çeşit ayrımı
 * yapıyor (kuzu but / kuzu pirzola / kuzu incik), Ahn ise tek bir `lamb`
 * tutuyor. Hangi kesimin hangi genel malzemeye bağlanacağı mutfak bilgisi,
 * otomatik çıkarılamaz.
 *
 * `null` = Ahn setinde karşılığı yok; malzeme aroma ailesi setinde kalır.
 */
const OVERRIDES: Record<string, string | null> = {
  // Et — Ahn kesim ayrımı yapmıyor
  'kuzu-but': 'lamb',
  'kuzu-pirzola': 'lamb',
  'kuzu-incik': 'lamb',
  'kuzu-kiyma': 'lamb',
  'kuzu-cigeri': 'mutton_liver',
  'dana-antrikot': 'beef',
  'dana-kusbasi': 'beef',
  'dana-kiyma': 'beef',
  'dana-kaburga': 'beef',
  'tavuk-gogsu': 'chicken',
  'tavuk-but': 'chicken',
  hindi: 'turkey',
  bildircin: null,
  'kuyruk-yagi': 'mutton',
  kavurma: 'lamb',
  pastirma: 'beef', // pastırma dana; cured_pork yanlış olurdu
  sucuk: null, // Ahn'da yalnızca domuz sosisi var

  // Deniz
  hamsi: null, // Ahn'da anchovy yok
  palamut: null,
  uskumru: 'mackerel',
  levrek: 'sea_bass',
  cipura: 'sea_bass', // çipura yok, beyaz deniz balığı vekili
  alabalik: null,
  somon: 'salmon',
  karides: 'shrimp',
  midye: 'mussel',
  kalamar: 'squid',
  lakerda: null,

  // Süt
  yogurt: 'yogurt',
  'suzme-yogurt': 'yogurt',
  ayran: 'buttermilk',
  kaymak: 'cream',
  tereyagi: 'butter',
  'beyaz-peynir': 'feta_cheese',
  kasar: 'cheese',
  'tulum-peyniri': 'cheese',
  lor: 'cottage_cheese',
  cokelek: 'cottage_cheese',
  'kars-gravyeri': 'gruyere_cheese',
  'keci-peyniri': 'goat_cheese',
  sut: 'milk',
  krema: 'cream',
  labne: 'yogurt',
  yumurta: 'egg',

  // Sebze
  patlican: null, // Ahn'da eggplant yok
  kabak: 'squash',
  domates: 'tomato',
  'domates-salcasi': 'tomato',
  'biber-salcasi': 'bell_pepper',
  'kirmizi-biber': 'bell_pepper',
  'yesil-biber': 'green_bell_pepper',
  'carliston-biber': 'bell_pepper',
  'kuru-sogan': 'onion',
  'taze-sogan': 'scallion',
  sarimsak: 'garlic',
  prasa: 'leek',
  havuc: 'carrot',
  kereviz: 'celery',
  ispanak: 'dried_spinach', // taze ıspanak Ahn'da yok
  pazi: null,
  semizotu: null,
  lahana: 'cabbage',
  karnabahar: 'cauliflower',
  brokoli: 'broccoli',
  bamya: 'okra',
  'taze-fasulye': 'raw_bean',
  bezelye: 'pea',
  enginar: 'artichoke',
  bakla: null,
  salatalik: 'cucumber',
  turp: 'radish',
  pancar: 'beet',
  patates: 'potato',
  'yer-elmasi': 'jerusalem_artichoke',
  'kuru-domates': 'tomato',
  kapari: null,
  'siyah-zeytin': 'olive',
  'yesil-zeytin': 'olive',
  'asma-yapragi': 'grape',
  mantar: 'mushroom',
  kuzugobegi: 'mushroom',

  // Ot
  maydanoz: 'parsley',
  dereotu: 'dill',
  nane: 'peppermint',
  'kuru-nane': 'peppermint',
  feslegen: 'basil',
  'taze-kekik': 'thyme',
  'kuru-kekik': 'oregano',
  tarhun: 'tarragon',
  roka: null,
  tere: 'watercress',
  'kisnis-yapragi': 'cilantro',
  defne: 'bay',
  biberiye: 'rosemary',
  adacayi: 'sage',

  // Baharat
  tuz: null,
  kimyon: 'cumin',
  'pul-biber': 'cayenne',
  isot: 'cayenne',
  karabiber: 'black_pepper',
  tarcin: 'cinnamon',
  yenibahar: null,
  karanfil: 'clove',
  kakule: 'cardamom',
  sumak: 'sumac', // Ahn'da var
  'cemen-otu': 'fenugreek',
  susam: 'sesame_seed',
  corekotu: null,
  zerdecal: 'turmeric',
  'kisnis-tohumu': 'coriander',
  'rezene-tohumu': 'fennel',
  anason: 'anise',
  safran: 'saffron',
  mahlep: 'cherry',
  zencefil: 'ginger',
  'kuru-zencefil': 'ginger',
  'hardal-tohumu': 'mustard',
  'toz-kirmizi-biber': 'bell_pepper', // paprika yok, kurutulmuş biber vekili
  'sarimsak-tozu': 'garlic',

  // Ekşi
  limon: 'lemon',
  'limon-kabugu': 'lemon_peel',
  'uzum-sirkesi': 'vinegar',
  'elma-sirkesi': 'vinegar',
  'nar-eksisi': null,
  'koruk-suyu': 'grape',
  hardal: 'mustard',

  // Tatlandırıcı
  seker: null, // şekerin uçucu bileşiği yok, doğru sonuç
  bal: 'honey',
  'uzum-pekmezi': 'grape',
  'dut-pekmezi': null,
  'keciboynuzu-pekmezi': 'carob',
  tahin: 'sesame_seed',
  'gul-suyu': 'rose',
  vanilya: 'vanilla',

  // Yağ
  zeytinyagi: 'olive_oil',
  'aycicek-yagi': 'sunflower_oil',
  'findik-yagi': 'hazelnut',
  'susam-yagi': 'sesame_oil',

  // İçecek
  'kirmizi-sarap': 'red_wine',
  'beyaz-sarap': 'white_wine',
  raki: 'anise',

  // Tahıl
  pirinc: 'rice',
  bulgur: 'wheat',
  'ince-bulgur': 'wheat',
  firik: 'wheat',
  eriste: 'wheat',
  makarna: 'macaroni',
  'arpa-sehriye': 'macaroni',
  kuskus: 'wheat',
  un: 'wheat',
  irmik: 'wheat',
  'misir-unu': 'corn',
  yufka: 'wheat_bread',
  ekmek: 'bread',
  tarhana: 'wheat',

  // Bakliyat
  'kirmizi-mercimek': 'lentil',
  'yesil-mercimek': 'lentil',
  nohut: 'chickpea',
  'kuru-fasulye': 'navy_bean',
  barbunya: 'bean',
  borulce: 'black_bean', // börülce vekili

  // Kuruyemiş
  findik: 'hazelnut',
  ceviz: 'walnut',
  badem: 'almond',
  'antep-fistigi': 'pistachio',
  'cam-fistigi': null,
  kestane: null,
  'ay-cekirdegi': 'sunflower_oil',

  // Kuru meyve
  'kuru-uzum': 'raisin',
  'kuru-kayisi': 'apricot',
  'kuru-incir': 'dried_fig',
  'kuru-erik': 'prune',
  hurma: 'date',

  // Meyve
  elma: 'apple',
  armut: 'pear',
  ayva: 'quince',
  kayisi: 'apricot',
  seftali: 'peach',
  erik: 'plum',
  visne: 'sour_cherry',
  kiraz: 'cherry',
  uzum: 'grape',
  nar: null,
  incir: 'fig',
  kavun: 'muskmelon',
  karpuz: 'watermelon',
  portakal: 'orange',
  mandalina: 'mandarin',
  'yaban-mersini': 'blueberry',
  cilek: 'strawberry',
  dut: null, // yalnızca mulberry_leaf var
  kizilcik: null, // kızılcık Cornus mas; cranberry farklı bitki
};

// ── Eşleştir ───────────────────────────────────────────────────────

interface Row {
  slug: string;
  nameTr: string;
  nameEn?: string;
  ahn?: AhnIngredient;
  how: 'elle' | 'otomatik' | 'yok';
}

const rows: Row[] = [];

for (const ing of INGREDIENTS) {
  const override = OVERRIDES[ing.slug];

  if (override === null) {
    rows.push({ slug: ing.slug, nameTr: ing.nameTr, nameEn: ing.nameEn, how: 'yok' });
    continue;
  }

  if (override) {
    const hit = byName.get(norm(override));
    rows.push({
      slug: ing.slug,
      nameTr: ing.nameTr,
      nameEn: ing.nameEn,
      ahn: hit,
      how: hit ? 'elle' : 'yok',
    });
    if (!hit) console.warn(`  ! elle eşleme Ahn'da yok: ${ing.slug} → "${override}"`);
    continue;
  }

  const auto = ing.nameEn ? byName.get(norm(ing.nameEn)) : undefined;
  rows.push({
    slug: ing.slug,
    nameTr: ing.nameTr,
    nameEn: ing.nameEn,
    ahn: auto,
    how: auto ? 'otomatik' : 'yok',
  });
}

const matched = rows.filter((r) => r.ahn);
const unmatched = rows.filter((r) => !r.ahn);

console.log('\n══ TR KATALOG → AHN EŞLEMESİ ══');
console.log(`  katalog malzeme:  ${rows.length}`);
console.log(`  eşleşen:          ${matched.length}`);
console.log(`  eşleşmeyen:       ${unmatched.length}`);
console.log(
  `  gerçek bileşik alacak: ${matched.filter((r) => r.ahn!.compoundIds.length > 0).length}`,
);

console.log('\n── EŞLEŞMEYENLER (aroma ailesi setinde kalır)');
for (const r of unmatched) {
  console.log(`  ${r.slug.padEnd(24)} ${r.nameTr}`);
}

// Aynı Ahn malzemesine bağlanan birden fazla TR malzemesi normal (kesimler),
// ama sürpriz olmasın diye raporluyoruz.
const collisions = new Map<string, string[]>();
for (const r of matched) {
  const key = r.ahn!.name;
  (collisions.get(key) ?? collisions.set(key, []).get(key)!).push(r.slug);
}
const shared = [...collisions.entries()].filter(([, v]) => v.length > 1);
console.log(`\n── ORTAK AHN KARŞILIĞI OLAN GRUPLAR (${shared.length})`);
for (const [ahn, slugs] of shared.slice(0, 14)) {
  console.log(`  ${ahn.padEnd(18)} ← ${slugs.join(', ')}`);
}

// ── Genişletme adayları ────────────────────────────────────────────

const usedAhnIds = new Set(matched.map((r) => r.ahn!.id));
const candidates = data.ingredients
  .filter((a) => !usedAhnIds.has(a.id) && a.recipeCount > 0 && a.compoundIds.length > 0)
  .sort((a, b) => b.recipeCount - a.recipeCount);

console.log(`\n── GENİŞLETME ADAYLARI (tariflerde geçen, katalogda olmayan): ${candidates.length}`);
for (const c of candidates.slice(0, 70)) {
  console.log(`  ${String(c.recipeCount).padStart(6)}  ${c.name.padEnd(26)} ${c.category}`);
}

fs.writeFileSync(
  build('genisletme-adaylari.json'),
  JSON.stringify(
    candidates.map((c) => ({
      name: c.name,
      category: c.category,
      recipeCount: c.recipeCount,
      compounds: c.compoundIds.length,
    })),
    null,
    2,
  ),
);
console.log('\ndata-build/genisletme-adaylari.json yazıldı');

if (write) {
  const mapping = Object.fromEntries(matched.map((r) => [r.slug, r.ahn!.id]));
  const compoundSets = Object.fromEntries(
    matched.map((r) => [r.slug, r.ahn!.compoundIds.slice().sort((a, b) => a - b)]),
  );

  // ── IDF: 1.525 dokümanlık gerçek korpustan ──────────────────────
  //
  // Aşama 1'de IDF'i 192 malzemeden hesaplıyorduk; istatistiksel olarak
  // zayıftı. Artık Ahn'ın tamamı (bileşik seti olan 1.525 malzeme) doküman
  // sayılıyor. Uygulamaya sadece kullandığımız bileşiklerin ağırlığı gidiyor,
  // yani 36.781 bağın tamamını paketlemek gerekmiyor.
  const docs = data.ingredients.filter((a) => a.compoundIds.length > 0);
  const df = new Map<number, number>();
  for (const d of docs) {
    for (const c of new Set(d.compoundIds)) df.set(c, (df.get(c) ?? 0) + 1);
  }

  const families = JSON.parse(
    fs.readFileSync('src/data/catalog/bilesik-eslesme.ts', 'utf8').match(/= (\{[\s\S]*?\});/)![1],
  ) as Record<string, number[]>;

  const used = new Set<number>();
  for (const ids of Object.values(compoundSets)) for (const id of ids) used.add(id);
  for (const ids of Object.values(families)) for (const id of ids) used.add(id);

  const idf: Record<number, number> = {};
  const names: Record<number, string> = {};
  const compoundById = new Map(
    (
      JSON.parse(fs.readFileSync(build('ahn.json'), 'utf8')) as {
        compounds: { id: number; name: string }[];
      }
    ).compounds.map((c) => [c.id, c.name]),
  );

  for (const id of [...used].sort((a, b) => a - b)) {
    const d = df.get(id) ?? 1;
    idf[id] = Math.round(Math.log(1 + docs.length / d) * 10000) / 10000;
    const n = compoundById.get(id);
    if (n) names[id] = n;
  }

  const out = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:map -- --write\` ile yenile.
 *
 * Türkçe katalog malzemelerinin Ahn et al. (2011) veri setindeki karşılıkları
 * ve o malzemelerin GERÇEK uçucu bileşik setleri.
 * Kaynak: Scientific Reports 1:196, doi:10.1038/srep00196
 *
 * ${matched.length}/${rows.length} malzeme eşleşti. Eşleşmeyenler (${unmatched.length}) çoğunlukla
 * Türk mutfağına özgü ürünler: ${unmatched
   .slice(0, 6)
   .map((r) => r.nameTr)
   .join(', ')}…
 * Onlar aroma ailesi setini kullanmaya devam ediyor.
 */

/** TR slug → Ahn malzeme id. */
export const AHN_INGREDIENT_ID: Record<string, number> = ${JSON.stringify(mapping, null, 2)};

/** TR slug → Ahn'ın o malzeme için verdiği gerçek bileşik id listesi. */
export const AHN_COMPOUNDS: Record<string, number[]> = ${JSON.stringify(compoundSets)};

/**
 * Bileşik başına IDF ağırlığı: w(c) = ln(1 + N / df(c)), N = ${docs.length}.
 *
 * Doküman kümesi Ahn'ın bileşik seti olan malzemelerinin TAMAMI. Aşama 1'de
 * bu hesap 192 malzemeden yapılıyordu ve "her şey her şeye benziyor" çıkıyordu;
 * artık ayırt edici bileşik gerçekten ayırt edici sayılıyor.
 */
export const COMPOUND_IDF: Record<number, number> = ${JSON.stringify(idf)};

/** Kullandığımız bileşiklerin adları — "neden?" ekranında gösterilir. */
export const COMPOUND_NAMES: Record<number, string> = ${JSON.stringify(names)};

export const AHN_COVERAGE = {
  total: ${rows.length},
  matched: ${matched.length},
  unmatched: ${unmatched.length},
  idfDocuments: ${docs.length},
  compoundsShipped: ${Object.keys(idf).length},
};
`;
  fs.writeFileSync('src/data/catalog/ahn-eslesme.ts', out);
  console.log('src/data/catalog/ahn-eslesme.ts yazıldı');
}
