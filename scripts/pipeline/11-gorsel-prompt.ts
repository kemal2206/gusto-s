/**
 * Adım 11 — her tarif için görsel üretim promptu.
 *
 *   npm run data:gorsel                     dağılım raporu
 *   npm run data:gorsel -- --incele manti   tek tarifin promptu
 *   npm run data:gorsel -- --ornek 12       12 rastgele örnek
 *   npm run data:gorsel -- --write          fotoğrafsız tarifler
 *                                           → data-build/gorsel-promptlari.jsonl
 *   npm run data:gorsel -- --write --hepsi  korpusun tamamı
 *                                           → data-build/gorsel-promptlari-hepsi.jsonl
 *   npm run data:gorsel -- --supheli        kategori/yöntem hatası taraması
 *
 * ── Sorun ──────────────────────────────────────────────────────────
 *
 * Tariflerin çoğunda fotoğraf yok ve arayüz `loremflickr`'a düşüyor; yani o
 * tariflerde gösterilen fotoğrafın yemekle hiçbir ilgisi yok.
 *
 * ── Neyin değiştiği, neyin değişmediği ─────────────────────────────
 *
 * "Çeşitlilik" ile "kaos" arasındaki fark, **neyin serbest bırakıldığı**.
 *
 *   DEĞİŞİR   tabağın rengi ve deseni · kap · zemin · aksesuar · ışığın yönü
 *   SABİT     AÇI (90°) · ışığın yumuşaklığı · objektif · renk · gerçekçilik ·
 *             süs kuralı · güvenli kırpma alanı
 *
 * Açı önce kategoriye göre değişiyordu (0°/15°/45°/90°) ve tek tek kareler
 * iyi çıkıyordu; ızgarada ise dağınık duruyordu. Tek açıya inildi ve
 * çeşitliliği taşıma işi **tabağın rengine ve desenine** geçti. Kütüphane
 * ölçeğinde tutarlılık, kare başına en iyi açıdan daha değerli.
 *
 * Sabit kalan kısım "fotoğraf dili". Binlerce kare aynı stüdyodan çıkmış gibi
 * durmasını o sağlıyor; değişen kısım ızgaranın stok fotoğraf kataloğu gibi
 * görünmesini engelliyor.
 *
 * ── Çeşitlilik neden rastgele DEĞİL ────────────────────────────────
 *
 * `Math.random()` iki şeyi bozardı: aynı tarifi yeniden üretince farklı
 * prompt çıkardı (yeniden üretilebilirlik yok) ve hangi karenin neden öyle
 * çıktığı izlenemezdi. Bunun yerine seçim **slug'ın hash'inden** geliyor:
 * dağınık görünüyor ama sabit.
 *
 * Her boyut ayrı tuz (salt) kullanıyor. Tek hash'le seçilse zemin ile kap
 * birbirine kilitlenir ve korpus boyunca aynı ikili tekrar ederdi.
 *
 * ── Süs kuralı otomatik ────────────────────────────────────────────
 *
 * Altı elle yazılan promptta "tarifte maydanoz yoksa fotoğrafta olmayacak"
 * kuralını tek tek yazmıştım. Burada `allSlugs`'tan türüyor: modelin sık
 * uydurduğu süslerin listesi var, tarifte karşılığı yoksa negatife giriyor.
 * 3.686 tarifte elle denetlenemeyecek tek şey buydu.
 */

import fs from 'node:fs';

import { BY_SLUG } from '@/data/catalog';
import { kelimeBasi, tamKelime } from '@/data/catalog/tr-kelime';
import { isSogukYemek } from '@/data/recipes/ad-kurallari';
import { RECIPES } from '@/data/recipes';
import type { Recipe } from '@/data/recipes/types';

// ── Hash ───────────────────────────────────────────────────────────
//
// FNV-1a. Kriptografik olması gerekmiyor, tek şart aynı girdiye aynı çıktı.

function hash(s: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SALT = { angle: 11, vessel: 23, surface: 37, prop: 53, light: 71, finish: 97 } as const;

function pick<T>(arr: readonly T[], slug: string, salt: number): T {
  return arr[hash(slug, salt) % arr.length]!;
}

// ── Açı ────────────────────────────────────────────────────────────
//
// Denenen iki sürüm ve neden bırakıldıkları:
//
//   1. Kategoriye göre üç açı (0/45/90). Tatlı yandan, kebap 45°, çorba
//      tepeden. Tek tek kareler iyiydi ama ızgarada dağınık duruyordu.
//   2. 0° yerine 15°. Boşluk sorununu çözdü, dağınıklığı çözmedi.
//
// Şimdiki hâl: **90° sabit, tek istisna içecek.** Aynı listede farklı
// açılar yan yana gelince göz bir düzen bulamıyor; kütüphane ölçeğinde
// tutarlılık, kare başına en iyi açıdan daha değerli çıktı.
//
// 15° ve 45° yalnızca içecekte yaşıyor: bardağı tepeden çekince sadece bir
// daire görünüyor, bardağın kendisi ve köpüğü kayboluyor.

type Angle = 15 | 45 | 90;

/**
 * Açı artık tek: 90° tepeden. Tek istisna içecek.
 *
 * Üç açılı havuz (15/45/90) denendi ve kütüphane ölçeğinde tutmadı: ızgarada
 * kareler dağınık duruyordu, aynı listede farklı açılar yan yana gelince göz
 * bir düzen bulamıyor. Tepeden çekim yemek fotoğrafında en güvenilir açı —
 * her yemekte çalışıyor ve iki farklı kırpmaya en dayanıklı olan o.
 *
 * İçecek istisna çünkü bardağı tepeden çekince sadece bir daire görünüyor;
 * bardağın kendisi, dolgunluğu ve köpüğü kayboluyor.
 *
 * **Çeşitlilik artık açıdan gelmiyor**, tabağın renginden ve deseninden
 * geliyor (`PLATE_FINISH`). Zemin havuzu da yerinde duruyor.
 */
const ICECEK_ANGLES = [15, 15, 45] as const;

function angleFor(r: Recipe): Angle {
  if (r.categoryId !== 'icecek') return 90;
  return pick(ICECEK_ANGLES, r.slug, SALT.angle);
}

/**
 * 90°'nin katı hâli.
 *
 * "Camera directly overhead" tek başına yetmiyordu: model kareleri sık sık
 * 70-80°'ye kaydırıyor, kamera hafifçe öne eğiliyor. Tek tek bakınca fark
 * edilmiyor ama ızgarada eğik kare hemen sırıtıyor — zaten tek açıya inmemizin
 * sebebi buydu, gevşek bir 90° o kazancı geri veriyor.
 *
 * Talimatın işe yarayan kısmı sıfat değil **ölçüt**: gerçek tepeden çekimde
 * yuvarlak tabak tam daire görünür. En ufak eğilmede elips olur, kâsenin iç
 * duvarı görünür, masanın uzak kenarı kadraja girer. Modele "dik çek" demek
 * yerine "tabak daire olacak" demek ölçülebilir bir hedef veriyor.
 */
const STRICT_TOPDOWN =
  "The camera's optical axis is exactly perpendicular to the table — a true bird's-eye flat-lay. " +
  'A round plate or bowl must render as a perfect circle, never an ellipse. ' +
  'No side wall of the vessel is visible, no interior wall of the bowl, ' +
  'no perspective convergence, no horizon line, no far edge of the table, no background wall. ' +
  'If anything in the frame suggests the camera is tilted even slightly forward, it is wrong.';

/** Yalnızca 90° karelere eklenen negatifler. */
const TOPDOWN_NEGATIVE = [
  'no three-quarter view',
  'no angled or tilted camera',
  'no elliptical or oval plate rim',
  'no visible horizon',
  'no background wall',
  'no perspective distortion',
  'no side view of the vessel',
];

const ANGLE_TEXT: Record<Angle, string> = {
  90: `Camera directly overhead at a 90-degree angle, perfect flat-lay. ${STRICT_TOPDOWN}`,
  45: 'Camera at a 45-degree three-quarter angle, showing both the surface and the height of the food.',
  15: 'Camera at a low 15-degree angle just above table level, showing the layered profile of the food while the top surface stays visible.',
};

// ── Kap ────────────────────────────────────────────────────────────
//
// Kap yemeğe ait olmalı: menemen tabağa alınmaz, tavasında gelir; güveç
// toprak kapta pişer ve o kapta servis edilir. Yöntem kabı kategoriden
// daha iyi biliyor, o yüzden önce yönteme bakılıyor.

const VESSEL_BY_METHOD: Record<string, readonly string[]> = {
  tava: [
    'a small black cast-iron skillet, the food served directly in the pan it was cooked in',
    'a shallow copper pan with a worn patina, served straight from the pan',
  ],
  izgara: [
    'a long oval stoneware serving platter',
    'a dark slate serving board',
    'a wide flat ceramic plate',
  ],
  komur: ['a long oval stoneware serving platter', 'a round hammered copper tray lined with lavash flatbread'],
  kizartma: [
    'a round porcelain plate',
    'a shallow woven basket lined with parchment paper',
  ],
  firin: [
    'a rustic ceramic oven dish',
    'an enamelled cast-iron baking dish in deep blue',
    'a shallow enamelled baking dish in cream with a blue rim',
  ],
  sulu: [
    'a deep glazed earthenware bowl',
    'a traditional Turkish copper pot with two handles',
    'a wide shallow stoneware bowl',
  ],
  haslama: ['a wide shallow stoneware bowl', 'a deep glazed earthenware bowl'],
  buhar: ['a bamboo steamer basket', 'a wide shallow stoneware bowl'],
  wok: ['a black carbon-steel wok, food served in the wok'],
  cig: ['a wide flat ceramic plate', 'a shallow glass bowl'],
  karistir: ['a wide shallow stoneware bowl', 'a round porcelain plate'],
  dinlendir: ['a round porcelain plate', 'a glass serving dish'],
};

const VESSEL_BY_CATEGORY: Record<string, readonly string[]> = {
  corba: [
    'a deep glazed ceramic soup bowl',
    'a traditional Turkish copper soup bowl',
    'a porcelain soup plate',
  ],
  icecek: [
    'a tall clear drinking glass',
    'a traditional tulip-shaped Turkish tea glass on a small saucer',
    'a heavy cut-glass tumbler',
    'a copper cup beaded with condensation',
  ],
  tatli: [
    'a small dessert plate',
    'a traditional glazed earthenware dessert bowl',
    'a clear glass dessert bowl',
    'a porcelain plate',
  ],
  'meze-salata': [
    'a small shallow meze plate in glazed ceramic',
    'a wide flat ceramic plate',
    'a shallow glass bowl',
  ],
  'hamur-isi': [
    'a round hammered copper tray',
    'a wooden cutting board',
    'a wire cooling rack',
    'a plain white platter',
  ],
  deniz: [
    'a long oval stoneware platter',
    'a plain white platter lined with a bed of rocket',
    'a dark slate serving board',
  ],
  kahvalti: [
    'a small black cast-iron skillet, served in the pan',
    'a round wooden breakfast board',
    'a plain white plate',
  ],
  'pilav-makarna': [
    'a wide shallow stoneware bowl',
    'a round white porcelain bowl',
    'a copper serving dish',
  ],
};

/**
 * Kabın edatı.
 *
 * "Served in a wooden cutting board" bozuk bir cümle ve model bozuk cümleden
 * bozuk kompozisyon üretiyor. Düz zeminler "on", hacimli kaplar "in" alıyor.
 * Havuza yeni kap eklerken edatı ayrıca yazmak gerekmesin diye anahtar
 * kelimeden türetiliyor.
 */
const FLAT_VESSEL = /\b(board|tray|platter|plate|rack|sini)\b/;

function vesselPhrase(vessel: string): string {
  return `${FLAT_VESSEL.test(vessel) ? 'on' : 'in'} ${vessel}`;
}

/**
 * Kabı yemeğin kimliğinin parçası olan tarifler.
 *
 * Künefe cam tatlı kâsesinde gelmez, kendi bakır tavasında gelir; Türk
 * kahvesi fincandadır. Bu tariflerde kap havuzdan seçilirse ad ile kap
 * birbiriyle çelişiyor ve model ikisinin arasında kalıyor.
 *
 * `DISH_LOOK` gibi genişletilecek bir sözlük — kabı ikonik olmayan tarifler
 * havuzdan seçmeye devam ediyor.
 */
const DISH_VESSEL: Record<string, string> = {
  kunefe: 'a round shallow hammered copper künefe pan, served in the pan it was baked in',
  sutlac: 'a small glazed earthenware bowl with its top browned under the grill',
  'turk-kahvesi': 'a small porcelain Turkish coffee cup on a saucer',
  'demli-cay': 'a tulip-shaped Turkish tea glass on a small saucer with two sugar cubes',
  salep: 'a tall glass mug, thick and steaming',
  manti: 'a wide shallow ceramic bowl',
  'karides-guvec': 'a small two-handled earthenware güveç dish, served bubbling in the dish',
  'hamsi-tava': 'a round black cast-iron pan, the fish arranged in a tight spiral',
  'midye-dolma': 'a flat hammered copper tray, the stuffed mussels arranged in neat rows',
  'sac-kavurma': 'a traditional convex iron sac griddle',
  cilbir: 'a wide shallow ceramic bowl',
};

/**
 * Geleneksel sunum — ada bakan kural katmanı.
 *
 * `DISH_VESSEL` tek tek slug yazıyor ve 2.964 tarifte ölçeklenmiyor. Oysa
 * Türkçede yemeğin adı kabını da neredeyse her zaman söylüyor: "…güveç"
 * toprak kapta, "…kebabı" lavaş serili bakır tepside, "lahmacun" ahşap
 * tahtada, "sütlaç" güveç kâsesinde gelir.
 *
 * `refineCategory` ile aynı mimari: sıralı kural listesi, ilk eşleşen
 * kazanıyor, kalıplar `kelimeBasi`/`tamKelime` ile kuruluyor. **Düz regex
 * yazma** — `/kek/` "Keşkek" ile eşleşiyor, bu hata bir kere yapıldı.
 *
 * Sıra özelden genele: "Karides Güveç" güveç kuralına düşmeli, deniz
 * kuralına değil.
 */
interface VesselRule {
  re: RegExp;
  vessel: string;
  /**
   * Ad tek başına yetmediğinde ikinci koşul.
   *
   * "Tas Kebabı" sulu yemek, "Söğürme Kebabı" fırın yemeği — adında kebap
   * geçen her tarif ızgara değil ve lavaş serili bakır tepsiye konmamalı.
   * Koşul tutmazsa kural düşüyor, yemek sıradaki kurala ya da havuza gidiyor.
   */
  when?: (r: Recipe) => boolean;
}

/** Gerçekten ateş üstünde pişen kebaplar. */
const IZGARA_YONTEM = new Set(['izgara', 'komur', 'tava']);

const TRADITIONAL_VESSEL: VesselRule[] = [
  // ── Tatlılar ────────────────────────────────────────────────
  { re: kelimeBasi('künefe'), vessel: 'a round shallow hammered copper künefe pan, served in the pan it was baked in' },
  { re: kelimeBasi('kadayıf'), vessel: 'a round hammered copper tray, the syrup pooling at the base' },
  { re: kelimeBasi('baklava', 'şöbiyet', 'bülbül yuvası', 'sarı burma', 'sütlü nuriye'), vessel: 'a small white plate holding diamond-cut pieces, a copper tray behind it' },
  { re: kelimeBasi('sütlaç'), vessel: 'a small glazed earthenware bowl with its top browned under the grill' },
  { re: kelimeBasi('muhallebi', 'keşkül', 'kazandibi', 'tavuk göğsü', 'supangle'), vessel: 'a small clear glass dessert bowl' },
  { re: kelimeBasi('aşure'), vessel: 'a wide clear glass bowl, the toppings arranged in rings' },
  { re: kelimeBasi('helva'), vessel: 'a small dessert plate, the halva pressed into a neat mound' },
  { re: kelimeBasi('dondurma'), vessel: 'a chilled shallow metal coupe' },
  { re: kelimeBasi('lokma', 'tulumba'), vessel: 'a shallow ceramic bowl piled with the syrupy pieces' },
  { re: kelimeBasi('reçel', 'marmelat'), vessel: 'a small clear glass jar with a spoon resting beside it' },

  // ── İçecekler ───────────────────────────────────────────────
  { re: kelimeBasi('ayran'), vessel: 'a tall glass with a thick foam head, beaded with condensation' },
  { re: kelimeBasi('kahve'), vessel: 'a small porcelain Turkish coffee cup on a saucer' },
  { re: tamKelime('çay', 'çayı'), vessel: 'a tulip-shaped Turkish tea glass on a small saucer' },
  { re: kelimeBasi('salep', 'sahlep', 'boza'), vessel: 'a tall glass mug, thick and steaming' },
  { re: kelimeBasi('şerbet', 'limonata', 'hoşaf', 'komposto', 'şıra'), vessel: 'a tall clear glass with ice, beaded with condensation' },

  // ── Kap yemeğin adında ──────────────────────────────────────
  { re: kelimeBasi('güveç'), vessel: 'a small two-handled earthenware güveç dish, served bubbling in the dish' },
  { re: kelimeBasi('testi'), vessel: 'a sealed clay testi pot, broken open at the neck' },
  { re: tamKelime('sac', 'sacda'), vessel: 'a traditional convex iron sac griddle' },
  { re: kelimeBasi('tava', 'tavası'), vessel: 'a shallow copper pan with a worn patina, served straight from the pan' },

  // ── Izgara ve kebap ─────────────────────────────────────────
  //
  // Adında kebap geçen her tarif ızgara değil: "Tas Kebabı" sulu yemek,
  // "Söğürme Kebabı" ve "Mercan Kebabı" fırın yemeği. Üçü de lavaş serili
  // bakır tepsiye konuyordu. Yöntem ikinci koşul olarak eleme yapıyor.
  {
    re: kelimeBasi('kebap', 'kebabı', 'adana', 'urfa', 'beyti', 'iskender', 'döner'),
    vessel: 'a round hammered copper tray lined with lavash flatbread',
    when: (r) => IZGARA_YONTEM.has(r.components[0]?.method ?? ''),
  },
  { re: kelimeBasi('şiş', 'şişte'), vessel: 'a long oval stoneware platter, the skewers laid side by side' },
  { re: kelimeBasi('köfte'), vessel: 'a wide flat ceramic plate' },
  { re: kelimeBasi('kavurma'), vessel: 'a round copper sahan with two small handles' },

  // ── Hamur işi ───────────────────────────────────────────────
  { re: kelimeBasi('lahmacun', 'pide', 'gözleme', 'bazlama'), vessel: 'a long wooden serving board' },
  { re: kelimeBasi('börek', 'böreği'), vessel: 'a round hammered copper tray, cut into portions' },
  // `çörek` "Çörek Otlu Peynirli Omlet"i de yakalıyordu — çörek otu baharat.
  {
    re: kelimeBasi('poğaça', 'açma', 'simit', 'çörek'),
    vessel: 'a wire cooling rack over a wooden surface',
    when: (r) => !/çörek ot/i.test(r.title),
  },
  // Kurabiye pasta ayağına konmaz; tabakta durur.
  {
    re: tamKelime('kurabiye', 'kurabiyesi'),
    vessel: 'a round ceramic plate piled with the cookies, a few resting beside it',
  },
  {
    re: tamKelime('kek', 'keki', 'pasta', 'pastası'),
    vessel: 'a round ceramic cake stand, one slice cut and lifted slightly',
  },

  // ── Ana yemek ───────────────────────────────────────────────
  { re: kelimeBasi('mantı'), vessel: 'a wide shallow ceramic bowl' },
  { re: kelimeBasi('pilav', 'pilavı'), vessel: 'a round copper sahan, the rice mounded in the middle' },
  { re: kelimeBasi('makarna', 'erişte', 'spagetti'), vessel: 'a deep wide ceramic pasta plate' },
  { re: kelimeBasi('dolma', 'dolması', 'sarma', 'sarması'), vessel: 'a wide flat plate, the rolls arranged in neat rows' },
  { re: kelimeBasi('çorba', 'çorbası'), vessel: 'a deep glazed ceramic soup bowl' },
  { re: kelimeBasi('midye'), vessel: 'a flat hammered copper tray, arranged in neat rows with lemon wedges' },
  { re: kelimeBasi('balık', 'hamsi', 'levrek', 'çipura', 'somon', 'uskumru', 'palamut'), vessel: 'a long oval stoneware platter with lemon wedges and rocket' },
  { re: kelimeBasi('menemen', 'omlet', 'yumurta'), vessel: 'a small black cast-iron skillet, served in the pan' },
  { re: kelimeBasi('mücver', 'kızartma'), vessel: 'a round porcelain plate with a small bowl of yogurt' },

  // ── Soğuk ───────────────────────────────────────────────────
  { re: kelimeBasi('cacık', 'haydari', 'ezme', 'piyaz', 'turşu', 'salata', 'meze', 'humus', 'kısır'), vessel: 'a small shallow meze plate in glazed ceramic' },
];

function traditionalVessel(r: Recipe): string | null {
  for (const rule of TRADITIONAL_VESSEL) {
    if (!rule.re.test(r.title)) continue;
    if (rule.when && !rule.when(r)) continue;
    return rule.vessel;
  }
  return null;
}

function vesselFor(r: Recipe): string {
  const iconic = DISH_VESSEL[r.slug];
  if (iconic) return iconic;

  const traditional = traditionalVessel(r);
  if (traditional) return traditional;

  const method = r.components[0]?.method ?? 'tava';

  /**
   * Soğuk servis edilen yemekte yöntem kabı seçmemeli.
   *
   * "Közlenmiş Patlıcan Salatası"nın yöntemi `komur` ve bu DOĞRU — patlıcan
   * gerçekten közleniyor. Ama yöntem bir *bileşenin* pişmesini anlatıyor,
   * servis soğuk. Yöntemden kap seçilirse salata mangal tepsisinde,
   * "Kızarmış Patates Salatası" döküm tavada servis ediliyor.
   *
   * Bu, veri hatası değil; veriyi yanlış yerde kullanmaktı.
   */
  if (isSogukYemek(r.title)) {
    return pick(VESSEL_BY_CATEGORY['meze-salata']!, r.slug, SALT.vessel);
  }

  // Kategori kabı yönteme baskın çıktığı yerler var: çorba her zaman kâsede,
  // yöntemi "sulu" olsa da tencerede servis edilmez.
  const categoryFirst = ['corba', 'icecek', 'tatli', 'meze-salata'];
  const pools = categoryFirst.includes(r.categoryId)
    ? [VESSEL_BY_CATEGORY[r.categoryId], VESSEL_BY_METHOD[method]]
    : [VESSEL_BY_METHOD[method], VESSEL_BY_CATEGORY[r.categoryId]];

  const pool = pools.find((p) => p && p.length) ?? ['a wide shallow stoneware bowl'];
  return pick(pool, r.slug, SALT.vessel);
}

// ── Tabağın rengi ve deseni ────────────────────────────────────────
//
// Açı 90°'ye sabitlenince çeşitliliği taşıyan yük buraya geçti. Tepeden
// çekimde kare zaten tabağın kendisi; rengi ve deseni değişmezse 2.900 kare
// aynı beyaz daireye dönüyor.
//
// İki kap sınıfına UYGULANMIYOR:
//
//   şeffaf        cam bardak, cam kâse, kavanoz — rengi olan içindeki yemek
//   sabit malzeme bakır, döküm, arduvaz, ahşap, emaye, hasır, toprak güveç
//
// Bu ikisine renk verilirse promptun kendisi kendisiyle çelişiyor: "dövme
// bakır tepsi, çini desenli" gibi bir cümle modele ne yapacağını
// söylemiyor.

const PLATE_FINISH = [
  'plain matte white',
  'off-white with a fine dark speckle',
  'deep cobalt blue glaze',
  'sage green glaze with a slightly uneven rim',
  'terracotta glaze with an unglazed rim',
  'a hand-painted Turkish çini pattern in cobalt blue and white',
  'a Kütahya-style floral border in red, blue and green on white',
  'dusty pink glaze',
  'charcoal grey matte stoneware',
  'warm mustard yellow glaze',
  'white with a single thin cobalt line around the rim',
  'crackled ivory glaze',
  'burnt orange glaze with darker speckles',
  'olive green with a hand-painted white leaf motif',
  'soft turquoise glaze pooling slightly at the centre',
  'cream with a hand-painted blue geometric border',
  'deep aubergine glaze',
  'sand-coloured matte glaze',
] as const;

/** İçindeki yemek rengi belirliyor — dışarıdan renk verilmez. */
const TRANSPARENT = /\b(glass|clear|tumbler|jar)\b/i;

/** Malzemesi rengini zaten söylüyor. */
const FIXED_MATERIAL =
  /\b(copper|cast-iron|iron|slate|wood|wooden|board|rack|straw|bamboo|basket|enamel|enamelled|sac|testi|clay|earthenware|metal|wok)\b/i;

function plateFinish(r: Recipe, vessel: string, angle: Angle): string {
  if (angle !== 90) return '';
  if (TRANSPARENT.test(vessel) || FIXED_MATERIAL.test(vessel)) return '';
  return `The vessel is finished in ${pick(PLATE_FINISH, r.slug, SALT.finish)}.`;
}

// ── Zemin ──────────────────────────────────────────────────────────
//
// Havuz global — kategoriye bağlamıyoruz, çünkü asıl istenen ızgarada
// zeminlerin karışması. Tek istisna kahvaltı ve tatlı: mermer tatlıya,
// ahşap kahvaltıya daha çok yakışıyor, o yüzden havuzları eğiliyor.

const SURFACES = [
  // Ahşap
  'a warm light oak tabletop',
  'a dark walnut wooden table',
  'a scrubbed pine kitchen table with visible grain',
  'a worn butcher-block counter',
  'a weathered painted wooden table in muted green',
  'a weathered painted wooden table in dusty blue',
  // Taş
  'a white marble slab with soft grey veining',
  'a dark green marble slab',
  'a sand-coloured travertine slab',
  'a matte grey stone surface',
  'a dark slate surface',
  'a pale concrete surface',
  'a whitewashed rough plaster surface',
  // Karo — Türk mutfağının kendi yüzeyleri
  'a terracotta tiled surface',
  'a hand-glazed ceramic tile surface in soft blue and white',
  'a cream ceramic tile surface with thin grout lines',
  // Kumaş ve dokuma
  'a linen tablecloth in natural beige',
  'a soft grey linen cloth with visible weave',
  'a woven straw mat',
  'a muted kilim runner in faded red and cream',
  // Metal — alüminyum değil, bakır
  'an aged copper sheet with a warm patina',
] as const;

const SURFACE_BIAS: Record<string, readonly string[]> = {
  tatli: [
    'a white marble slab with soft grey veining',
    'a dark green marble slab',
    'a linen tablecloth in natural beige',
    'a vintage lace-edged cloth in off-white',
    'a dark walnut wooden table',
    'a pale concrete surface',
    'a hand-glazed ceramic tile surface in soft blue and white',
    'an aged copper sheet with a warm patina',
    'a sand-coloured travertine slab',
  ],
  kahvalti: [
    'a warm light oak tabletop',
    'a linen tablecloth in natural beige',
    'a weathered painted wooden table in dusty blue',
    'a terracotta tiled surface',
    'a scrubbed pine kitchen table with visible grain',
    'a cream ceramic tile surface with thin grout lines',
    'a woven straw mat',
  ],
  icecek: [
    'a white marble slab with soft grey veining',
    'a warm light oak tabletop',
    'a matte grey stone surface',
    'an aged copper sheet with a warm patina',
    'a hand-glazed ceramic tile surface in soft blue and white',
    'a soft grey linen cloth with visible weave',
  ],
};

function surfaceFor(r: Recipe): string {
  const pool = SURFACE_BIAS[r.categoryId] ?? SURFACES;
  return pick(pool, r.slug, SALT.surface);
}

// ── Aksesuar ───────────────────────────────────────────────────────
//
// Çoğu karede aksesuar YOK. İlk denemede menemen'in yanına ekmek, çorbanın
// yanına peçete koymuştum ve varyansın girdiği yer tam orası oldu — biri
// kesme tahtası ekledi, biri masa kenarı gösterdi.
//
// O yüzden havuzun yarısı boş: yaklaşık her iki kareden birinde hiç
// aksesuar olmuyor, olanlarda da tek parça.

// Havuz kategoriye bağlı. Global tek havuz baklavanın yanına ekmek dilimi,
// ayranın yanına tuzluk koyuyordu — aksesuar yemeğe ait değilse kare yalan
// söylüyor, üstelik gözle denetimde en çabuk göze batan hata bu.

const PROPS_TUZLU = [
  '',
  '',
  '',
  '',
  'A folded linen napkin rests beside it.',
  'A single worn spoon lies next to it.',
  'A small pinch bowl of salt sits nearby.',
  'Two slices of crusty bread lie on the side.',
  'A glass of water stands behind it, slightly out of focus.',
] as const;

const PROPS_TATLI = [
  '',
  '',
  '',
  '',
  'A folded linen napkin rests beside it.',
  'A small dessert fork lies next to it.',
  'A tulip-shaped glass of Turkish tea stands behind it, slightly out of focus.',
  'A light dusting of icing sugar has fallen on the surface around it.',
] as const;

// İçecekte aksesuar neredeyse hiç yok: bardağın yanına konan her şey
// kompozisyonu dağıtıyor ve dikey kırpımda ilk kesilen o oluyor.
const PROPS_ICECEK = [
  '',
  '',
  '',
  '',
  '',
  'A folded linen napkin rests beside it.',
  'A few drops of condensation have run onto the surface.',
] as const;

function propFor(r: Recipe): string {
  const pool =
    r.categoryId === 'icecek'
      ? PROPS_ICECEK
      : r.categoryId === 'tatli'
        ? PROPS_TATLI
        : PROPS_TUZLU;
  return pick(pool, r.slug, SALT.prop);
}

// ── Işık ───────────────────────────────────────────────────────────
//
// Yön değişiyor, YUMUŞAKLIK değişmiyor. Menemen karesindeki sertlik tam
// olarak buradan gelmişti — yön serbest bırakılabilir, sertlik bırakılamaz.

const LIGHTS = [
  'Soft diffused natural daylight from the left',
  'Soft diffused natural daylight from the right',
  'Soft diffused natural daylight from behind, gently backlighting the food',
  'Soft overcast window light from the upper left',
] as const;

function lightFor(r: Recipe): string {
  return pick(LIGHTS, r.slug, SALT.light);
}

// ── Süs denetimi ───────────────────────────────────────────────────
//
// Modelin refleksle eklediği süsler. Tarifte karşılığı yoksa negatife
// giriyor. Menemen denemesinde tam bu gerekmişti: tarifte peynir yok ama
// karede beyaz bir akıntı çıktı ve peynir mi yumurta akı mı ayırt
// edilemedi. Belirsiz kare, gözle denetimi pahalılaştırıyor.

// `scope` listeyi kısa tutuyor. Tatlıya "no parsley, no olives, no rocket"
// göndermenin bilgi değeri yok ve uzun negatif liste modelde ÖNEMLİ maddeyi
// zayıflatıyor — menemen'deki "no cheese" 30 maddenin arasında kaybolursa
// denemede gördüğümüz belirsiz beyaz akıntı geri gelir.

type Scope = 'tuzlu' | 'tatli' | 'hepsi';

const GARNISH_GUARD: ReadonlyArray<{
  slugs: readonly string[];
  negative: string;
  scope: Scope;
}> = [
  { slugs: ['maydanoz'], negative: 'no parsley', scope: 'tuzlu' },
  { slugs: ['dereotu'], negative: 'no dill', scope: 'tuzlu' },
  { slugs: ['nane', 'kuru-nane', 'taze-nane'], negative: 'no mint', scope: 'hepsi' },
  { slugs: ['kisnis'], negative: 'no coriander or cilantro', scope: 'tuzlu' },
  { slugs: ['feslegen'], negative: 'no basil', scope: 'tuzlu' },
  { slugs: ['roka'], negative: 'no rocket or arugula', scope: 'tuzlu' },
  { slugs: ['limon'], negative: 'no lemon', scope: 'hepsi' },
  {
    slugs: ['yogurt', 'suzme-yogurt'],
    negative: 'no yogurt, no white sauce, no cream drizzle',
    scope: 'tuzlu',
  },
  {
    slugs: ['kasar', 'beyaz-peynir', 'lor', 'tulum-peyniri', 'labne', 'parmesan'],
    negative: 'no cheese of any kind',
    scope: 'tuzlu',
  },
  { slugs: ['pul-biber', 'toz-kirmizi-biber'], negative: 'no red pepper flakes', scope: 'tuzlu' },
  { slugs: ['susam'], negative: 'no sesame seeds', scope: 'hepsi' },
  { slugs: ['nar', 'nar-eksisi'], negative: 'no pomegranate seeds', scope: 'hepsi' },
  { slugs: ['taze-sogan'], negative: 'no spring onion', scope: 'tuzlu' },
  { slugs: ['zeytinyagi'], negative: 'no olive oil drizzle', scope: 'tuzlu' },
  { slugs: ['zeytin'], negative: 'no olives', scope: 'tuzlu' },
  // Tatlıda modelin en çok uydurduğu üçlü.
  { slugs: ['antep-fistigi'], negative: 'no pistachio', scope: 'hepsi' },
  { slugs: ['ceviz'], negative: 'no walnuts', scope: 'hepsi' },
  { slugs: ['tarcin'], negative: 'no cinnamon', scope: 'tatli' },
  { slugs: ['hindistan-cevizi'], negative: 'no shredded coconut', scope: 'tatli' },
  { slugs: ['kakao', 'bitter-cikolata'], negative: 'no chocolate or cocoa dusting', scope: 'tatli' },
  { slugs: ['krema'], negative: 'no whipped cream', scope: 'tatli' },
  { slugs: ['cilek', 'ahududu'], negative: 'no berries', scope: 'tatli' },
  { slugs: ['pudra-sekeri'], negative: 'no icing sugar dusting', scope: 'tatli' },
  { slugs: ['sumak'], negative: 'no sumac', scope: 'tuzlu' },
];

function garnishNegatives(r: Recipe): string[] {
  const has = new Set(r.allSlugs);
  const sweet = r.categoryId === 'tatli' || r.categoryId === 'icecek';
  const want: Scope = sweet ? 'tatli' : 'tuzlu';

  return GARNISH_GUARD.filter(
    (g) => (g.scope === 'hepsi' || g.scope === want) && !g.slugs.some((s) => has.has(s)),
  ).map((g) => g.negative);
}

// ── Sabit dil ──────────────────────────────────────────────────────

const GRAMMAR_BASE =
  'Photorealistic food photograph, shot on a 50mm lens at f/5.6, sharp focus on the food. ' +
  'Gentle soft-edged shadows, no harsh highlights, no dark moody lighting. ' +
  'Colors natural, warm and appetizing but not oversaturated. ';

/**
 * Porsiyon cümlesi içecekte anlamsız.
 *
 * "Bir ailenin gerçekten servis edeceği kadar cömert porsiyon" bir bardak
 * ayran için saçma; model bunu bardağı devasa göstererek ya da yanına ikinci
 * bardak koyarak yorumluyor.
 */
const GRAMMAR_PORTION_YEMEK =
  'A generous home-cooked portion — the amount a family would actually serve, not a restaurant tasting portion. ';
const GRAMMAR_PORTION_ICECEK = 'A single serving, the glass filled nearly to the top. ';

const GRAMMAR_CROP =
  'Composition: the food and its vessel fit entirely within the central 67% of the width ' +
  'and the central 82% of the height of the frame, so the image survives both a wide and a tall crop. ' +
  '1:1 square aspect ratio, 1536x1536.';

function grammarFor(r: Recipe): string {
  const portion = r.categoryId === 'icecek' ? GRAMMAR_PORTION_ICECEK : GRAMMAR_PORTION_YEMEK;
  return GRAMMAR_BASE + portion + GRAMMAR_CROP;
}

const FIXED_NEGATIVE = [
  'no edible flowers',
  'no microgreens',
  'no tweezed or artistically placed garnish',
  'no sauce dots or smears',
  'no fine-dining or gourmet plating',
  'no text',
  'no watermark',
  'no logo',
  'no hands',
  'no people',
  'no branded packaging',
  'no raw ingredients scattered for decoration',
  'no wide-angle distortion',
  'no tilted or dutch camera angle',
];

/**
 * `no foam` içeceğe gitmemeli.
 *
 * Fine dining köpüğünü engellemek için konmuştu ama ayranın köpüğü yemeğin
 * kendisi, Türk kahvesinde ise köpük doğru demlemenin işareti. Modele
 * "köpük olmasın" demek o iki tarifte yanlış fotoğraf ürettiriyor.
 */
const NEGATIVE_YEMEK_ONLY = ['no foam'];

// ── Prompt ─────────────────────────────────────────────────────────

export interface GorselPrompt {
  slug: string;
  title: string;
  categoryId: string;
  angle: Angle;
  vessel: string;
  surface: string;
  prop: string;
  finish: string;
  hasPhoto: boolean;
  prompt: string;
  negative: string;
}

/**
 * Yemeğin görünüşü.
 *
 * Buradaki cümle promptun en önemli parçası ve otomatik üretilemiyor:
 * model "mantı" kelimesini bilmiyor, "2 cm'lik köşelerinden büzülmüş hamur
 * paketçikleri" tarifini biliyor. Şu an tarif özetinden ve ana
 * malzemelerden bir taban cümle kuruluyor; **elle yazılmış tanım varsa o
 * kazanıyor.**
 *
 * Yani bu alan zamanla doldurulacak bir sözlük. Boş bırakıldığında çıkan
 * prompt yine çalışıyor ama tanınırlık düşüyor — en çok görüntülenen
 * tariflerden başlayarak elle yazmak, kalite/emek dengesinin en iyi olduğu
 * yer.
 */
export const DISH_LOOK: Record<string, string> = {
  manti:
    'about forty very small boiled dumplings, each roughly 2 cm across — tiny square parcels of ' +
    'thin pale hand-rolled dough pinched closed at the four corners, filled with seasoned ground beef, ' +
    'piled loosely and unevenly, generously covered with thick white garlic yogurt pooling between them, ' +
    'drizzled all over with melted butter reddened with Turkish red pepper, scattered with dried mint and sumac',
  'mercimek-corbasi':
    'smooth, thick, velvety red lentil soup, deep golden-orange, pureed completely smooth with no visible chunks, ' +
    'dusted with dried mint and red pepper flakes, a lemon wedge resting on the rim',
  karniyarik:
    'four whole roasted eggplants slit open lengthwise and pushed apart into boats, each filled with ' +
    'savory ground lamb cooked with onion, garlic and tomato in a rich reddish-brown sauce, topped with ' +
    'a thin round tomato slice and a long thin green Turkish pepper, cooking liquid pooling underneath',
  mucver:
    'eight to ten golden-brown pan-fried zucchini fritters, each about 7 cm across and irregular in shape, ' +
    'crisp browned edges with visible strands of grated zucchini, carrot, spring onion and dill running through them',
  menemen:
    'soft scrambled eggs barely set and still glossy, folded through cooked chopped tomatoes and soft green ' +
    'peppers, streaked yellow and red rather than uniformly mixed, with visible soft curds of egg',
  'eristeli-pilav':
    'a mound of Turkish rice pilaf, individual long white grains clearly separate and glistening with butter, ' +
    'mixed throughout with small toasted golden-brown orzo giving flecks of amber',
};

/**
 * Görünmeyen malzemeler.
 *
 * Su, tuz, karabiber tabakta görünmüyor ama gramajı yüksek olabiliyor —
 * "made with water, salt" diye başlayan bir prompt modele hiçbir şey
 * söylemiyor. Baskınlık sıralaması bunları atladıktan sonra yapılıyor.
 */
const INVISIBLE = new Set([
  'su',
  'tuz',
  'karabiber',
  'kabartma-tozu',
  'vanilya',
  'sivi-yag',
  'aycicek-yagi',
  'nisasta',
  'maya',
  'karbonat',
]);

const METHOD_LOOK: Record<string, string> = {
  izgara: 'chargrilled with visible grill marks and charred edges',
  komur: 'cooked over charcoal, smoky and lightly blackened in places',
  tava: 'pan-cooked, glossy and lightly browned',
  firin: 'oven-baked with a browned, slightly crisp top',
  haslama: 'boiled until tender',
  sulu: 'slowly simmered in its own reddish sauce',
  kizartma: 'deep-fried to a deep golden brown and crisp',
  buhar: 'steamed, soft and pale',
  wok: 'stir-fried over high heat, glossy',
  cig: 'fresh and uncooked',
  karistir: 'mixed together, rustic and uneven',
  dinlendir: 'chilled and set, smooth on top',
};

/**
 * Elle tanım yazılmamış tarifin görünüşü.
 *
 * İngilizce malzeme adı kataloğun tamamında dolu (251/251), o yüzden tanım
 * Türkçe slug yerine gerçek İngilizce adlarla kuruluyor — "made with dana
 * kiyma, patlican" modele hiçbir şey söylemiyordu.
 *
 * Malzemeler gramaja göre sıralanıyor: tabağa hâkim olan şey en çok konan
 * şeydir ve modelin karede öne çıkarması gereken de odur.
 */
/**
 * Yemeğin ADI prompta girmeli.
 *
 * İlk sürüm "adına güvenme, görünüşünü tarif et" diyordu ve bu yarı doğruydu:
 * mantı denemesinde fiziksel tanım işe yaradı, ama ben tanımı adın YERİNE
 * koydum. Sonucu ölçüldü —
 *
 *   "Ev Ayranı" adı hiç geçmedi, prompt "yoğurt ve nane karıştırılmış"
 *   dedi  →  model bardakta yoğurt üretti
 *   "Adana Kebabı" adı hiç geçmedi, prompt "kıyma, ızgara" dedi
 *          →  model tepside köfte üretti
 *
 * Doğrusu **ikisi birden**: ad gestalt'ı çağırıyor (model adana kebabını
 * biliyor), tanım ise tarifin gerçek malzemesine sadık kalmayı zorluyor.
 * Ad olmadan tanım genel bir yemek üretiyor; tanım olmadan ad tarifle
 * ilgisiz bir restoran tabağı üretiyor.
 */
const TR_ASCII: Record<string, string> = {
  ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G',
  ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
};

/** "Künefe" → "Kunefe". Model Türkçe harfli adı da tanıyor ama ASCII biçim
 *  eğitim verisinde çok daha sık geçiyor; ikisini birden veriyoruz. */
function asciiFold(s: string): string {
  return s.replace(/[ıİşŞğĞçÇöÖüÜ]/g, (c) => TR_ASCII[c] ?? c);
}

/** Ad bilinmiyorsa tanıma bağlam veren İngilizce kategori adı. */
const CATEGORY_EN: Record<string, string> = {
  corba: 'soup',
  'kebap-izgara': 'grilled kebab',
  'etli-sulu': 'meat and vegetable stew',
  zeytinyagli: 'olive-oil vegetable dish served at room temperature',
  'dolma-sarma': 'stuffed vegetable or vine-leaf roll',
  'pilav-makarna': 'rice or pasta dish',
  'hamur-isi': 'savory pastry',
  deniz: 'seafood dish',
  kahvalti: 'breakfast dish',
  'meze-salata': 'cold meze or salad',
  'sos-marine': 'sauce',
  tatli: 'dessert',
  icecek: 'drink',
};

function nameLead(r: Recipe): string {
  const ascii = asciiFold(r.title);
  const naming = ascii === r.title ? r.title : `${r.title} (${ascii})`;
  const kind = CATEGORY_EN[r.categoryId] ?? 'home dish';
  return `The dish is ${naming}, a traditional Turkish ${kind}.`;
}

function fallbackLook(r: Recipe): string {
  const comp = r.components[0];
  const mains = (comp?.ingredients ?? [])
    .filter((i) => !INVISIBLE.has(i.slug))
    .sort((a, b) => b.grams - a.grams)
    .slice(0, 4)
    .map((i) => BY_SLUG.get(i.slug)?.nameEn ?? i.slug.replace(/-/g, ' '));

  /**
   * İçecekte pişirme yöntemi cümlesi yanlış bilgi veriyor.
   *
   * Ayranın yöntemi `karistir` ve METHOD_LOOK bunu "mixed together, rustic and
   * uneven" diye çeviriyor — bir bardak ayran için tam tersi doğru: pürüzsüz,
   * soğuk, köpüklü. Ad artık "Ev Ayranı" diyor; yöntem cümlesi adla
   * çelişmesin diye içecekte hiç kullanılmıyor.
   */
  const method =
    r.categoryId === 'icecek'
      ? 'served in the glass it is drunk from'
      : (METHOD_LOOK[comp?.method ?? 'tava'] ?? 'home-cooked');
  return mains.length
    ? `Made with ${mains.join(', ')}, ${method}, presented the way it is actually served at home`
    : `${method.charAt(0).toUpperCase()}${method.slice(1)}, presented the way it is actually served at home`;
}

export function buildPrompt(r: Recipe): GorselPrompt {
  const angle = angleFor(r);
  const vessel = vesselFor(r);
  const surface = surfaceFor(r);
  const prop = propFor(r);
  const look = DISH_LOOK[r.slug] ?? fallbackLook(r);

  const parts = [
    ANGLE_TEXT[angle],
    nameLead(r),
    // DISH_LOOK girdileri küçük harfle başlıyor; ad cümlesinden sonra geldiği
    // için baş harfi burada büyütülüyor.
    `${look.charAt(0).toLocaleUpperCase('tr-TR')}${look.slice(1)}.`,
    `Served ${vesselPhrase(vessel)}, placed on ${surface}.`,
    plateFinish(r, vessel, angle),
    prop,
    `${lightFor(r)}.`,
    grammarFor(r),
  ].filter(Boolean);

  return {
    slug: r.slug,
    title: r.title,
    categoryId: r.categoryId,
    angle,
    vessel,
    surface,
    prop,
    finish: plateFinish(r, vessel, angle).replace(/^The vessel is finished in |\.$/g, ''),
    hasPhoto: Boolean(r.imageUrl),
    prompt: parts.join(' '),
    negative: [
      ...FIXED_NEGATIVE,
      ...(angle === 90 ? TOPDOWN_NEGATIVE : []),
      ...(r.categoryId === 'icecek' ? [] : NEGATIVE_YEMEK_ONLY),
      ...garnishNegatives(r),
    ].join(', '),
  };
}

// ── CLI ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const hepsi = flag('hepsi');
const targets = RECIPES.filter((r) => hepsi || !r.imageUrl);

const incele = value('incele');
if (incele) {
  const r = RECIPES.find((x) => x.slug === incele);
  if (!r) {
    console.error(`Tarif bulunamadı: ${incele}`);
    process.exit(1);
  }
  const p = buildPrompt(r);
  console.log(`\n${p.title}  (${p.categoryId}, ${p.angle}°)`);
  console.log(`${'─'.repeat(70)}\n`);
  console.log(p.prompt);
  console.log(`\nNEGATIVE:\n${p.negative}\n`);
  if (!DISH_LOOK[r.slug]) {
    console.log('⚠  DISH_LOOK tanımı yok — genel tanım kullanıldı, tanınırlık düşük.\n');
  }
  process.exit(0);
}

const ornek = value('ornek');
if (ornek) {
  const n = Number(ornek) || 8;
  const step = Math.max(1, Math.floor(targets.length / n));
  for (let i = 0; i < targets.length && i / step < n; i += step) {
    const p = buildPrompt(targets[i]!);
    console.log(`\n■ ${p.title}  ·  ${p.categoryId}  ·  ${p.angle}°`);
    console.log(`  kap:    ${p.vessel}`);
    console.log(`  zemin:  ${p.surface}`);
    console.log(`  aksesuar: ${p.prop || '—'}`);
  }
  console.log();
  process.exit(0);
}

if (flag('write')) {
  const path = hepsi
    ? 'data-build/gorsel-promptlari-hepsi.jsonl'
    : 'data-build/gorsel-promptlari.jsonl';
  fs.mkdirSync('data-build', { recursive: true });
  fs.writeFileSync(path, targets.map((r) => JSON.stringify(buildPrompt(r))).join('\n') + '\n');
  console.log(`${targets.length} prompt yazıldı → ${path}`);
  process.exit(0);
}

// ── Şüpheli kayıt denetimi ─────────────────────────────────────────
//
// Üreteç `categoryId` ve `method` alanlarına güveniyor; ikisi de korpusta
// hatalı olabiliyor ve hata görselde ÇOK daha görünür hâle geliyor. Yanlış
// kategorideki bir tarif şu an sadece yanlış listede duruyor; görsel
// eklenince yanlış kaba giriyor ve yanlış açıdan çekiliyor.
//
// "Pırasalı Mısır Unlu Kek" tatlı sayıldığı için cam tatlı kâsesinde ve tam
// yandan çekilecekti. Görsel üretmeden önce bunların sayısı bilinmeli —
// üretim para harcıyor, yanlış kayda harcanan para geri gelmiyor.

// 'kabak' (bal kabağı tatlısı), 'nohut' (aşure) ve 'zeytinyagi' (baklava)
// listede DEĞİL: üçü de tatlıda meşru geçiyor ve taramayı gürültüye boğuyordu.
const TUZLU_ISARET = [
  'kuru-sogan',
  'sarimsak',
  'dana-kiyma',
  'kuzu-kiyma',
  'tavuk-gogsu',
  'domates-salcasi',
  'biber-salcasi',
  'pirasa',
  'patlican',
  'ispanak',
  'mercimek',
  'kasar',
  'beyaz-peynir',
  'sucuk',
];

/** Tatlı kategorisinde ama tuzlu yemek malzemesi taşıyan tarifler. */
function supheliTatli(r: Recipe): string[] {
  if (r.categoryId !== 'tatli') return [];
  const has = new Set(r.allSlugs);
  return TUZLU_ISARET.filter((s) => has.has(s));
}

/** Soğuk yemek (salata/meze/cacık) ama sıcak kapta servis edilecek olanlar. */
const SOGUK_AD = /(salata|cacık|cacik|piyaz|haydari|turşu|tursu|söğüş|sogus)/i;
const SICAK_YONTEM = new Set(['tava', 'firin', 'izgara', 'komur', 'kizartma', 'wok']);

function supheliSoguk(r: Recipe): boolean {
  return SOGUK_AD.test(r.title) && SICAK_YONTEM.has(r.components[0]?.method ?? 'tava');
}

if (flag('supheli')) {
  const tatli = targets.map((r) => ({ r, hits: supheliTatli(r) })).filter((x) => x.hits.length);
  const soguk = targets.filter(supheliSoguk);

  console.log(`\nŞüpheli kayıtlar — görsel üretmeden önce düzeltilmeli\n`);

  console.log(`■ Tatlı kategorisinde, tuzlu malzeme taşıyan: ${tatli.length} tarif`);
  console.log('  (tatlı kâsesine konup tam yandan çekilecekler)\n');
  for (const { r, hits } of tatli.slice(0, 20)) {
    console.log(`  ${r.slug.padEnd(38)} ${r.title.padEnd(34)} ${hits.slice(0, 3).join(', ')}`);
  }
  if (tatli.length > 20) console.log(`  … ve ${tatli.length - 20} tane daha`);

  console.log(`\n□ Soğuk yemek adı, sıcak pişirme yöntemi: ${soguk.length} tarif`);
  console.log('  BİLGİ AMAÇLI — bunlar veri hatası DEĞİL, üreteçte çözüldü.');
  console.log('  "Közlenmiş Patlıcan Salatası"nın yöntemi közleme ve bu doğru:');
  console.log('  yöntem bir BİLEŞENİN pişmesini anlatıyor, servis ise soğuk.');
  console.log('  `vesselFor` soğuk yemeklerde kabı yöntemden değil soğuk');
  console.log('  servis havuzundan seçiyor, o yüzden mangal tepsisine düşmüyorlar.\n');
  for (const r of soguk.slice(0, 8)) {
    console.log(`  ${r.slug.padEnd(38)} ${r.title.padEnd(34)} ${r.components[0]?.method}`);
  }
  if (soguk.length > 8) console.log(`  … ve ${soguk.length - 8} tane daha`);

  console.log(
    `\nDüzeltilmesi gereken: ${tatli.length} tarif` +
      ` — üretilecek ${targets.length} karenin %${((tatli.length / targets.length) * 100).toFixed(2)}'i\n`,
  );
  process.exit(0);
}

// ── Rapor ──────────────────────────────────────────────────────────

const prompts = targets.map(buildPrompt);
const tally = (fn: (p: GorselPrompt) => string) => {
  const m = new Map<string, number>();
  for (const p of prompts) m.set(fn(p), (m.get(fn(p)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

const pct = (n: number) => `${((n / prompts.length) * 100).toFixed(1)}%`;

console.log(`\nGörsel promptu — ${prompts.length} tarif`);
console.log(`(fotoğrafı olan ${RECIPES.length - targets.length} tarif ${hepsi ? 'dahil' : 'hariç'})\n`);

console.log('AÇI');
for (const [k, v] of tally((p) => `${p.angle}°`)) {
  console.log(`  ${k.padEnd(6)} ${String(v).padStart(5)}  ${pct(v)}`);
}

console.log('\nZEMİN');
for (const [k, v] of tally((p) => p.surface)) {
  console.log(`  ${String(v).padStart(5)}  ${pct(v).padStart(6)}  ${k}`);
}

console.log('\nKAP (ilk 12)');
for (const [k, v] of tally((p) => p.vessel).slice(0, 12)) {
  console.log(`  ${String(v).padStart(5)}  ${pct(v).padStart(6)}  ${k}`);
}

console.log('\nAKSESUAR');
for (const [k, v] of tally((p) => p.prop || '— yok —')) {
  console.log(`  ${String(v).padStart(5)}  ${pct(v).padStart(6)}  ${k}`);
}

const eksik = prompts.filter((p) => !DISH_LOOK[p.slug]).length;
console.log(`\nDISH_LOOK tanımı olan: ${prompts.length - eksik} · genel tanıma düşen: ${eksik}`);
console.log('Genel tanıma düşenlerde tanınırlık riski var; en çok açılan tariflerden başlayarak elle yazılmalı.\n');
