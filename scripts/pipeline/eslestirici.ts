/**
 * Türkçe tarif korpusları için ortak eşleştirici.
 *
 * İki içe aktarıcı var — nefisyemektarifleri korpusu (`05-tarif-ithal.ts`) ve
 * yemek.com korpusu (`06-yemekcom-ithal.ts`). İkisi de aynı kataloğa, aynı
 * ölçü tablosuna ve aynı dört denetime bağlı. Kurallar tek yerde durmazsa
 * biri düzeltilip diğeri unutuluyor; bu dosya onları tek nüsha tutuyor.
 *
 * Buradaki her kural gerçek bir hatadan doğdu. Değiştirmeden önce üstündeki
 * yorumu oku.
 */

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { gramsFor } from '../../src/data/catalog/olcu.ts';

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
  // yemek.com korpusunda limon 33 kere "limonun suyu" diye geçiyor; iyelik
  // eki `stem` eşiğinin altında kaldığı için kendiliğinden çözülmüyor.
  'limonun suyu': 'limon',
  'taze sıkılmış limon suyu': 'limon',
  'sıkılmış limon suyu': 'limon',
  'yarım limon suyu': 'limon',
  'portakalın suyu': 'portakal',
  'bayat ekmek kırıntısı': 'galeta-unu',
  'ekmek kırıntısı': 'galeta-unu',
  'bayat ekmek içi': 'ekmek',
  'ekmek içi': 'ekmek',
  // Mercimek çorbası korpusun en çok tekrarlanan tarifi; "ya da"lı yazım
  // yüzünden hiçbiri alınamıyordu.
  'kırmızı ya da sarı mercimek': 'kirmizi-mercimek',
  'kırmızı veya sarı mercimek': 'kirmizi-mercimek',
  'sarı mercimek': 'kirmizi-mercimek',
  'tam buğday unu': 'un',
  'tam buğday un': 'un',
  'olgun muz': 'muz',
  'küçük boy muz': 'muz',
  'çiğ süt': 'sut',
  'beyaz biber': 'karabiber',
  'balzamik sirke': 'uzum-sirkesi',
  'balsamik sirke': 'uzum-sirkesi',
  'mısır konservesi': 'misir-konserve',
  'tavuk bonfile': 'tavuk-gogsu',
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


/**
 * Korpusta yemek olmayan "kür" içerikleri var: zayıflatan çay, detoks suyu,
 * öksürük şurubu. Bunlar tarif değil sağlık iddiası; uygulamada hiçbir işleri
 * yok ve menü kurucuda içecek diye karşımıza çıkıyorlardı.
 */
const JUNK_TITLE =
  /zayıflat|yağ yak|metabolizma|\bkür\b|kürü|detoks|öksürük|şifalı|ödem attıran|göbek eriten|kilo ver|horlama|uykuyu|kabızlık|bağışıklık|iyi gelen/i;

/**
 * Katı eşleştirme — yalnızca kesin ad, ASCII katlanmış ad ya da eş anlamlı.
 *
 * `resolve` tarif malzemelerinde işe yarayan gevşek geri düşüşlere sahip:
 * sıfat atma, kelime içinde arama, ilk kelimeye bakma. Tarifte bunlar iyi,
 * çünkü yanlış eşleşen bir malzeme en fazla gramajı bozar.
 *
 * Besin değeri tablosunda ise yanlış eşleşme kalıcı zarar: "tavuk suyu"
 * satırını "tavuk but"a bağlarsak o malzemenin kalorisi kalıcı olarak
 * yanlış olur ve bunu fark etmenin yolu yok. Burada eşleşmemeyi tercih
 * ediyoruz — kategori ortalaması yanlış rakamdan iyidir.
 */
function resolveStrict(name: string): string | undefined {
  const n = norm(name);
  if (n in SYN) return SYN[n] ?? undefined;
  return BY_NAME.get(n) ?? BY_FOLDED.get(fold(n));
}

/**
 * Eş anlamlı tablosunu da atlayan kimlik eşleşmesi — yalnızca katalog adının
 * kendisi ya da ASCII'ye katlanmış hâli.
 *
 * `SYN` bir **tarif** eşleştirme tablosu: "ton balığı konservesi" orada
 * `somon`a, "sosis" `sucuk`a, "yulaf ezmesi" `arpa-sehriye`ye bağlı. Tarifte
 * bu makul bir vekil — kataloğunda o malzeme yok, en yakınıyla yürüyor.
 * Besin değerinde ise yanlış: ton balığı 116 kcal, somon 208. Vekil eşleme
 * tabloya girerse o malzemenin kalorisi kalıcı olarak yanlış olur.
 */
function resolveExact(name: string): string | undefined {
  const n = norm(name);
  return BY_NAME.get(n) ?? BY_FOLDED.get(fold(n));
}

// ── Dışa açılan yüzey ──────────────────────────────────────────────

export {
  norm,
  fold,
  stem,
  core,
  resolve,
  resolveStrict,
  resolveExact,
  grams,
  slugify,
  esc,
  BY_SLUG,
  PROTEIN_GUARD,
  ANIMAL_CATS,
  NOT_FOOD,
  JUNK_TITLE,
  DESCRIPTOR,
};
