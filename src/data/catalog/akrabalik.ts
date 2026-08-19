/**
 * Akrabalık grupları — aynı şeyin farklı hâlleri.
 *
 * Sorun şuydu: motor taze nane ile kuru naneyi neredeyse aynı bileşik setiyle
 * görüyor, ikisini de "mükemmel eşleşme" sayıyor ve ete taze nane koyduktan
 * sonra kuru nane öneriyor. Matematik doğru, mutfak saçma.
 *
 * Aynı gruptan ikinci bir malzeme ağır ceza alır ama SERT filtre yoktur:
 * limon + limon kabuğu ya da domates + domates salçası gerçekten birlikte
 * kullanılan çiftler, gerekçesi güçlüyse yine listeye girebilmeli.
 *
 * Katalog dosyalarına dağıtmak yerine burada tek yerde tutuluyor; grup
 * mantığı değişince tek dosyaya bakılıyor.
 */

export const KIN_GROUPS: Record<string, string[]> = {
  // Taze ↔ kuru aynı bitki
  nane: ['nane', 'kuru-nane'],
  kekik: ['taze-kekik', 'kuru-kekik'],
  zencefil: ['zencefil', 'kuru-zencefil'],
  sarimsak: ['sarimsak', 'sarimsak-tozu'],
  kisnis: ['kisnis-tohumu', 'kisnis-yapragi'],
  sogan: ['kuru-sogan', 'taze-sogan'],

  // Kuru kırmızı biber çeşitleri — üçü de aynı işi yapıyor
  'kuru-kirmizi-biber': ['pul-biber', 'isot', 'toz-kirmizi-biber'],

  // Meyve ↔ kurusu ↔ türevi
  uzum: ['uzum', 'kuru-uzum', 'uzum-sirkesi', 'koruk-suyu', 'asma-yapragi'],
  kayisi: ['kayisi', 'kuru-kayisi'],
  incir: ['incir', 'kuru-incir'],
  erik: ['erik', 'kuru-erik'],
  dut: ['dut', 'dut-pekmezi'],
  nar: ['nar', 'nar-eksisi'],
  limon: ['limon', 'limon-kabugu'],
  domates: ['domates', 'domates-salcasi', 'kuru-domates'],
  zeytin: ['siyah-zeytin', 'yesil-zeytin'],

  // Aynı çekirdek/yağı
  susam: ['susam', 'susam-yagi', 'tahin'],
  findik: ['findik', 'findik-yagi'],
  aycicek: ['aycicek-yagi', 'ay-cekirdegi'],

  // Süt ürünü aileleri
  yogurt: ['yogurt', 'suzme-yogurt', 'ayran', 'labne'],
  krema: ['krema', 'kaymak'],
  lor: ['lor', 'cokelek'],

  // Tahıl / bakliyat formları
  bulgur: ['bulgur', 'ince-bulgur'],
  mercimek: ['kirmizi-mercimek', 'yesil-mercimek'],
  un: ['un', 'irmik'],
  makarna: ['makarna', 'arpa-sehriye', 'eriste'],

  // Un ve unlu mamul: hepsi aynı buğday zeminini paylaşıyor. "Ekmekle yufka
  // ortak aroma bileşiği paylaşıyor" cümlesi doğru ama boş bir cümle.
  'unlu-mamul': ['un', 'ekmek', 'yufka', 'tost-ekmegi', 'galeta-unu', 'milfoy', 'irmik'],

  // Diğer
  sirke: ['uzum-sirkesi', 'elma-sirkesi'],
  sarap: ['kirmizi-sarap', 'beyaz-sarap'],
  pekmez: ['uzum-pekmezi', 'keciboynuzu-pekmezi'],
  hardal: ['hardal', 'hardal-tohumu'],
  anason: ['anason', 'raki', 'rezene-tohumu'],
};

/** slug → grup adı. Bir malzeme birden fazla grupta geçerse ilki kazanır. */
export const KIN_OF = (() => {
  const map = new Map<string, string>();
  for (const [group, slugs] of Object.entries(KIN_GROUPS)) {
    for (const slug of slugs) if (!map.has(slug)) map.set(slug, group);
  }
  return map;
})();
