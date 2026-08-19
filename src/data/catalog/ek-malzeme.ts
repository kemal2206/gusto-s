/**
 * Tariflerin ihtiyaç duyduğu ek malzemeler.
 *
 * Sıra önemli: önce tarifler yazıldı, sonra o tariflerin istediği malzemeler
 * eklendi. Tersi olsaydı katalog şişer, kullanılmayan malzeme dolardı.
 *
 * Üç grup var:
 *  1. Temel eksikler — su, et suyu, maya, nişasta. 192'lik katalogda yoktu
 *     çünkü "aroma malzemesi" değiller; ama tarif yazınca ilk gerekenler bunlar.
 *  2. Türk/komşu mutfak eksikleri — şehriye, kadayıf, zahter, zereşk…
 *  3. Uzak Doğu — soya sosu, miso, nori, tofu, balık sosu, limon otu…
 *
 * `e:` (İngilizce ad) alanı boş bırakılmıyor: veri hattı bu alan üzerinden
 * Ahn setine bağlanıyor ve eşleşen malzeme gerçek bileşik setini alıyor.
 */

import type { RawIngredient } from './raw';

// t = [tatlı, ekşi, tuzlu, kekremsi, umami, yağlı, yakıcı]
export const EK_MALZEME: RawIngredient[] = [
  // ── 1. Temel eksikler ───────────────────────────────────────────
  { s: 'su', n: 'Su', e: 'water', c: 'diger', r: 'baglayici',
    t: [0, 0, 0, 0, 0, 0, 0], p: 0.3, a: 0, st: true, x: [] },
  { s: 'et-suyu', n: 'Et suyu', e: 'beef broth', c: 'diger', r: 'baglayici',
    rr: ['aromatik'], t: [1, 0, 4, 1, 8, 2, 0], p: 1.2, a: 5,
    x: ['et-suyu-furanonu', 'metional', 'pirazin'] },
  { s: 'tavuk-suyu', n: 'Tavuk suyu', e: 'chicken broth', c: 'diger', r: 'baglayici',
    rr: ['aromatik'], t: [1, 0, 4, 0, 7, 2, 0], p: 1.2, a: 4, st: true,
    x: ['et-suyu-furanonu', 'metional'] },
  { s: 'maya', n: 'Maya', e: 'yeast', c: 'diger', r: 'baglayici',
    t: [0, 1, 0, 2, 5, 0, 0], p: 3, a: 6, st: true,
    x: ['malt-aldehit', 'pirol-tahil', 'et-suyu-furanonu'] },
  { s: 'karbonat', n: 'Karbonat', e: 'baking soda', c: 'diger', r: 'baglayici',
    t: [0, 0, 3, 2, 0, 0, 0], p: 6, a: 0, x: [] },
  { s: 'nisasta', n: 'Nişasta', e: 'starch', c: 'tahil', r: 'baglayici',
    t: [1, 0, 0, 0, 0, 0, 0], p: 2, a: 1, st: true, x: ['pirol-tahil'] },
  { s: 'sivi-yag', n: 'Sıvı yağ', e: 'vegetable oil', c: 'yag', r: 'yag',
    t: [0, 0, 0, 0, 0, 10, 0], p: 1, a: 2, st: true, x: ['yagli-aldehit'] },

  // ── 2. Türk ve komşu mutfak ─────────────────────────────────────
  { s: 'sehriye', n: 'Tel şehriye', e: 'vermicelli', c: 'tahil', r: 'zemin',
    t: [2, 0, 0, 0, 1, 0, 0], p: 1, a: 2, al: ['gluten'], k: ['tr'], st: true,
    x: ['pirol-tahil'] },
  { s: 'kadayif', n: 'Tel kadayıf', e: 'kadayif pastry', c: 'tahil', r: 'zemin',
    t: [1, 0, 0, 0, 1, 0, 0], p: 1, a: 2, al: ['gluten'], k: ['tr', 'levanten'],
    x: ['pirol-tahil'] },
  { s: 'pirinc-unu', n: 'Pirinç unu', e: 'rice flour', c: 'tahil', r: 'baglayici',
    t: [1, 0, 0, 0, 0, 0, 0], p: 1.5, a: 1, x: ['pirol-tahil'] },
  { s: 'zahter', n: 'Zahter', e: 'zaatar', c: 'baharat', r: 'baharat',
    rr: ['bitirici'], t: [0, 2, 3, 4, 1, 1, 0], p: 5, a: 8, k: ['levanten', 'guneydogu'],
    x: ['kekik-fenolu', 'susam-tiyazolu', 'meyveli-ester'] },
  { s: 'kuru-limon', n: 'Kuru limon', e: 'dried lime', c: 'asit', r: 'aromatik',
    t: [0, 7, 0, 5, 1, 0, 0], p: 5, a: 8, k: ['iran', 'levanten'],
    x: ['sitrus-terpen', 'hmf-pekmez'] },
  { s: 'zeresk', n: 'Zereşk (kuş üzümü)', e: 'barberry', c: 'meyve', r: 'asit',
    rr: ['bitirici'], t: [2, 8, 0, 2, 0, 0, 0], p: 3, a: 5, k: ['iran'],
    x: ['meyveli-ester', 'yesil-heksanal'] },
  { s: 'yer-fistigi', n: 'Yer fıstığı', e: 'peanut', c: 'kuruyemis', r: 'bitirici',
    t: [2, 0, 1, 1, 3, 8, 0], p: 2, a: 6, al: ['yerfistigi'],
    x: ['kuruyemis-pirazini', 'malt-aldehit'] },
  { s: 'misket-limonu', n: 'Misket limonu', e: 'lime', c: 'asit', r: 'asit',
    t: [1, 9, 0, 3, 0, 0, 0], p: 2.5, a: 8,
    x: ['sitrus-terpen', 'linalol'] },
  { s: 'kuru-soganli-tursu', n: 'Turşu', e: 'pickle', c: 'sebze', r: 'bitirici',
    rr: ['asit'], t: [0, 8, 7, 2, 3, 0, 1], p: 2, a: 6, k: ['tr'],
    x: ['sarap-fermente', 'lahana-sulfur', 'yesil-heksanal'] },

  // ── 3. Uzak Doğu ────────────────────────────────────────────────
  { s: 'soya-sosu', n: 'Soya sosu', e: 'soy sauce', c: 'asit', r: 'baglayici',
    rr: ['aromatik'], t: [2, 2, 9, 2, 10, 0, 0], p: 3.5, a: 8, al: ['soya', 'gluten'],
    k: ['uzakdogu'], st: true,
    x: ['malt-aldehit', 'pirazin', 'et-suyu-furanonu', 'dumanli-guaiakol'] },
  { s: 'miso', n: 'Miso', e: 'miso', c: 'asit', r: 'baglayici',
    t: [3, 2, 9, 2, 10, 1, 0], p: 3, a: 8, al: ['soya'], k: ['uzakdogu'],
    x: ['malt-aldehit', 'et-suyu-furanonu', 'pirazin'] },
  { s: 'mirin', n: 'Mirin', e: 'mirin', c: 'tatlandirici', r: 'tatlandirici',
    t: [8, 1, 1, 0, 3, 0, 0], p: 2.5, a: 6, k: ['uzakdogu'],
    x: ['sarap-fermente', 'maltol', 'meyveli-ester'] },
  { s: 'pirinc-sirkesi', n: 'Pirinç sirkesi', e: 'rice vinegar', c: 'asit', r: 'asit',
    t: [2, 8, 0, 1, 1, 0, 0], p: 3.5, a: 5, k: ['uzakdogu'],
    x: ['sarap-fermente', 'meyveli-ester'] },
  { s: 'nori', n: 'Nori yosunu', e: 'seaweed', c: 'deniz', r: 'bitirici',
    t: [1, 0, 5, 2, 9, 0, 0], p: 4, a: 7, k: ['uzakdogu'],
    x: ['bromofenol-deniz', 'deniz-aldehiti', 'lahana-sulfur'] },
  { s: 'tofu', n: 'Tofu', e: 'tofu', c: 'protein', r: 'ana',
    t: [1, 0, 0, 1, 3, 3, 0], p: 1, a: 2, al: ['soya'], k: ['uzakdogu'],
    x: ['pirol-tahil', 'yesil-heksanal'] },
  { s: 'shiitake', n: 'Shiitake mantarı', e: 'shiitake', c: 'mantar', r: 'ana',
    rr: ['aromatik'], t: [1, 0, 1, 1, 10, 0, 0], p: 2, a: 7, k: ['uzakdogu'],
    x: ['mantar-oktenol', 'lahana-sulfur', 'kavrulmus-tiyol'] },
  { s: 'pak-choy', n: 'Pak choy', e: 'bok choy', c: 'sebze', r: 'ana',
    t: [2, 0, 0, 3, 2, 0, 0], p: 1, a: 4, k: ['uzakdogu'],
    x: ['lahana-sulfur', 'izotiyosiyanat', 'yesil-heksanal'] },
  { s: 'balik-sosu', n: 'Balık sosu', e: 'fish sauce', c: 'asit', r: 'baglayici',
    t: [1, 1, 10, 1, 10, 0, 0], p: 4, a: 9, k: ['uzakdogu'],
    x: ['deniz-aldehiti', 'et-suyu-furanonu', 'peynir-butirigi'] },
  { s: 'hindistan-cevizi-sutu', n: 'Hindistan cevizi sütü', e: 'coconut milk',
    c: 'sut', r: 'baglayici', rr: ['yag'], t: [4, 0, 1, 1, 2, 8, 0], p: 1.3, a: 5,
    k: ['uzakdogu'], x: ['seftali-laktonu', 'yagli-aldehit', 'maltol'] },
  { s: 'limon-otu', n: 'Limon otu', e: 'lemongrass', c: 'ot', r: 'aromatik',
    t: [0, 2, 0, 2, 0, 0, 0], p: 5, a: 9, k: ['uzakdogu'],
    x: ['sitrus-terpen', 'gul-terpeni', 'linalol'] },
  { s: 'kari-macunu', n: 'Kırmızı köri macunu', e: 'curry paste', c: 'baharat',
    r: 'baharat', rr: ['aromatik'], t: [2, 1, 5, 2, 5, 1, 7], p: 4, a: 9,
    k: ['uzakdogu'], x: ['sitrus-terpen', 'allil-sulfur', 'kimyon-aldehiti'] },
  { s: 'gochujang', n: 'Gochujang', e: 'gochujang', c: 'baharat', r: 'baglayici',
    rr: ['baharat'], t: [5, 2, 7, 2, 8, 1, 6], p: 3.5, a: 8, al: ['soya'],
    k: ['uzakdogu'], x: ['hmf-pekmez', 'malt-aldehit', 'furfural'] },
  { s: 'kimchi', n: 'Kimchi', e: 'kimchi', c: 'sebze', r: 'bitirici',
    rr: ['asit'], t: [1, 7, 6, 2, 7, 0, 5], p: 2.5, a: 8, k: ['uzakdogu'],
    x: ['lahana-sulfur', 'allil-sulfur', 'sarap-fermente'] },
  { s: 'pirinc-eristesi', n: 'Pirinç eriştesi', e: 'rice noodle', c: 'tahil',
    r: 'zemin', t: [1, 0, 0, 0, 1, 0, 0], p: 1, a: 1, k: ['uzakdogu'],
    x: ['pirol-tahil'] },
  { s: 'ramen-eristesi', n: 'Ramen eriştesi', e: 'ramen noodle', c: 'tahil',
    r: 'zemin', t: [2, 0, 1, 0, 2, 0, 0], p: 1, a: 3, al: ['gluten'],
    k: ['uzakdogu'], x: ['pirol-tahil', 'malt-aldehit'] },
  { s: 'sichuan-biberi', n: 'Sichuan biberi', e: 'sichuan pepper', c: 'baharat',
    r: 'baharat', t: [0, 0, 0, 3, 0, 0, 5], p: 7, a: 9, k: ['uzakdogu'],
    x: ['sitrus-terpen', 'biberli-odunsu', 'linalol'] },
  { s: 'yildiz-anason', n: 'Yıldız anason', e: 'star anise', c: 'baharat',
    r: 'baharat', t: [3, 0, 0, 2, 0, 0, 0], p: 8, a: 9, k: ['uzakdogu'],
    x: ['anetol', 'sineol'] },
];

/**
 * İçe aktarılan tariflerin gerektirdiği ek malzemeler.
 *
 * 3.320 tariflik Türk korpusunda en sık geçen ama katalogda olmayanlar.
 * Çoğu tatlı ve kahvaltı malzemesi — elle yazdığım 99 tarif bu alanları
 * az kullandığı için eksik kalmışlardı.
 */
export const ITHAL_EK: RawIngredient[] = [
  { s: 'kabartma-tozu', n: 'Kabartma tozu', e: 'baking powder', c: 'diger', r: 'baglayici',
    t: [0, 0, 2, 2, 0, 0, 0], p: 6, a: 0, st: true, x: [] },
  { s: 'pudra-sekeri', n: 'Pudra şekeri', e: 'powdered sugar', c: 'tatlandirici', r: 'tatlandirici',
    t: [10, 0, 0, 0, 0, 0, 0], p: 3, a: 0, x: [] },
  { s: 'kakao', n: 'Kakao', e: 'cocoa', c: 'tatlandirici', r: 'aromatik',
    t: [1, 0, 0, 7, 3, 3, 0], p: 5, a: 8, x: ['pirazin', 'malt-aldehit', 'furfural'] },
  { s: 'bitter-cikolata', n: 'Bitter çikolata', e: 'dark chocolate', c: 'tatlandirici',
    r: 'aromatik', rr: ['tatlandirici'], t: [5, 0, 0, 6, 2, 7, 0], p: 3, a: 8,
    x: ['pirazin', 'malt-aldehit', 'vanilin', 'furfural'] },
  { s: 'galeta-unu', n: 'Galeta unu', e: 'breadcrumbs', c: 'tahil', r: 'baglayici',
    t: [1, 0, 1, 0, 2, 0, 0], p: 1.5, a: 4, al: ['gluten'], x: ['pirol-tahil', 'malt-aldehit'] },
  { s: 'hindistan-cevizi', n: 'Hindistan cevizi', e: 'coconut', c: 'kuruyemis', r: 'bitirici',
    t: [4, 0, 0, 1, 1, 8, 0], p: 2, a: 6, x: ['seftali-laktonu', 'maltol'] },
  { s: 'mayonez', n: 'Mayonez', e: 'mayonnaise', c: 'yag', r: 'baglayici',
    rr: ['yag'], t: [2, 3, 4, 0, 2, 9, 0], p: 1.5, a: 4, al: ['yumurta'],
    x: ['sarap-fermente', 'yagli-aldehit'] },
  { s: 'misir-konserve', n: 'Konserve mısır', e: 'sweet corn', c: 'sebze', r: 'bitirici',
    t: [6, 0, 2, 0, 2, 0, 0], p: 1, a: 3, x: ['maltol', 'pirol-tahil'] },
  { s: 'kori', n: 'Köri', e: 'curry powder', c: 'baharat', r: 'baharat',
    t: [1, 0, 0, 3, 2, 0, 3], p: 6, a: 9,
    x: ['zerdecal-turmeronu', 'kimyon-aldehiti', 'kisnis-tohumu'] },
  { s: 'muz', n: 'Muz', e: 'banana', c: 'meyve', r: 'ana', rr: ['tatlandirici'],
    t: [8, 1, 0, 0, 0, 1, 0], p: 1.2, a: 6, x: ['muzlu-ester', 'maltol'] },
  { s: 'krem-santi', n: 'Krem şanti', e: 'whipped cream', c: 'sut', r: 'bitirici',
    t: [7, 0, 0, 0, 1, 8, 0], p: 1.5, a: 3, al: ['laktoz'], x: ['tereyagi-diasetili', 'vanilin'] },
  { s: 'soda', n: 'Soda', e: 'sparkling water', c: 'icecek', r: 'baglayici',
    t: [0, 1, 1, 0, 0, 0, 0], p: 0.5, a: 0, x: [] },
  { s: 'ketcap', n: 'Ketçap', e: 'ketchup', c: 'asit', r: 'baglayici',
    t: [6, 5, 4, 0, 6, 0, 0], p: 2.5, a: 5, x: ['hmf-pekmez', 'sarap-fermente', 'damaskenon'] },
  { s: 'biskuvi', n: 'Bisküvi', e: 'biscuit', c: 'tahil', r: 'zemin',
    t: [6, 0, 1, 0, 1, 4, 0], p: 1.5, a: 5, al: ['gluten'],
    x: ['pirol-tahil', 'malt-aldehit', 'maltol'] },
  { s: 'margarin', n: 'Margarin', e: 'margarine', c: 'yag', r: 'yag',
    t: [1, 0, 2, 0, 1, 10, 0], p: 1.5, a: 3, x: ['tereyagi-diasetili', 'yagli-aldehit'] },
  { s: 'marul', n: 'Marul', e: 'lettuce', c: 'sebze', r: 'ana', rr: ['bitirici'],
    t: [1, 0, 0, 2, 1, 0, 0], p: 1, a: 3, x: ['yesil-heksanal'] },
  { s: 'tost-ekmegi', n: 'Tost ekmeği', e: 'sandwich bread', c: 'tahil', r: 'zemin',
    t: [2, 0, 2, 0, 2, 1, 0], p: 1, a: 3, al: ['gluten'], x: ['pirol-tahil', 'malt-aldehit'] },
  { s: 'maden-suyu', n: 'Maden suyu', e: 'mineral water', c: 'icecek', r: 'baglayici',
    t: [0, 1, 2, 0, 0, 0, 0], p: 0.5, a: 0, x: [] },
  { s: 'hashas', n: 'Haşhaş', e: 'poppy seed', c: 'baharat', r: 'bitirici',
    t: [1, 0, 0, 2, 2, 5, 0], p: 3, a: 6, x: ['kuruyemis-pirazini'] },
  { s: 'kuru-uzum-kus', n: 'Kuş üzümü', e: 'currant', c: 'meyve', r: 'tatlandirici',
    t: [8, 3, 0, 1, 0, 0, 0], p: 2, a: 6, x: ['hmf-pekmez', 'damaskenon', 'meyveli-ester'] },
  { s: 'milfoy', n: 'Milföy hamuru', e: 'puff pastry', c: 'tahil', r: 'zemin',
    t: [1, 0, 1, 0, 1, 7, 0], p: 1, a: 3, al: ['gluten'], x: ['pirol-tahil', 'tereyagi-diasetili'] },
  { s: 'brokoli-bruksel', n: 'Brüksel lahanası', e: 'brussels sprout', c: 'sebze', r: 'ana',
    t: [2, 0, 0, 4, 2, 0, 0], p: 1, a: 5, x: ['lahana-sulfur', 'izotiyosiyanat'] },
];
