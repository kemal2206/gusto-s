/**
 * Ev ölçüleri — gramı mutfak diline çevirme.
 *
 * Sorun basit: çoğu evde hassas tartı yok. "45 g un" kimseye bir şey
 * anlatmıyor, "3 yemek kaşığı un" herkese anlatıyor.
 *
 * İki şey gerekiyor ve ikisi de malzemeye özel:
 *
 *  1. **Hangi ölçü uygun.** Tavuğu çay bardağıyla ölçemezsin. Her malzemenin
 *     bir *biçimi* var (sıvı, toz, macun, baharat, tane, sap) ve yalnızca o
 *     biçimin izin verdiği ölçüler kullanılıyor. Uymayan malzeme gramda kalıyor.
 *
 *  2. **Yoğunluk.** Kaşık ve bardak hacim ölçer, tarif kütle yazar. Bir su
 *     bardağı su 200 g, aynı bardak un 110 g, bal 285 g. Tek bir "bardak =
 *     200 g" sayısı kullanmak unu iki katına çıkarıyor — eski tabloda tam
 *     olarak bu hata vardı.
 *
 * Bu dosya hem gösterimde (tarif sayfası) hem içe aktarmada kullanılıyor;
 * ikisinin aynı sayıları kullanması şart, yoksa "2 su bardağı un" içeri
 * 400 g olarak girip dışarı 3,5 bardak olarak çıkıyor.
 */

import type { TasteVector } from '@/engine';

// ── Ölçü birimleri ─────────────────────────────────────────────────

export type MeasureId =
  | 'su-bardagi'
  | 'cay-bardagi'
  | 'yemek-kasigi'
  | 'tatli-kasigi'
  | 'cay-kasigi'
  | 'pencik'
  | 'tutam'
  | 'adet'
  | 'dis'
  | 'avuc'
  | 'demet';

interface Measure {
  id: MeasureId;
  labelTr: string;
  /** Hacim ölçüleri için ml; tane/sap ölçüleri için yok. */
  ml?: number;
  /** Doğrudan gram verilen ölçüler (tutam, pençik) — hacmi anlamsız. */
  grams?: number;
}

/**
 * Büyükten küçüğe. Sıra önemli: dönüşüm en büyük uyan ölçüyü seçiyor,
 * yoksa 200 g un "13 yemek kaşığı" diye yazılıyor.
 */
const MEASURES: Measure[] = [
  { id: 'su-bardagi', labelTr: 'su bardağı', ml: 200 },
  { id: 'cay-bardagi', labelTr: 'çay bardağı', ml: 100 },
  { id: 'yemek-kasigi', labelTr: 'yemek kaşığı', ml: 15 },
  { id: 'tatli-kasigi', labelTr: 'tatlı kaşığı', ml: 7 },
  { id: 'cay-kasigi', labelTr: 'çay kaşığı', ml: 5 },
  // Parmak ölçüleri yaklaşık: pençik beş parmakla alınan, tutam üç parmakla.
  { id: 'pencik', labelTr: 'pençik', grams: 1.5 },
  { id: 'tutam', labelTr: 'tutam', grams: 0.5 },
];

// ── Malzeme biçimleri ──────────────────────────────────────────────

/**
 * Malzemenin hangi ölçülerle ölçülebildiği.
 *
 * `yok` olanlar kasten gramda bırakılıyor: eti, balığı, patlıcanı kaşıkla
 * ölçmek diye bir şey yok.
 */
export type MeasureForm = 'sivi' | 'toz' | 'macun' | 'baharat' | 'adet' | 'dis' | 'demet' | 'yok';

/** Her biçimin kullanabileceği ölçüler — büyükten küçüğe. */
const ALLOWED: Record<MeasureForm, MeasureId[]> = {
  sivi: ['su-bardagi', 'cay-bardagi', 'yemek-kasigi', 'tatli-kasigi', 'cay-kasigi'],
  toz: ['su-bardagi', 'cay-bardagi', 'yemek-kasigi', 'tatli-kasigi', 'cay-kasigi'],
  // Salçayı bardakla ölçen yok; en büyüğü yemek kaşığı.
  macun: ['su-bardagi', 'cay-bardagi', 'yemek-kasigi', 'tatli-kasigi', 'cay-kasigi'],
  // Baharatta bardak yok: bir bardak kimyon diye bir şey olmaz.
  baharat: ['yemek-kasigi', 'tatli-kasigi', 'cay-kasigi', 'pencik', 'tutam'],
  adet: ['adet'],
  dis: ['dis'],
  demet: ['demet'],
  yok: [],
};

/** Bardakla ölçülmesi tuhaf kaçan macunlar — en büyüğü yemek kaşığı. */
const SPOON_ONLY = new Set([
  'domates-salcasi', 'biber-salcasi', 'tahin', 'bal', 'uzum-pekmezi', 'dut-pekmezi',
  'keciboynuzu-pekmezi', 'hardal', 'ketcap', 'mayonez', 'miso', 'gochujang',
  'kari-macunu', 'nar-eksisi', 'soya-sosu', 'balik-sosu', 'susam-yagi', 'gul-suyu',
]);

/** Kategori varsayılanı; slug'a özel kural yoksa bu geçerli. */
const FORM_BY_CATEGORY: Record<string, MeasureForm> = {
  protein: 'yok',
  deniz: 'yok',
  sarkuteri: 'yok',
  mantar: 'yok',
  sebze: 'yok',
  meyve: 'yok',
  sut: 'sivi',
  yag: 'sivi',
  asit: 'sivi',
  icecek: 'sivi',
  tahil: 'toz',
  baklagil: 'toz',
  kuruyemis: 'toz',
  baharat: 'baharat',
  ot: 'demet',
  tatlandirici: 'toz',
  diger: 'sivi',
};

/** Kategorisinin varsayılanına uymayan malzemeler. */
const FORM_BY_SLUG: Record<string, MeasureForm> = {
  // Sıvı sayılmayan süt ürünleri
  yogurt: 'macun', 'suzme-yogurt': 'macun', kaymak: 'macun', labne: 'macun',
  'krem-santi': 'macun',
  'beyaz-peynir': 'yok', kasar: 'yok', 'tulum-peyniri': 'yok', lor: 'yok',
  cokelek: 'yok', 'kars-gravyeri': 'yok', 'keci-peyniri': 'yok',

  // Katı yağlar
  tereyagi: 'macun', margarin: 'macun', 'kuyruk-yagi': 'yok', mayonez: 'macun',

  // Salçalar sebze kategorisinde ama macun
  'domates-salcasi': 'macun', 'biber-salcasi': 'macun',

  // Tane olarak sayılan sebze ve meyveler
  'kuru-sogan': 'adet', 'taze-sogan': 'demet', domates: 'adet', patates: 'adet',
  havuc: 'adet', patlican: 'adet', kabak: 'adet', 'kirmizi-biber': 'adet',
  'yesil-biber': 'adet', 'carliston-biber': 'adet', salatalik: 'adet',
  marul: 'adet', prasa: 'adet', turp: 'adet', pancar: 'adet',
  sarimsak: 'dis',
  limon: 'adet', 'misket-limonu': 'adet', 'kuru-limon': 'adet',
  portakal: 'adet', mandalina: 'adet', enginar: 'adet',
  elma: 'adet', armut: 'adet', ayva: 'adet', muz: 'adet', seftali: 'adet',
  kayisi: 'adet', erik: 'adet', incir: 'adet', nar: 'adet',

  // Tahılın hepsi toz değil
  yufka: 'adet', ekmek: 'adet', 'tost-ekmegi': 'adet', milfoy: 'adet',
  makarna: 'yok', eriste: 'toz', 'pirinc-eristesi': 'yok', 'ramen-eristesi': 'yok',
  kadayif: 'yok', biskuvi: 'adet',

  // Yumurta ve tofu
  yumurta: 'adet', tofu: 'yok',

  // Baharat gibi davranan kuru otlar ve küçük tohumlar
  'kuru-nane': 'baharat', 'kuru-kekik': 'baharat', defne: 'adet',
  susam: 'toz', hashas: 'toz',

  // Sıvı asitler ve turşular
  'limon-kabugu': 'baharat',
  'siyah-zeytin': 'toz', 'yesil-zeytin': 'toz', kapari: 'baharat',
  'kuru-soganli-tursu': 'yok', kimchi: 'yok', 'misir-konserve': 'toz',
  'kuru-domates': 'yok', 'asma-yapragi': 'adet',

  // Kuru meyveler kaşıkla/bardakla ölçülebiliyor
  'kuru-uzum': 'toz', 'kuru-uzum-kus': 'toz', 'kuru-kayisi': 'toz',
  'kuru-incir': 'toz', 'kuru-erik': 'toz', hurma: 'adet',
  'yaban-mersini': 'toz', cilek: 'toz', visne: 'toz', kiraz: 'toz',
  uzum: 'toz', dut: 'toz', kizilcik: 'toz', zeresk: 'toz',
  kavun: 'yok', karpuz: 'yok',

  // Kuruyemişler bütünken tane, doğranmışken kaşık — kaşığı seçiyoruz
  kestane: 'adet', 'hindistan-cevizi': 'toz',

  // Tatlandırıcıların akışkan olanları
  bal: 'macun', 'uzum-pekmezi': 'macun', 'dut-pekmezi': 'macun',
  'keciboynuzu-pekmezi': 'macun', tahin: 'macun', 'gul-suyu': 'sivi',
  mirin: 'sivi',

  // Diğer
  maya: 'baharat', karbonat: 'baharat', 'kabartma-tozu': 'baharat',
  tarhana: 'toz', 'bitter-cikolata': 'toz', vanilya: 'baharat',
  safran: 'baharat',
};

export function measureFormOf(slug: string, category: string): MeasureForm {
  return FORM_BY_SLUG[slug] ?? FORM_BY_CATEGORY[category] ?? 'yok';
}

// ── Yoğunluk (g/ml) ────────────────────────────────────────────────

/**
 * Bir mililitresi kaç gram.
 *
 * En kritik satırlar un, şeker ve bal: eski tabloda üçü de 1,0 sayılıyordu
 * ve un neredeyse iki katına çıkıyordu.
 */
const DENSITY: Record<string, number> = {
  // Sıvılar
  su: 1.0, sut: 1.03, ayran: 1.02, 'et-suyu': 1.0, 'tavuk-suyu': 1.0,
  krema: 1.0, 'hindistan-cevizi-sutu': 0.97, soda: 1.0, 'maden-suyu': 1.0,
  zeytinyagi: 0.92, 'aycicek-yagi': 0.92, 'sivi-yag': 0.92, 'findik-yagi': 0.92,
  'susam-yagi': 0.92, tereyagi: 0.91, margarin: 0.9,
  'uzum-sirkesi': 1.01, 'elma-sirkesi': 1.01, 'pirinc-sirkesi': 1.01,
  limon: 1.03, 'koruk-suyu': 1.03, 'soya-sosu': 1.15, 'balik-sosu': 1.2,
  'nar-eksisi': 1.3, 'gul-suyu': 1.0, mirin: 1.1,
  'kirmizi-sarap': 0.99, 'beyaz-sarap': 0.99, raki: 0.94,

  // Macunlar
  yogurt: 1.03, 'suzme-yogurt': 1.05, labne: 1.0, kaymak: 0.9, 'krem-santi': 0.4,
  'domates-salcasi': 1.1, 'biber-salcasi': 1.1, tahin: 1.1,
  bal: 1.42, 'uzum-pekmezi': 1.4, 'dut-pekmezi': 1.4, 'keciboynuzu-pekmezi': 1.4,
  hardal: 1.05, ketcap: 1.1, mayonez: 0.95, miso: 1.15, gochujang: 1.2,
  'kari-macunu': 1.1,

  // Tozlar ve taneler
  un: 0.55, 'misir-unu': 0.6, 'pirinc-unu': 0.6, 'galeta-unu': 0.5,
  nisasta: 0.6, irmik: 0.75, tarhana: 0.55,
  seker: 0.85, 'pudra-sekeri': 0.55, kakao: 0.4, 'bitter-cikolata': 0.7,
  pirinc: 0.85, bulgur: 0.8, 'ince-bulgur': 0.85, kuskus: 0.75, firik: 0.75,
  sehriye: 0.7, 'arpa-sehriye': 0.7, eriste: 0.35,
  'kirmizi-mercimek': 0.85, 'yesil-mercimek': 0.85, nohut: 0.8,
  'kuru-fasulye': 0.8, barbunya: 0.8, borulce: 0.8,
  susam: 0.6, hashas: 0.6, 'hindistan-cevizi': 0.35,
  findik: 0.55, ceviz: 0.5, badem: 0.55, 'antep-fistigi': 0.55,
  'cam-fistigi': 0.6, 'ay-cekirdegi': 0.5, 'yer-fistigi': 0.6,
  'kuru-uzum': 0.65, 'kuru-uzum-kus': 0.65, 'kuru-kayisi': 0.6,
  'kuru-incir': 0.6, 'kuru-erik': 0.6,
  'yaban-mersini': 0.65, cilek: 0.6, visne: 0.7, kiraz: 0.7, uzum: 0.65,
  dut: 0.6, kizilcik: 0.65, zeresk: 0.55,
  'siyah-zeytin': 0.75, 'yesil-zeytin': 0.75, 'misir-konserve': 0.7,

  // Baharatlar
  tuz: 1.2, karabiber: 0.45, 'pul-biber': 0.4, isot: 0.4,
  'toz-kirmizi-biber': 0.45, kimyon: 0.5, tarcin: 0.45, zerdecal: 0.55,
  'sarimsak-tozu': 0.5, maya: 0.6, karbonat: 0.9, 'kabartma-tozu': 0.9,
};

/** Kategori varsayılanı — tabloda olmayan malzemeler için. */
const DENSITY_BY_CATEGORY: Record<string, number> = {
  sut: 1.0, yag: 0.92, asit: 1.03, icecek: 1.0, diger: 1.0,
  tahil: 0.7, baklagil: 0.8, kuruyemis: 0.55, meyve: 0.65,
  tatlandirici: 1.0, baharat: 0.5, ot: 0.25, sebze: 0.6,
};

export function densityOf(slug: string, category: string): number {
  return DENSITY[slug] ?? DENSITY_BY_CATEGORY[category] ?? 1.0;
}

// ── Tane ölçüleri ──────────────────────────────────────────────────

/**
 * Bir adet kaç gram.
 *
 * Gösterimde yalnızca `adet` biçimindeki malzemeler için kullanılıyor, ama
 * içe aktarma tabloyu daha geniş kullanıyor: korpusta "1 adet tavuk göğsü"
 * gibi satırlar var ve grama çevrilmeleri gerekiyor. Bu yüzden ekranda
 * "adet" ile gösterilmeyen birkaç malzeme de burada duruyor.
 */
export const PIECE_G: Record<string, number> = {
  'tavuk-gogsu': 180, 'tavuk-but': 200,
  yumurta: 55, 'kuru-sogan': 110, domates: 120, patates: 150, havuc: 80,
  limon: 60, 'misket-limonu': 45, patlican: 250, kabak: 200,
  'kirmizi-biber': 90, 'yesil-biber': 40, 'carliston-biber': 45,
  'kuru-limon': 8, enginar: 120,
  salatalik: 150, elma: 160, muz: 120, portakal: 180, mandalina: 90,
  armut: 170, ayva: 200, seftali: 130, kayisi: 45, erik: 60, incir: 55,
  nar: 300, hurma: 8, kestane: 12, marul: 300, prasa: 200, turp: 25,
  pancar: 150, yufka: 80, ekmek: 300, 'tost-ekmegi': 30, milfoy: 100,
  biskuvi: 8, 'asma-yapragi': 3, defne: 0.2,
};

/** Bir diş sarımsak, bir avuç ot, bir demet ot kaç gram. */
const DIS_G = 4;
const AVUC_G = 30;
const DEMET_G = 60;
/** Taze otta bir tutam — baharat tutamından (0,5 g) iri, sap sap alınıyor. */
const OT_TUTAM_G = 5;

// ── Dönüşüm ────────────────────────────────────────────────────────

export interface HouseholdMeasure {
  /** "1,5 su bardağı", "yarım çay bardağı", "2 diş" gibi. */
  text: string;
  measureId: MeasureId;
  count: number;
  /**
   * Bu ölçüyü uygulayan kişinin gerçekte koyduğu gram.
   *
   * Tariften farklı olabilir — yuvarlamanın bedeli bu. Tada etkisini
   * ölçebilmek için (bkz. `npm run smoke:tat`) açıkça döndürülüyor.
   */
  appliedGrams: number;
}

/**
 * Kesirler mutfakta gerçekten söylendiği gibi: çeyrek, yarım, buçuk.
 *
 * "Üçte iki tatlı kaşığı" ya da "çeyrek eksik bir bardak" matematiksel olarak
 * daha yakın olabilir ama kimse öyle konuşmuyor; listeyi kasten dar tutuyoruz
 * ve uymayan miktar bir alt ölçüye düşüyor.
 */
const NICE = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8];

function snap(value: number): number | null {
  let best: number | null = null;
  let bestErr = Infinity;

  for (const n of NICE) {
    const err = Math.abs(value - n) / n;
    if (err < bestErr) {
      bestErr = err;
      best = n;
    }
  }
  // %18'den fazla sapıyorsa bu ölçü uymuyor demektir; daha küçüğü denenecek.
  return bestErr <= 0.18 ? best : null;
}

function countText(n: number): string {
  if (Math.abs(n - 0.25) < 0.01) return 'çeyrek';
  if (Math.abs(n - 0.5) < 0.01) return 'yarım';
  if (Math.abs(n - 1.5) < 0.01) return 'bir buçuk';
  if (Number.isInteger(n)) return String(n);
  return String(n).replace('.', ',');
}

/**
 * Gramı ev ölçüsüne çevirir. Uygun ölçü yoksa `null` — o zaman gram yazılıyor.
 */
export function toHouseholdMeasure(
  slug: string,
  category: string,
  grams: number,
  /**
   * İzin verilen bağıl sapma. Ölçünün gram karşılığı tarifin gramından bu
   * orandan fazla ayrılıyorsa ölçü gösterilmiyor, gram kalıyor.
   *
   * Tarif bağlamında `measureTolerances` ile hesaplanıyor: tabakta ağırlığı
   * olan ve sesi yüksek malzemenin toleransı dar, kenardakinin geniş.
   * Bağlam yoksa makul bir varsayılan.
   */
  maxDrift = 0.4,
): HouseholdMeasure | null {
  if (grams <= 0) return null;

  const fits = (applied: number) => Math.abs(applied - grams) / grams <= maxDrift;

  const form = measureFormOf(slug, category);
  if (form === 'yok') return null;

  if (form === 'adet') {
    const per = PIECE_G[slug];
    if (!per) return null;

    /**
     * Tanede kesir yok, tam sayı.
     *
     * "Yarım adet soğan" mutfakta yazılmaz; pazardan yarım soğan da alınmaz.
     * Tablodaki tane ağırlığı zaten ortalama — bir soğan 80 g da olur 140 g
     * da — o yüzden yuvarlamayı serbest bırakıp tam sayı veriyoruz. Kesin
     * miktarı isteyen yanındaki gramı okuyor.
     *
     * Bir tanenin üçte birinden azı "adet" sayılmıyor: 30 g domatese
     * "1 adet domates" demek yanlış olur, o satır gramda kalıyor.
     */
    const raw = grams / per;
    if (raw < 0.35 || raw > 12) return null;

    const n = Math.max(1, Math.round(raw));
    // "Yarım limonun suyu"na 1 limon demek ekşiliği ikiye katlıyor; böyle
    // durumlarda tane ölçüsünden vazgeçip gramda kalıyoruz.
    return fits(n * per)
      ? { text: `${n} adet`, measureId: 'adet', count: n, appliedGrams: n * per }
      : null;
  }

  if (form === 'dis') {
    const n = snap(grams / DIS_G);
    return n && n >= 1 && fits(n * DIS_G)
      ? { text: `${countText(n)} diş`, measureId: 'dis', count: n, appliedGrams: n * DIS_G }
      : null;
  }

  if (form === 'demet') {
    /**
     * Taze otta kesir yerine üç ayrı terim.
     *
     * "Çeyrek demet maydanoz" kimsenin kullanmadığı bir ölçü; onun yerine
     * miktara göre mutfakta gerçekten söylenen sözcüğe geçiyoruz: azı tutam,
     * ortası avuç, çoğu demet. Hepsi tam sayı.
     */
    if (grams >= 0.75 * DEMET_G) {
      const n = Math.max(1, Math.round(grams / DEMET_G));
      if (fits(n * DEMET_G)) {
        return { text: `${n} demet`, measureId: 'demet', count: n, appliedGrams: n * DEMET_G };
      }
    }
    if (grams >= 15) {
      const n = Math.max(1, Math.round(grams / AVUC_G));
      if (fits(n * AVUC_G)) {
        return { text: `${n} avuç`, measureId: 'avuc', count: n, appliedGrams: n * AVUC_G };
      }
    }
    const n = Math.min(3, Math.max(1, Math.round(grams / OT_TUTAM_G)));
    return fits(n * OT_TUTAM_G)
      ? { text: `${n} tutam`, measureId: 'tutam', count: n, appliedGrams: n * OT_TUTAM_G }
      : null;
  }

  const density = densityOf(slug, category);
  const allowed = ALLOWED[form].filter((id) =>
    SPOON_ONLY.has(slug) ? id !== 'su-bardagi' && id !== 'cay-bardagi' : true,
  );

  /**
   * Üç geçiş, giderek gevşeyen aralıkla.
   *
   * Önce sayısı 1 ile 4 arasında kalan **en büyük** ölçüyü arıyoruz: 220 g un
   * "2 su bardağı" olsun, "27 yemek kaşığı" olmasın. Tam sayı çıkmıyorsa
   * yarıma, o da olmuyorsa çeyreğe iniyoruz — "yarım çay bardağı" ve
   * "çeyrek su bardağı" mutfakta söylenen ifadeler.
   */
  const passes: [number, number][] = [
    // Üst sınır 6: "5 yemek kaşığı bulgur" mutfakta söylenen bir şey,
    // 4'te kesince o miktar ölçüsüz kalıyordu.
    [1, 6],
    [0.5, 1],
    [0.25, 0.5],
  ];

  /**
   * Parmak ölçüleri son çare. Kaşıkla önce deniyoruz, çünkü "2 pençik tuz"
   * yerine "yarım çay kaşığı tuz" hem daha anlaşılır hem daha tekrarlanabilir.
   * Pençik ve tutam yalnızca kaşığa sığmayacak kadar az miktar için.
   */
  const spoons = allowed.filter((id) => id !== 'pencik' && id !== 'tutam');
  const pinches = allowed.filter((id) => id === 'pencik' || id === 'tutam');

  const trySpoons = (min: number, max: number): HouseholdMeasure | null => {
    for (const id of spoons) {
      const m = MEASURES.find((x) => x.id === id);
      if (!m) continue;

      const perUnit = (m.ml ?? 0) * density;
      if (perUnit <= 0) continue;

      const n = snap(grams / perUnit);
      if (n === null || n < min || n > max) continue;
      if (!fits(n * perUnit)) continue;

      return {
        text: `${countText(n)} ${m.labelTr}`,
        measureId: id,
        count: n,
        appliedGrams: n * perUnit,
      };
    }
    return null;
  };

  // Tam ve yarım kaşık/bardak önce.
  for (const [min, max] of passes.slice(0, 2)) {
    const hit = trySpoons(min, max);
    if (hit) return hit;
  }

  /**
   * Çeyrek çay kaşığından önce parmak ölçüsü: yarım gram pul biberi kaşığın
   * çeyreğiyle ölçmeye çalışmak yerine "1 tutam" demek hem daha kolay hem
   * mutfakta zaten böyle söyleniyor. Sayı tam: "bir buçuk tutam" olmaz.
   */
  for (const id of pinches) {
    const m = MEASURES.find((x) => x.id === id);
    if (!m?.grams) continue;

    const n = Math.round(grams / m.grams);
    if (n < 1 || n > 3) continue;
    if (!fits(n * m.grams)) continue;

    return { text: `${n} ${m.labelTr}`, measureId: id, count: n, appliedGrams: n * m.grams };
  }

  return trySpoons(passes[2][0], passes[2][1]);
}

/** Gram gösterimi — ev ölçüsü çıkmayan malzemeler için. */
export function formatGrams(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1).replace('.', ',')} kg`;
  if (grams < 1) return `${grams.toFixed(1).replace('.', ',')} g`;
  return `${Math.round(grams)} g`;
}

/**
 * Tarif satırının tam gösterimi: önce ev ölçüsü, yanında gram.
 *
 * İkisi birden yazılıyor çünkü tartısı olan gramı istiyor, olmayan kaşığı.
 * Ev ölçüsü çıkmıyorsa yalnızca gram kalıyor.
 */
export function formatAmount(slug: string, category: string, grams: number): string {
  const m = toHouseholdMeasure(slug, category, grams);
  return m ? `${m.text} · ${formatGrams(grams)}` : formatGrams(grams);
}

// ── Tarif bağlamında tolerans ──────────────────────────────────────

/** Tolerans hesabı için gereken en az malzeme bilgisi. */
export interface MeasureLine {
  slug: string;
  grams: number;
  potency: number;
  taste: TasteVector;
}

/**
 * Nominal sapma sınırını **tahmin etmeden** hesaplar.
 *
 * Bir malzemenin gramını yuvarlamak tabağın tadını ne kadar kaydırır?
 * Motorun tat profili şu:
 *
 *     profil = Σ(gram × potency × tat) / Σ(gram × potency)
 *
 * Buradan, i malzemesinin gramını bağıl olarak δ kadar oynatmak bir ekseni
 * yaklaşık `pay_i × ses_i × δ` kadar kaydırıyor:
 *
 *     pay_i = (gram_i × potency_i) / Σ(gram × potency)   → tabaktaki ağırlığı
 *     ses_i = malzemenin en yüksek tat ekseni (0–10)     → ne kadar baskın
 *
 * İstenen sınır `axisBudget` ise, izin verilen sapma:
 *
 *     δ_i = axisBudget / (pay_i × ses_i)
 *
 * Yani **tuz ve limon dar, soğan ve patates geniş** tolerans alıyor; kural
 * malzeme listesinden değil aritmetikten geliyor.
 *
 * `axisBudget` varsayılanı 0,35: tat algısında fark edilme eşiği (Weber oranı)
 * kabaca %15–25 olduğu için, 0–10 ölçeğinde bunun yarısında duruyoruz. Bu
 * sınırın altındaki sapmayı ortalama bir damak ayırt etmiyor.
 */
export function measureTolerances(lines: MeasureLine[], axisBudget = 0.35): Map<string, number> {
  const out = new Map<string, number>();

  const total = lines.reduce((s, l) => s + l.grams * l.potency, 0);
  if (total <= 0) return out;

  for (const line of lines) {
    const share = (line.grams * line.potency) / total;
    const voice = Math.max(...Object.values(line.taste));

    const raw = share * voice > 0 ? axisBudget / (share * voice) : 1;
    // Alt sınır: %5'ten dar tolerans hiçbir ev ölçüsünü geçirmez, boşuna.
    // Üst sınır: %45'ten gevşek olunca "1 adet" iki katına çıkabiliyor.
    out.set(line.slug, Math.min(0.45, Math.max(0.05, raw)));
  }

  return out;
}
