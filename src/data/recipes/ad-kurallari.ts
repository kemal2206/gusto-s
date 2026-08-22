/**
 * Yemek adından kategori çıkarma.
 *
 * Türkçede yemek adı kategoriyi neredeyse her zaman söylüyor: "…çorbası",
 * "…böreği", "…kebabı". Bu kurallar üç yerde kullanılıyor ve tek yerde
 * durmaları önemli, yoksa üçü ayrı ayrı kayıyor:
 *
 *  1. Tarif korpusunu içe aktarırken (`scripts/pipeline/05-tarif-ithal.ts`) —
 *     kaynağın 8 kaba kategorisini daraltmak için
 *  2. Yemek kitabına eklenen **sosyal medya videosunu** bölümlemek için —
 *     elimizdeki tek veri videonun başlığı
 *  3. Kullanıcının **kendi yazdığı tarifi** bölümlemek için
 *
 * Sıra önemli: ilk eşleşen kural kazanıyor.
 *
 * ── Kelime sınırı ──────────────────────────────────────────────────
 *
 * Kurallar önce düz regex'ti ve `tr-kelime.ts`'in çözdüğü hatanın aynısına
 * düşüyordu. Ölçülen sonuç:
 *
 *   /kek/     →  "Keşkek", "Kekikli Et Haşlama"  → tatlı
 *   /balık/   →  "kalabalık"
 *   /sos/     →  "Sosisli…"                      → sos-marine
 *
 * Keşkek bu yüzden tatlı kategorisindeydi. Görsel üretimi bu hatayı ortaya
 * çıkardı: kategori aynı zamanda kabı ve çekim açısını belirlediği için
 * keşkek cam tatlı kâsesinde ve tam yandan çekilecekti.
 *
 * Artık bütün kalıplar `kelimeBasi` / `tamKelime` ile kuruluyor.
 * **Buraya düz regex yazma** — `\b` Türkçede ASCII'ye göre çalışıyor ve
 * `ı ş ğ ç ö ü` harflerinin yanında yanlış yere düşüyor.
 *
 * ── Güçlü tatlı kuralı neden en üstte ──────────────────────────────
 *
 * "Ekmek Kadayıfı" hamur işi sayılıyordu: hamur-isi kuralındaki `ekmek`,
 * tatlı kuralından önce geliyor. Tartışmasız tatlı olan adlar (baklava,
 * kadayıf, künefe, sütlaç…) bu yüzden ayrı bir kural olarak en başa alındı.
 * Sıra değiştirmek yerine güçlü sinyali öne çekmek, diğer kuralların
 * dengesini bozmuyor.
 */

import { kelimeBasi, tamKelime } from '@/data/catalog/tr-kelime';

/**
 * Adı tatlı kelimesi taşıyan tuzlu yemekler.
 *
 * "Tuzlu Kek", "Peynirli Kek", "Pizza Kurabiye", "Ispanaklı Pasta" — hepsi
 * hamur işi. Tatlı kuralı bunları tatlıya alıyordu ve görselde cam tatlı
 * kâsesine giriyorlardı.
 *
 * Kural iki koşulu birden arıyor (tuzlu işaret **ve** tatlı kelimesi), çünkü
 * ikisi adın içinde bitişik durmuyor: "Peynirli Tava Keki", "Mısır Unlu
 * Tuzlu Kek". Türkçe büyük I sorunu yüzünden `[Iı]` açıkça yazılıyor —
 * JavaScript'in `i` bayrağı 'I' ile 'ı'yı eşleştirmiyor.
 */
const TUZLU_HAMUR =
  /^(?=.*(tuzlu|peynirli|[Iı]spanaklı|patatesli|pizza|salçalı|kıymalı|kaşarlı|sucuklu|zeytinli))(?=.*(kek|kurabiye|pasta|lokma|börek|poğaça)).*$/i;

export const NAME_RULES: [RegExp, string][] = [
  [TUZLU_HAMUR, 'hamur-isi'],

  /**
   * Börek her zaman tuzlu.
   *
   * Tatlı kuralından ÖNCE geliyor: "Tel Kadayıf Böreği" kadayıf geçtiği için
   * tatlı sayılıyordu ama içeriği kadayıf + kaşar + tuz + karabiber.
   * Türkçede tatlı bir "börek" yok; sinyal tek yönlü ve güvenli.
   */
  [kelimeBasi('börek', 'böreği'), 'hamur-isi'],

  // Tartışmasız tatlılar — başka kategorinin kelimesini içerseler bile
  // ("Ekmek Kadayıfı") tatlı kalmalılar.
  //
  // `baklava` TAM KELİME: `kelimeBasi` olsaydı "Baklavalık Yufkadan Peynirli
  // Börek" tatlı olurdu — baklavalık yufka tuzlu böreklerde de kullanılıyor.
  [tamKelime('baklava', 'baklavası', 'baklavayı', 'baklavalar'), 'tatli'],
  [
    kelimeBasi(
      'kadayıf',
      'künefe',
      'sütlaç',
      'revani',
      'helva',
      'muhallebi',
      'tiramisu',
      'cheesecake',
      'profiterol',
      'şekerpare',
      'dondurma',
      'magnolia',
      'browni',
      'puding',
      'lokma',
      'aşure',
      'güllaç',
      'kazandibi',
      'tulumba',
      'şöbiyet',
    ),
    'tatli',
  ],

  [kelimeBasi('çorba'), 'corba'],
  [
    kelimeBasi('kebap', 'kebab', 'köfte', 'şiş', 'ızgara', 'pirzola', 'sucuk', 'külbastı'),
    'kebap-izgara',
  ],
  [kelimeBasi('dolma', 'sarma', 'yaprak'), 'dolma-sarma'],
  [kelimeBasi('zeytinyağlı', 'imambayıldı'), 'zeytinyagli'],
  [kelimeBasi('pilav', 'makarna', 'erişte', 'mantı', 'spagetti', 'noodle'), 'pilav-makarna'],
  [
    kelimeBasi(
      'börek',
      'poğaça',
      'açma',
      'pide',
      'lahmacun',
      'gözleme',
      'çörek otlu',
      'ekmek',
      'simit',
      'milföy',
      'katmer',
    ),
    'hamur-isi',
  ],
  [
    kelimeBasi(
      'balık',
      'hamsi',
      'levrek',
      'çipura',
      'somon',
      'karides',
      'midye',
      'kalamar',
      'uskumru',
      'palamut',
      'alabalık',
      'deniz ürün',
    ),
    'deniz',
  ],
  [
    kelimeBasi(
      'salata',
      'meze',
      'cacık',
      'haydari',
      'humus',
      'ezme',
      'piyaz',
      'turşu',
      'tarator',
      'pilaki',
      'şakşuka',
      'babagannuş',
      'çiğ köfte',
      'kısır',
      'tabule',
      'söğüş',
    ),
    'meze-salata',
  ],
  // "Baharatlı Zeytinyağı" kaynakta içecek diye geçiyor; yemek değil, sos.
  // `sos` tam kelime: `kelimeBasi` olsa "Sosisli Tost" buraya düşerdi.
  [tamKelime('sos', 'sosu', 'marine', 'marinasyon', 'terbiye'), 'sos-marine'],
  [kelimeBasi('aromalı yağ', 'sarımsaklı yağ'), 'sos-marine'],

  // `kek` ve `tatlı` tam kelime: "Keşkek" ve "Kekikli…" buraya düşmemeli.
  [
    tamKelime('kek', 'keki', 'keke', 'kekli', 'kekler', 'kekim', 'tatlı', 'tatlısı', 'tatlılar'),
    'tatli',
  ],
  [kelimeBasi('kurabiye', 'reçel', 'komposto tatlı'), 'tatli'],

  // Tatlı kuralı önce geliyor: "Kahveli Kurabiye" içecek değil.
  [
    kelimeBasi(
      'ayran',
      'limonata',
      'şerbet',
      'şurup',
      'komposto',
      'hoşaf',
      'salep',
      'boza',
      'smoothie',
      'milkshake',
      'şıra',
    ),
    'icecek',
  ],
  [/(^|[^a-zA-ZçğıöşüÇĞİIÖŞÜ])(çayı?|kahvesi|suyu)$/i, 'icecek'],

  [kelimeBasi('kahvaltı', 'menemen', 'omlet', 'yumurta', 'tost', 'sandviç', 'krep', 'pankek'), 'kahvalti'],
];

/** Ada bakarak kategoriyi daralt; eşleşme yoksa verilen varsayılan kalıyor. */
export function refineCategory(name: string, fallback: string): string {
  for (const [re, cat] of NAME_RULES) if (re.test(name)) return cat;
  return fallback;
}

/**
 * Soğuk servis edilen yemek mi?
 *
 * Kaynağın pişirme yöntemi alanı boşsa içe aktarıcı `tava`'ya düşüyordu ve
 * cacık, piyaz, turşu "tavada pişmiş" sayılıyordu. Görselde bunun sonucu
 * salatanın döküm tavada servis edilmesi — 134 tarifte.
 *
 * Yöntem alanı **hiçbir referans sette doğrulanamıyor** (bkz. besin
 * hesabındaki not), o yüzden burada ada bakıyoruz: ad soğuk bir yemek
 * söylüyorsa varsayılan `cig` olmalı, `tava` değil.
 */
export const SOGUK_AD = kelimeBasi(
  'salata',
  'cacık',
  'piyaz',
  'turşu',
  'haydari',
  'tarator',
  'ezme',
  'kısır',
  'tabule',
  'söğüş',
  'humus',
  'babagannuş',
  'çiğ köfte',
);

export function isSogukYemek(name: string): boolean {
  return SOGUK_AD.test(name);
}

/**
 * Serbest metinden kategori tahmini.
 *
 * Videoda ve kullanıcının kendi tarifinde güvenilir bir kategori alanı yok;
 * elimizde başlık (ve varsa açıklama) var. Hiçbir kural tutmazsa `null`
 * dönüyoruz — yanlış bir bölüme atmaktansa "Diğer"de kalsın.
 */
export function guessCategory(...texts: (string | undefined)[]): string | null {
  const text = texts.filter(Boolean).join(' ');
  if (!text.trim()) return null;
  for (const [re, cat] of NAME_RULES) if (re.test(text)) return cat;
  return null;
}
