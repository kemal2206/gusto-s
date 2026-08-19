/**
 * Göreli malzeme maliyeti.
 *
 * **Bu bir fiyat tablosu değil.** Elimizde para birimi cinsinden veri yok ve
 * uydurmak yanlış olur: fiyatlar şehirden şehre, mevsimden mevsime değişiyor
 * ve altı ay sonra hepsi eskimiş olur. Bunun yerine malzemeleri birbirine
 * göre sıralayan **birimsiz bir katsayı** kullanıyoruz: 100 gram mercimek 1
 * ise, 100 gram kuzu eti 9.
 *
 * Buradan çıkan sayı "porsiyonu 40 lira" demiyor; "bu tarif şu tariften ucuz"
 * diyor. Uygulamada da böyle sunuluyor — rakam değil, üç kademe.
 *
 * Oranlar Türkiye'de market rafının kabaca değişmeyen yapısından: bakliyat ve
 * tahıl en ucuz, mevsim sebzesi ucuz, tavuk ortada, kırmızı et ve deniz
 * ürünü pahalı, kuruyemiş ve safran en tepede.
 */

/** 100 gram başına göreli katsayı. Mercimek = 1 kabul edildi. */
const COST_BY_CATEGORY: Record<string, number> = {
  baklagil: 1,
  tahil: 1.2,
  sebze: 1.8,
  diger: 1,
  ot: 3,
  meyve: 3,
  sut: 3.5,
  tatlandirici: 3,
  yag: 3.5,
  asit: 3,
  icecek: 3,
  mantar: 4,
  protein: 7,
  sarkuteri: 9,
  deniz: 9,
  kuruyemis: 10,
  // Baharat kilosu pahalı ama tarife giren miktar gram düzeyinde;
  // katsayı yüksek, çarpıldığı gram küçük olduğu için toplamı bozmuyor.
  baharat: 6,
};

/** Kategorisinin ortalamasından belirgin biçimde ayrılan malzemeler. */
const COST_BY_SLUG: Record<string, number> = {
  // En ucuzlar
  su: 0, tuz: 0.3, un: 0.8, bulgur: 0.9, 'ince-bulgur': 0.9, pirinc: 1.6,
  makarna: 1, sehriye: 1.2, 'arpa-sehriye': 1.2, irmik: 1.2, nisasta: 1.5,
  patates: 1, 'kuru-sogan': 1, havuc: 1.2, lahana: 1, kabak: 1.5,
  seker: 1, 'pudra-sekeri': 1.5, ekmek: 1.5, maya: 2, karbonat: 1,
  'kabartma-tozu': 2, 'domates-salcasi': 2.5, 'biber-salcasi': 2.5,

  // Ortalar
  yumurta: 4, yogurt: 2.5, sut: 2.5, ayran: 2, tavuk: 6,
  'tavuk-but': 5.5, 'tavuk-gogsu': 7, patlican: 2, domates: 2,
  zeytinyagi: 8, 'aycicek-yagi': 4, 'sivi-yag': 4, tereyagi: 9,
  'beyaz-peynir': 7, kasar: 10, lor: 4, cokelek: 4,

  // Pahalılar
  'kuzu-but': 14, 'kuzu-pirzola': 16, 'kuzu-incik': 12, 'kuzu-kiyma': 13,
  'dana-antrikot': 16, 'dana-kusbasi': 13, 'dana-kiyma': 12, 'dana-kaburga': 11,
  pastirma: 20, sucuk: 10, kavurma: 14,
  karides: 14, somon: 16, levrek: 11, cipura: 10, lakerda: 14,
  'antep-fistigi': 22, ceviz: 14, badem: 14, findik: 12, 'cam-fistigi': 30,
  safran: 200, vanilya: 30, kakule: 25, 'bitter-cikolata': 12,
  'kars-gravyeri': 18, 'keci-peyniri': 14, kaymak: 12, krema: 6,
};

export function costPer100g(slug: string, category: string): number {
  return COST_BY_SLUG[slug] ?? COST_BY_CATEGORY[category] ?? 3;
}
