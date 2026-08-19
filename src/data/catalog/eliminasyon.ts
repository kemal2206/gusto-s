/**
 * Eliminasyon şablonları — belirli malzeme gruplarını tamamen çıkarma.
 *
 * **Bunlar tedavi protokolü değil, malzeme listesi.** Şablonlar neyi
 * eledikleriyle adlandırıldı; "egzema diyeti", "bağırsak iyileştirme" gibi
 * bir iddiada bulunmuyoruz. Sebep basit ve önemli:
 *
 *  - Egzemada (atopik dermatit) rutin eliminasyon diyeti, tanısı konmuş bir
 *    besin alerjisi yoksa dermatoloji kılavuzlarınca önerilmiyor.
 *  - Gereksiz eliminasyon çocukta besin eksikliğine yol açabiliyor ve
 *    elenen besine karşı sonradan gerçek alerji gelişme riskini artırıyor.
 *
 * Yani doğru kullanım şu: **doktor ya da diyetisyen neyi keseceğini söyler,
 * uygulama onu süzer.** Şablonlar bu işi hızlandırmak için var; hepsinin
 * yanında "kendi listeni kur" seçeneği duruyor.
 *
 * Listeler kaynaktan kaynağa değişiyor (özellikle histamin). Buradakiler
 * yaygın kabul gören ortak çekirdek; kullanıcı üstüne ekleyip çıkarabiliyor.
 */

export type EliminationId = 'sut-yumurta-gluten' | 'histamin' | 'nikel';

export interface Elimination {
  id: EliminationId;
  labelTr: string;
  /** Neyi elediği — tek satırda, iddiasız. */
  summaryTr: string;
  /** Ekranda gösterilen uyarı ya da belirsizlik notu. */
  noteTr?: string;
  slugs: string[];
  categories?: string[];
  /**
   * Ad üzerinden güvenlik ağı.
   *
   * Malzeme listesi her zaman eksiksiz değil: içe aktarılan korpusta adı
   * "Sütlü Tatlı" olup sütü eşleşmemiş tarifler var. Tercih filtresinde bu
   * küçük bir hata, sağlık filtresinde değil — o yüzden ada da bakıyoruz.
   */
  nameBlock: RegExp;
}

export const ELIMINATIONS: Elimination[] = [
  {
    id: 'sut-yumurta-gluten',
    labelTr: 'Süt, yumurta ve gluten',
    summaryTr: 'Süt ürünleri, yumurta ve buğday içeren her şey çıkarılır',
    noteTr:
      'Atopik egzemada en sık denenen üçlü. Üçünü birden kesmek besin ' +
      'çeşitliliğini daraltıyor; özellikle çocuklarda bir sağlık çalışanına ' +
      'danışmadan sürdürmemek gerekiyor.',
    categories: ['sut'],
    slugs: [
      'yumurta',
      'un', 'irmik', 'misir-unu', 'pirinc-unu', 'galeta-unu', 'nisasta',
      'makarna', 'eriste', 'sehriye', 'arpa-sehriye', 'kuskus',
      'bulgur', 'ince-bulgur', 'firik', 'tarhana',
      'ekmek', 'tost-ekmegi', 'yufka', 'milfoy', 'kadayif', 'biskuvi',
      'mayonez', 'krem-santi',
    ],
    nameBlock:
      /süt|peynir|yoğurt|ayran|kaymak|tereyağ|krema|yumurta|omlet|menemen|börek|pide|makarna|erişte|mantı|ekmek|poğaça|açma|çörek|baklava|kadayıf|lahmacun|muhallebi|beşamel|sütlaç/i,
  },
  {
    id: 'histamin',
    labelTr: 'Histamin düşük',
    summaryTr: 'Fermente ürünler, sirke, turşu, şarküteri, domates, turunçgil',
    noteTr:
      'Histamin listeleri kaynaktan kaynağa belirgin biçimde değişiyor ve ' +
      'kişiden kişiye eşik farklı. Buradaki liste yaygın kabul gören ortak ' +
      'çekirdek; kendi listeni kurup üstüne ekleyebilirsin.',
    categories: ['deniz', 'sarkuteri'],
    slugs: [
      // Fermente ve salamura
      'uzum-sirkesi', 'elma-sirkesi', 'pirinc-sirkesi', 'soya-sosu', 'miso',
      'balik-sosu', 'gochujang', 'kimchi', 'kuru-soganli-tursu', 'maya',
      'siyah-zeytin', 'yesil-zeytin', 'kapari',
      // Olgunlaşmış ve işlenmiş
      'kars-gravyeri', 'tulum-peyniri', 'keci-peyniri', 'kasar',
      // Histaminden zengin bitkisel
      'domates', 'domates-salcasi', 'biber-salcasi', 'ketcap', 'kuru-domates',
      'ispanak', 'patlican', 'cilek', 'nar-eksisi',
      'limon', 'limon-kabugu', 'portakal', 'mandalina', 'misket-limonu',
      // Kakao ve alkol
      'bitter-cikolata', 'kakao', 'kirmizi-sarap', 'beyaz-sarap', 'raki',
    ],
    nameBlock: /turşu|sirke|salam|sucuk|pastırma|balık|hamsi|somon|midye|karides|kalamar|şarap|domates|ıspanak|patlıcan|çikolata|zeytin/i,
  },
  {
    id: 'nikel',
    labelTr: 'Nikel düşük',
    summaryTr: 'Bakliyat, tam tahıl, kuruyemiş, kakao, ıspanak, domates',
    noteTr:
      'Sistemik nikel alerjisi tanısı olanlar için. Bakliyat ve kuruyemiş ' +
      'çıkınca bitkisel protein kaynağı daralıyor — beslenme dengesine ' +
      'dikkat etmek gerekiyor.',
    categories: ['baklagil', 'kuruyemis'],
    slugs: [
      'bulgur', 'ince-bulgur', 'firik', 'kuskus',
      'ispanak', 'pazi', 'domates', 'domates-salcasi', 'biber-salcasi',
      'kakao', 'bitter-cikolata', 'misir-konserve', 'soya-sosu',
      'bezelye', 'bakla', 'tofu',
    ],
    nameBlock: /nohut|mercimek|fasulye|barbunya|börülce|ceviz|fındık|badem|fıstık|çikolata|ıspanak|domates|bulgur/i,
  },
];

export const ELIMINATION_BY_ID = new Map(ELIMINATIONS.map((e) => [e.id, e]));
