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
import { gramsFor } from '../../src/data/catalog/olcu.ts';
import { refineCategory } from '../../src/data/recipes/ad-kurallari.ts';
import { raw } from './sources.ts';

const write = process.argv.includes('--write');

const norm = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zçğıöşü0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BY_NAME = new Map<string, string>();
for (const i of INGREDIENTS) BY_NAME.set(norm(i.nameTr), i.slug);

/** Türkçe harfleri ASCII'ye katla — korpusta "sarimsak", "zeytinyagi" gibi yazımlar var. */
const fold = (s: string) =>
  s.replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');

const BY_FOLDED = new Map<string, string>();
for (const [n, slug] of BY_NAME) if (!BY_FOLDED.has(fold(n))) BY_FOLDED.set(fold(n), slug);

/**
 * Türkçe iyelik ekini at: "mantarı" → "mantar", "yağı" → "yağ".
 *
 * Katalogda ad "Kültür mantarı" yazıyor, korpusta ise düz "mantar" geçiyor;
 * ek atılmadan bu ikisi buluşmuyordu (tek başına 43 tarif kaybediyorduk).
 */
const stem = (w: string) =>
  w.length >= 6 ? w.replace(/(sı|si|su|sü|ı|i|u|ü)$/, '') : w;

/** Tek kelimelik girdiyi katalog adının içinde ara: "mantar" → "kültür mantarı". */
const BY_WORD = new Map<string, string>();
for (const i of INGREDIENTS) {
  for (const w of norm(i.nameTr).split(' ')) {
    if (w.length < 4) continue;
    if (!BY_WORD.has(w)) BY_WORD.set(w, i.slug);
    const st = stem(w);
    if (st.length >= 4 && !BY_WORD.has(st)) BY_WORD.set(st, i.slug);
  }
}

/**
 * Eş anlamlılar ve yazım hataları.
 *
 * Korpus kullanıcı girdisi olduğu için "tereayağı", "sarıkmsak", "çerliston"
 * gibi hatalar var; ayrıca aynı şeyin birkaç adı var. `null` = kasten atılıyor.
 */
const SYN: Record<string, string | null> = {
  'tere yağı': 'tereyagi',
  tereayağı: 'tereyagi',
  tereyağ: 'tereyagi',
  tereçağı: 'tereyagi',
  'eritilmiş tereyağı': 'tereyagi',
  sıvıyağ: 'sivi-yag',
  'sıvı yağ': 'sivi-yag',
  'ayçiçek yağı': 'aycicek-yagi',
  sarıkmsak: 'sarimsak',
  sarmısak: 'sarimsak',
  'sarımsak dişi': 'sarimsak',
  'çerliston biber': 'carliston-biber',
  'çarliston biber': 'carliston-biber',
  'sivri biber': 'carliston-biber',
  'yeşil sivri biber': 'carliston-biber',
  pulbiber: 'pul-biber',
  'kırmızı pulbiber': 'pul-biber',
  'kırmızı toz biber': 'toz-kirmizi-biber',
  'toz kırmızı biber': 'toz-kirmizi-biber',
  'tatlı kırmızı toz biber': 'toz-kirmizi-biber',
  'acı kırmızı toz biber': 'toz-kirmizi-biber',
  'kırmızı kapya biber': 'kirmizi-biber',
  'kapya biber': 'kirmizi-biber',
  biber: 'yesil-biber',
  kekik: 'kuru-kekik',
  'toz kekik': 'kuru-kekik',
  'taze nane': 'nane',
  'kurutulmuş nane': 'kuru-nane',
  soğan: 'kuru-sogan',
  'büyük boy soğan': 'kuru-sogan',
  'yeşil soğan': 'taze-sogan',
  'limon suyu': 'limon',
  'limon kabuğu': 'limon-kabugu',
  'limon kabuğu rendesi': 'limon-kabugu',
  'sıcak su': 'su',
  'ılık su': 'su',
  'soğuk su': 'su',
  'içme suyu': 'su',
  'kaynar su': 'su',
  'ılık süt': 'sut',
  'sıcak süt': 'sut',
  'toz şeker': 'seker',
  şeker: 'seker',
  'esmer şeker': 'seker',
  kıyma: 'dana-kiyma',
  'köftelik kıyma': 'dana-kiyma',
  'orta yağlı kıyma': 'dana-kiyma',
  'kavrulmuş kıyma': 'dana-kiyma',
  'dana kıyma': 'dana-kiyma',
  'kuzu kıyma': 'kuzu-kiyma',
  'kuşbaşı et': 'dana-kusbasi',
  'kuşbaşı doğranmış et': 'dana-kusbasi',
  'kuşbaşı dana eti': 'dana-kusbasi',
  et: 'dana-kusbasi',
  'tavuk göğsü': 'tavuk-gogsu',
  'haşlanmış tavuk': 'tavuk-gogsu',
  'tavuk baget': 'tavuk-but',
  'tavuk pirzola': 'tavuk-but',
  'rendelenmiş kaşar peynir': 'kasar',
  'rendelenmiş kaşar peyniri': 'kasar',
  'rendelenmiş kaşar': 'kasar',
  'kaşar peynir': 'kasar',
  'kaşar peyniri': 'kasar',
  'lor peyniri': 'lor',
  'sıvı krema': 'krema',
  'yumurta sarısı': 'yumurta',
  'yumurta akı': 'yumurta',
  'yumurta beyazı': 'yumurta',
  sirke: 'uzum-sirkesi',
  pekmez: 'uzum-pekmezi',
  'mısır nişastası': 'nisasta',
  'buğday nişastası': 'nisasta',
  'instant kuru maya': 'maya',
  'kuru maya': 'maya',
  'yaş maya': 'maya',
  'çörek otu': 'corekotu',
  'konserve mısır': 'misir-konserve',
  konservemısır: 'misir-konserve',
  'haşlanmış konserve mısır': 'misir-konserve',
  mısır: 'misir-konserve',
  'kornişon turşu': 'kuru-soganli-tursu',
  turşu: 'kuru-soganli-tursu',
  'çeri domatesi': 'domates',
  'domates rendesi': 'domates',
  'bostan patlıcanı': 'patlican',
  zeytin: 'siyah-zeytin',
  'kültür mantarı': 'mantar',
  'yeşil toz fıstık': 'antep-fistigi',
  fıstık: 'antep-fistigi',
  'kuş üzümü': 'kuru-uzum-kus',
  'toz krem şanti': 'krem-santi',
  'krem şanti tozu': 'krem-santi',
  'damla çikolata': 'bitter-cikolata',
  'sütlü çikolata': 'bitter-cikolata',
  'çikolata sosu': 'bitter-cikolata',
  'hazır çikolata sosu': 'bitter-cikolata',
  nutella: 'bitter-cikolata',
  çikolata: 'bitter-cikolata',
  'petibör bisküvi': 'biskuvi',
  'pötibör bisküvi': 'biskuvi',
  'kedi dili bisküvi': 'biskuvi',
  'kakaolu petibör bisküvi': 'biskuvi',
  'mısır gevreği': 'biskuvi',
  'kare milföy': 'milfoy',
  'milföy hamuru': 'milfoy',
  'mavi haşhaş': 'hashas',
  'brüksel lahanası': 'brokoli-bruksel',
  garnitür: 'bezelye',
  'hazır garnitür': 'bezelye',
  'aşurelik buğday': 'bulgur',
  buğday: 'bulgur',
  'kaya tuzu': 'tuz',
  'deniz tuzu': 'tuz',
  'hindistan cevizi rendesi': 'hindistan-cevizi',
  'köri baharatı': 'kori',
  'buğday unu': 'un',
  vanilin: 'vanilya',
  'vanilya özütü': 'vanilya',
  salça: 'domates-salcasi',
  dolusudomates: 'domates-salcasi',
  'dolusudomates salçası': 'domates-salcasi',
  'süt kreması': 'krema',
  'sıvı krem': 'krema',
  'soğuk süt': 'sut',
  'lor peynir': 'lor',
  'bal kabağı': 'kabak',
  'süzme bal': 'bal',
  'toz zencefil': 'kuru-zencefil',
  'dolmalık fıstık': 'cam-fistigi',
  'kemiksiz tavuk pirzola': 'tavuk-but',
  'tavuk budu': 'tavuk-but',
  'hellim peyniri': 'kasar',
  'haşlanmış mısır': 'misir-konserve',
  etimek: 'ekmek',
  'ton balığı': 'somon',
  'çikolatalı sos': 'bitter-cikolata',
  'dana eti': 'dana-kusbasi',
  'kırmızı et': 'dana-kusbasi',
  'kuşbaşı kuzu eti': 'kuzu-but',
  'kuzu eti': 'kuzu-but',
  'tavuk incik': 'tavuk-but',
  'yulaf ezmesi': 'arpa-sehriye',
  'granül kahve': null,
  'cennet hurması': 'hurma',
  'tavuk göğüsü': 'tavuk-gogsu',
  'tavuk bageti': 'tavuk-but',
  'tavuk ciğeri': 'kuzu-cigeri',
  'kuzu gerdan': 'kuzu-but',
  'kuzu sırt': 'kuzu-pirzola',
  'kuzu külbastı': 'kuzu-pirzola',
  'dana incik': 'kuzu-incik',
  'kolyoz balığı': 'uskumru',
  kolyoz: 'uskumru',
  'ezine peynir': 'beyaz-peynir',
  'ezine peyniri': 'beyaz-peynir',
  tortilla: 'yufka',
  'ramazan pidesi': 'ekmek',
  'köfte baharı': null,
  'yağlı kağıt': null,
  'pişirme kağıdı': null,
  'tavuk kanat': 'tavuk-but',
  'tavuk kanadı': 'tavuk-but',
  'tavuk kalça': 'tavuk-but',
  'bütün tavuk': 'tavuk-but',
  'tavuk fileto': 'tavuk-gogsu',
  'tavuk göğsü fileto': 'tavuk-gogsu',
  'tavuk şinitzel': 'tavuk-gogsu',
  'dana bonfile': 'dana-antrikot',
  'dana rosto': 'dana-kusbasi',
  'ton balığı konservesi': 'somon',
  lavaş: 'yufka',
  'lavaş ekmeği': 'yufka',
  'tuzsuz etimek': 'ekmek',
  'parmesan peyniri': 'kasar',
  'mozzarella peyniri': 'kasar',
  'dil peyniri': 'kasar',
  salam: 'sucuk',
  sosis: 'sucuk',
  süzmeyoğurt: 'suzme-yogurt',
  'süt tozu': 'sut',
  'dolmalık biber': 'kirmizi-biber',
  'kurutulmuş acı biber': 'pul-biber',
  'mürdüm eriği': 'erik',
  'dövülmüş ceviz içi': 'ceviz',
  'ceviz içi': 'ceviz',
  zeytinyağ: 'zeytinyagi',
  'silme tuz': 'tuz',
  'krem çikolata': 'bitter-cikolata',
  // modele girmeyenler
  terbiye: null,
  'kakaolu puding': null,
  nescafe: null,
  'krema tozu': null,
  jelatin: null,
  şerbet: null,
  'süs şekeri': null,
  'gıda boyası': null,
  'kabartma': null,
};

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

const BY_SLUG = new Map(INGREDIENTS.map((i) => [i.slug, i]));

/**
 * Hazırlık sıfatları ve bölüm başlıkları.
 *
 * Korpusta malzeme adı çoğu zaman bir cümle: "kuşbaşı doğranmış tavuk kalça
 * eti". Sıfatları atınca geriye katalogda aranabilir bir çekirdek kalıyor.
 * "beşamel sos için" gibi satırlar ise malzeme değil bölüm başlığı; asıl
 * malzemeler onları izleyen satırlarda geliyor.
 */
const DESCRIPTOR =
  /\b(kuşbaşı|doğranmış|doğranmis|kıyılmış|kıyılmis|rendelenmiş|dilimlenmiş|haşlanmış|közlenmiş|kavrulmuş|ezilmiş|çekilmiş|soyulmuş|süzülmüş|dövülmüş|derisiz|kemikli|kemiksiz|yağsız|tuzsuz|az yağlı|orta boy|iri|ince|kalın|büyük|küçük|bir|adet|paket|hazır|iyi|güzel)\b/g;

function core(n: string): string {
  return n
    .replace(DESCRIPTOR, ' ')
    .replace(/\b(eti|et)\b$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolve(name: string): string | null | undefined {
  // "beşamel sos için: un", "üzeri için: kaşar" → iki nokta sonrası asıl malzeme.
  // "toz şeker (şerbet)" → parantez içi açıklama, malzemenin parçası değil.
  const noParen = name.replace(/\([^)]*\)/g, ' ');
  const bare = noParen.includes(':') ? noParen.slice(noParen.lastIndexOf(':') + 1) : noParen;
  const n = norm(bare);
  if (n in SYN) return SYN[n];
  const direct = BY_NAME.get(n);
  if (direct) return direct;
  const folded = BY_FOLDED.get(fold(n));
  if (folded) return folded;
  // "beşamel sos için", "üzeri için" — malzeme değil, bölüm başlığı.
  if (/\biçin$/.test(n)) return null;

  const word = BY_WORD.get(n) ?? BY_WORD.get(stem(n));
  if (word) return word;

  // Sıfatları atıp çekirdekle yeniden dene.
  const c = core(n);
  if (c && c !== n) {
    if (c in SYN) return SYN[c];
    const byCore = BY_NAME.get(c) ?? BY_FOLDED.get(fold(c)) ?? BY_WORD.get(c) ?? BY_WORD.get(stem(c));
    if (byCore) return byCore;
    for (const [cn, slug] of BY_NAME) {
      if (cn.length < 4) continue;
      if (c === cn || c.endsWith(' ' + cn) || c.startsWith(cn + ' ')) return slug;
    }
    // Çok kelimeli çekirdekte son kelime genelde asıl malzeme: "tavuk kalça" → yok,
    // ama "tavuk göğüs" → "göğüs" tek başına anlamsız; bu yüzden ilk kelimeyi deniyoruz.
    const first = c.split(' ')[0];
    if (first.length >= 4) {
      const byFirst = BY_WORD.get(first) ?? BY_WORD.get(stem(first));
      if (byFirst) return byFirst;
    }
  }
  for (const [cn, slug] of BY_NAME) {
    if (cn.length < 4) continue;
    if (n === cn || n.endsWith(' ' + cn) || n.startsWith(cn + ' ')) return slug;
  }
  return undefined;
}

/** Ölçü tabloları `src/data/catalog/olcu.ts`'te — uygulama da aynısını kullanıyor. */
const grams = (slug: string, amount: number | null, unit: string | null) =>
  gramsFor(amount, norm(unit ?? ''), slug, BY_SLUG.get(slug)?.category);

const slugify = (s: string) =>
  norm(s)
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 58);

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();

/**
 * Ana malzeme güvenlik ağı.
 *
 * Korpusta "Fırında Tavuk Pirzola" tarifinin malzeme listesinde tavuk yoktu:
 * ölçü satırı eşleşmemiş, kapsam eşiği de diğer 12 malzeme sayesinde tutmuştu.
 * Sonuç, adı tavuk olan etsiz bir tarif — vejetaryen filtresinden geçiyor ve
 * kullanıcıya yalan söylüyor. Ad ana malzemeyi söylüyorsa ve tabakta hiç
 * hayvansal protein yoksa, makul bir miktarla ekliyoruz.
 */
/**
 * Kelime sınırları şart: sınırsız `/hindi/` "Hindistan Cevizli Truff"u
 * yakalayıp tatlıya 800 g hindi eti ekliyordu. Aynı tuzak `kuzu` →
 * "kuzugöbeği" (mantar) ve `dana` → "Adana" için de geçerli.
 */
const PROTEIN_GUARD: { re: RegExp; slug: string; g: number; not?: RegExp }[] = [
  { re: /\bkarides\b/i, slug: 'karides', g: 400 },
  { re: /\bmidye\b/i, slug: 'midye', g: 600 },
  { re: /\bkalamar\b/i, slug: 'kalamar', g: 400 },
  { re: /\bhamsi\b/i, slug: 'hamsi', g: 700 },
  { re: /\blevrek\b/i, slug: 'levrek', g: 700 },
  { re: /\bçipura\b/i, slug: 'cipura', g: 700 },
  { re: /\bsomon\b/i, slug: 'somon', g: 500 },
  { re: /\buskumru\b/i, slug: 'uskumru', g: 700 },
  { re: /\bpalamut\b|\blakerda\b/i, slug: 'palamut', g: 700 },
  { re: /\balabalık\b/i, slug: 'alabalik', g: 700 },
  { re: /\btavuk\b|\bpiliç\b/i, slug: 'tavuk-but', g: 800 },
  { re: /\bhindi\b/i, slug: 'hindi', g: 800 },
  { re: /\bkuzu\b|\bincik\b|\bpirzola\b/i, slug: 'kuzu-but', g: 700 },
  { re: /\bdana\b|\bbiftek\b|\bantrikot\b|\bbonfile\b|\bkavurma\b|\brosto\b/i, slug: 'dana-kusbasi', g: 600 },
  { re: /\bsucuk\b/i, slug: 'sucuk', g: 150 },
  { re: /\bpastırma\b/i, slug: 'pastirma', g: 100 },
  // Etsiz köfteler var: mercimek, çiğ köfte, patates köftesi.
  {
    re: /\bkıyma\b|\bköfte\b|\bkebap\b|\bkebabı\b|\blahmacun\b/i,
    slug: 'dana-kiyma',
    g: 400,
    not: /mercimek|çiğ köfte|bulgur köfte|patates köfte|nohut|sebze|vegan|vejetaryen|analı kızlı/i,
  },
  { re: /\byumurta\b|\bomlet\b|\bmenemen\b|\bsahanda\b/i, slug: 'yumurta', g: 110 },
];

const ANIMAL_CATS = new Set(['protein', 'deniz', 'sarkuteri']);

/**
 * Ad denetiminde sayılmayan kelimeler: hazırlık ve sunum sözcükleri.
 * "Kağıtta Levrek" tarifinde eşleşmeyen satır "yağlı kağıt" — pişirme
 * kağıdı malzeme değil, tarif de yalan söylemiyor.
 */
const NOT_FOOD = new Set([
  'kağıt', 'kağıdı', 'dilim', 'dilimleri', 'dilimlenmiş', 'baharı', 'baharat',
  'harcı', 'sosu', 'için', 'üzeri', 'tabanı', 'kalıbı', 'servis', 'süsleme',
  'taban', 'malzemeleri', 'karışımı', 'suyu', 'tarifi',
]);

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

/**
 * Korpusta yemek olmayan "kür" içerikleri var: zayıflatan çay, detoks suyu,
 * öksürük şurubu. Bunlar tarif değil sağlık iddiası; uygulamada hiçbir işleri
 * yok ve menü kurucuda içecek diye karşımıza çıkıyorlardı.
 */
const JUNK_TITLE =
  /zayıflat|yağ yak|metabolizma|\bkür\b|kürü|detoks|öksürük|şifalı|ödem attıran|göbek eriten|kilo ver|horlama|uykuyu|kabızlık|bağışıklık|iyi gelen/i;

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

  for (const m of mapped) usedIngredients.add(m.slug);
  taken += 1;

  lines.push(
    `  { s: '${slug}', n: '${esc(r.tarif_adi)}', c: '${cat}', m: ${mins}, d: ${diff}, ` +
      `srv: ${r.porsiyon ?? 4}, me: '${method}',\n` +
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
