/**
 * Aroma bileşik AİLELERİ (54 adet).
 *
 * Neden aile, neden tek tek bileşik değil?
 * FlavorDB2'de 26.000'den fazla bileşik var ve bunları elle atamak imkânsız.
 * Ama bileşiklerin duyusal etkisi ailelere göre kümelenir: limonen, terpinen ve
 * sitral aynı "sitrus-terpen" işini yapar. Bu yüzden aşama 1'de her malzemeye
 * aile etiketi veriyoruz — motor matematiği birebir aynı (küme üzerinde IDF
 * ağırlıklı kosinüs), sadece çözünürlük daha kaba.
 *
 * Aşama 2'de bu etiketler gerçek bileşik id'leriyle değişecek; `Ingredient`
 * tipi ve motor kodu değişmeyecek çünkü ikisi de sadece "sayı kümesi" görüyor.
 *
 * Her ailenin altında hangi gerçek bileşikleri temsil ettiği yazıyor —
 * aşama 2'deki eşleme bu listeden yürüyecek.
 */

export interface AromaClass {
  id: number;
  slug: string;
  nameTr: string;
  /** Duyusal tarif — "neden?" ekranında kullanıcıya bu gösterilir. */
  senseTr: string;
  /** Temsil ettiği gerçek bileşikler (aşama 2 eşlemesi için). */
  compounds: string[];
}

export const AROMA_CLASSES: AromaClass[] = [
  // ── Terpenler / terpenoidler ──────────────────────────────────────
  { id: 1, slug: 'sitrus-terpen', nameTr: 'sitrus-terpen', senseTr: 'limon kabuğu, ferah',
    compounds: ['limonene', 'beta-myrcene', 'terpinolene'] },
  { id: 2, slug: 'linalol', nameTr: 'linalol', senseTr: 'çiçeksi, hafif sitrus',
    compounds: ['linalool', 'linalyl_acetate'] },
  { id: 3, slug: 'recineli-pinen', nameTr: 'reçineli pinen', senseTr: 'çam, orman',
    compounds: ['a-pinene', 'b-pinene', 'camphene'] },
  { id: 4, slug: 'sineol', nameTr: 'sineol', senseTr: 'okaliptus, serin, tıbbi',
    compounds: ['1,4-cineole', 'eucalyptol'] },
  { id: 5, slug: 'mentol', nameTr: 'mentol', senseTr: 'nane, soğuk',
    compounds: ['menthol', 'menthone', 'pulegone'] },
  { id: 6, slug: 'kekik-fenolu', nameTr: 'kekik fenolü', senseTr: 'kekik, keskin, otsu',
    compounds: ['thymol', 'carvacrol', 'p-cymene'] },
  { id: 7, slug: 'anetol', nameTr: 'anetol', senseTr: 'anason, rezene, tatlımsı',
    compounds: ['trans-anethole', 'estragole', 'fenchone'] },
  { id: 8, slug: 'ojenol', nameTr: 'öjenol', senseTr: 'karanfil, sıcak, baharatlı',
    compounds: ['eugenol', 'isoeugenol'] },
  { id: 9, slug: 'biberli-odunsu', nameTr: 'biberli-odunsu', senseTr: 'karabiber, odun',
    compounds: ['b-caryophyllene', 'caryophyllene_alcohol'] },
  { id: 10, slug: 'gul-terpeni', nameTr: 'gül terpeni', senseTr: 'gül, sabunumsu tatlılık',
    compounds: ['geraniol', 'citronellol', 'nerol', 'phenethyl_acetate'] },
  { id: 11, slug: 'safranal', nameTr: 'safranal', senseTr: 'safran, bal-ot arası',
    compounds: ['safranal', 'picrocrocin'] },
  { id: 12, slug: 'zencefil-terpeni', nameTr: 'zencefil terpeni', senseTr: 'zencefil, keskin sıcak',
    compounds: ['zingiberene', 'gingerol', 'ar-curcumene'] },
  { id: 13, slug: 'tarhun-estragol', nameTr: 'tarhun aroması', senseTr: 'tarhun, anasona yakın ot',
    compounds: ['estragole', 'anisyl_alcohol'] },

  // ── Sülfürlüler ───────────────────────────────────────────────────
  { id: 14, slug: 'allil-sulfur', nameTr: 'allil sülfür', senseTr: 'sarımsak, soğan, keskin',
    compounds: ['allyl_disulfide', 'allyl_sulfide', 'diallyl_trisulfide', 'propyl_disulfide'] },
  { id: 15, slug: 'izotiyosiyanat', nameTr: 'izotiyosiyanat', senseTr: 'hardal, turp, burun yakan',
    compounds: ['allyl_isothiocyanate', 'phenethyl_isothiocyanate'] },
  { id: 16, slug: 'lahana-sulfur', nameTr: 'lahana sülfürü', senseTr: 'pişmiş lahana, kükürtlü',
    compounds: ['dimethyl_trisulfide', 'dimethyl_disulfide'] },
  { id: 17, slug: 'metional', nameTr: 'metional', senseTr: 'haşlanmış patates, etli',
    compounds: ['3-(methylthio)_propionaldehyde', 'ethyl-3-methylthiopropionate'] },
  { id: 18, slug: 'kavrulmus-tiyol', nameTr: 'kavrulmuş tiyol', senseTr: 'kavrulmuş et, kahve',
    compounds: ['furfuryl_mercaptan', 'furfuryl_methyl_sulfide'] },

  // ── Maillard / pişirme ────────────────────────────────────────────
  { id: 19, slug: 'pirazin', nameTr: 'pirazin', senseTr: 'kavrulmuş, fındıksı, kızarmış',
    compounds: ['2-methylpyrazine', '2,5-dimethylpyrazine', 'acetylpyrazine'] },
  { id: 20, slug: 'furfural', nameTr: 'furfural', senseTr: 'karamel, ekmek kabuğu',
    compounds: ['furfural', '5-methylfurfural'] },
  { id: 21, slug: 'maltol', nameTr: 'maltol', senseTr: 'yanık şeker, tatlı sıcaklık',
    compounds: ['maltol'] },
  { id: 22, slug: 'hmf-pekmez', nameTr: 'pekmez karamelizasyonu', senseTr: 'koyu pekmez, incir',
    compounds: ['4-hydroxy-2,5-dimethyl-3(2h)-furanone', '2,5-dimethyl-4-methoxy-3(2h)-furanone'] },
  { id: 23, slug: 'malt-aldehit', nameTr: 'malt aldehiti', senseTr: 'malt, çikolata, kavrulmuş tahıl',
    compounds: ['isovaleraldehyde', 'isobutyraldehyde', '2-methylbutyraldehyde'] },
  { id: 24, slug: 'et-suyu-furanonu', nameTr: 'et suyu furanonu', senseTr: 'kaynamış et suyu, derinlik',
    compounds: ['5-ethyl-3-hydroxy-4-methyl-2(5h)-furanone', '4-hydroxy-5-methyl-3(2h)-furanone'] },
  { id: 25, slug: 'pirol-tahil', nameTr: 'tahıl pirolü', senseTr: 'sıcak ekmek, tahıl',
    compounds: ['acetylpyrazine', '1-pyrroline', '2-acetylthiazole'] },

  // ── Yeşil / yağ oksidasyonu ───────────────────────────────────────
  { id: 26, slug: 'yesil-heksanal', nameTr: 'yeşil heksanal', senseTr: 'kesilmiş çim, yeşil yaprak',
    compounds: ['hexanal', '3-hexen-1-ol', '2-hexen-1-ol'] },
  { id: 27, slug: 'yagli-aldehit', nameTr: 'yağlı aldehit', senseTr: 'yağ, mum, hafif kızarmış',
    compounds: ['nonanal', 'decanal', 'octanal'] },
  { id: 28, slug: 'mantar-oktenol', nameTr: 'mantar oktenolü', senseTr: 'mantar, orman toprağı',
    compounds: ['1-octen-3-ol', '3-octanone'] },
  { id: 29, slug: 'toprak-geosmin', nameTr: 'toprak geosmini', senseTr: 'yaş toprak, pancar',
    compounds: ['geosmin', '2-methylisoborneol'] },
  { id: 30, slug: 'deniz-aldehiti', nameTr: 'deniz aldehiti', senseTr: 'taze balık, deniz havası',
    compounds: ['2,4-decadienal', '2,6-nonadienal'] },
  { id: 31, slug: 'bromofenol-deniz', nameTr: 'deniz bromofenolü', senseTr: 'yosun, kabuklu deniz ürünü',
    compounds: ['dimethyl_sulfide', 'p-cresol'] },

  // ── Meyve esterleri, laktonlar ────────────────────────────────────
  { id: 32, slug: 'meyveli-ester', nameTr: 'meyveli ester', senseTr: 'olgun meyve, hafif alkol',
    compounds: ['ethyl_acetate', 'ethyl_butyrate', 'hexyl_acetate'] },
  { id: 33, slug: 'muzlu-ester', nameTr: 'muzlu ester', senseTr: 'muz, şeker şekeri',
    compounds: ['isoamyl_acetate', 'butyl_acetate'] },
  { id: 34, slug: 'seftali-laktonu', nameTr: 'şeftali laktonu', senseTr: 'şeftali, kayısı, kremsi meyve',
    compounds: ['g-decalactone', 'g-undecalactone', 'd-decalactone'] },
  { id: 35, slug: 'damaskenon', nameTr: 'damaskenon', senseTr: 'kuru meyve, gül, elma reçeli',
    compounds: ['b-ionone', 'a-ionone', 'dihydro-b-ionone'] },
  { id: 36, slug: 'badem-benzaldehiti', nameTr: 'badem benzaldehiti', senseTr: 'acı badem, kiraz çekirdeği',
    compounds: ['benzaldehyde', 'benzyl_alcohol'] },
  { id: 37, slug: 'uzum-antranilati', nameTr: 'üzüm antranilatı', senseTr: 'üzüm, misket üzümü',
    compounds: ['methyl_anthranilate', 'ethyl_anthranilate'] },
  { id: 38, slug: 'elma-esteri', nameTr: 'elma esteri', senseTr: 'elma, armut kabuğu',
    compounds: ['ethyl_2-methylbutyrate', 'hexyl_hexanoate'] },

  // ── Süt / fermente ────────────────────────────────────────────────
  { id: 39, slug: 'tereyagi-diasetili', nameTr: 'tereyağı diasetili', senseTr: 'tereyağı, krema',
    compounds: ['diacetyl', 'acetoin', '2,3-pentanedione'] },
  { id: 40, slug: 'peynir-butirigi', nameTr: 'peynir bütiriği', senseTr: 'olgun peynir, keskin süt',
    compounds: ['n-butyric_acid', 'hexanoic_acid', 'ethyl_butyrate'] },
  { id: 41, slug: 'yogurt-laktonu', nameTr: 'yoğurt laktik notu', senseTr: 'yoğurt, taze ekşi süt',
    compounds: ['lactic_acid', 'acetaldehyde', 'd-decalactone'] },

  // ── Fenolik / dumanlı / tatlı baharat ─────────────────────────────
  { id: 42, slug: 'dumanli-guaiakol', nameTr: 'dumanlı guaiakol', senseTr: 'is, odun dumanı, tütsü',
    compounds: ['guaiacol', '4-ethylguaiacol'] },
  { id: 43, slug: 'vanilin', nameTr: 'vanilin', senseTr: 'vanilya, tatlı odun',
    compounds: ['vanillin'] },
  { id: 44, slug: 'tarcin-aldehiti', nameTr: 'tarçın aldehiti', senseTr: 'tarçın, sıcak kabuk',
    compounds: ['cinnamaldehyde', 'cinnamyl_acetate'] },
  { id: 45, slug: 'bal-fenilasetaldehiti', nameTr: 'bal fenilasetaldehiti', senseTr: 'bal, çiçek balı',
    compounds: ['phenylacetaldehyde', 'phenylacetic_acid'] },

  // ── Baharata özgü ─────────────────────────────────────────────────
  { id: 46, slug: 'kimyon-aldehiti', nameTr: 'kimyon aldehiti', senseTr: 'kimyon, toprak-baharat',
    compounds: ['cuminaldehyde', 'cuminyl_alcohol'] },
  { id: 47, slug: 'corekotu-timokinonu', nameTr: 'çörekotu timokinonu', senseTr: 'çörekotu, hafif acımsı baharat',
    compounds: ['p-cymene', 'carvacrol'] },
  { id: 48, slug: 'cemen-sotolonu', nameTr: 'çemen sotolonu', senseTr: 'çemen, akçaağaç-köri arası',
    compounds: ['5-ethyl-3-hydroxy-4-methyl-2(5h)-furanone'] },
  { id: 49, slug: 'susam-tiyazolu', nameTr: 'susam tiyazolü', senseTr: 'kavrulmuş susam, tahin',
    compounds: ['2-acetylthiazole', '4-methylthiazole', 'thiazole'] },
  { id: 50, slug: 'zerdecal-turmeronu', nameTr: 'zerdeçal turmeronu', senseTr: 'zerdeçal, toprak-odun',
    compounds: ['ar-turmerone', 'alpha-turmerone'] },
  { id: 51, slug: 'kisnis-aldehiti', nameTr: 'kişniş aldehiti', senseTr: 'kişniş yaprağı, sabunumsu ferahlık',
    compounds: ['decanal', 'lauric_aldehyde', '2-decenal'] },

  // ── Diğer ─────────────────────────────────────────────────────────
  { id: 52, slug: 'kuruyemis-pirazini', nameTr: 'kuruyemiş pirazini', senseTr: 'kavrulmuş fındık, ceviz',
    compounds: ['acetylpyrazine', '2,5-dimethylpyrazine', 'pyrrole'] },
  { id: 53, slug: 'zeytin-fenolu', nameTr: 'zeytin fenolü', senseTr: 'zeytin, acımsı yeşillik',
    compounds: ['2-hexenal', 'phenol', 'hexanoic_acid'] },
  { id: 54, slug: 'sarap-fermente', nameTr: 'şarap fermentasyonu', senseTr: 'şarap, sirke öncesi meyve',
    compounds: ['ethyl_hexanoate', 'acetic_acid', 'diethyl_succinate'] },
];

export const AROMA_CLASS_BY_SLUG = new Map(AROMA_CLASSES.map((c) => [c.slug, c]));
export const AROMA_CLASS_BY_ID = new Map(AROMA_CLASSES.map((c) => [c.id, c]));

/** Slug listesini motorun beklediği id listesine çevirir. Bilinmeyen slug'da patlar. */
export function aromaIds(slugs: string[]): number[] {
  return slugs.map((slug) => {
    const found = AROMA_CLASS_BY_SLUG.get(slug);
    if (!found) throw new Error(`Bilinmeyen aroma ailesi: ${slug}`);
    return found.id;
  });
}
