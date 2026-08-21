/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. `npm run data:besin -- --write` ile yenile.
 *
 * Kaynak: yemek.com Firebase dökümündeki malzeme besin tablosu
 * (`data-raw/yemekcom-tarif-besin.json`, 866 satır).
 *
 * 56 malzemenin 100 gram başına değeri. `besin.ts`'te elle yazılmış olanlar
 * buraya alınmadı — orası yetkili katman, burası onun altındaki ikinci katman.
 * Her satır katı ad eşleştirmesinden, Atwater tutarlılığından ve aralık
 * denetiminden geçti.
 *
 * **Tahmindir.** Pişirme kaybı, yağ emilimi ve çeşit farkı bu tabloda yok;
 * onları `pisirme-donusum.ts` hesaplıyor.
 */

import type { Macros } from './besin';

export const ITHAL_MACROS: Record<string, Macros> = {
  alabalik: { kcal: 191, protein: 26.9, carbs: 0, fat: 8.5 },  // alabalık
  ayva: { kcal: 58, protein: 0.4, carbs: 15, fat: 0.1 },  // ayva
  biberiye: { kcal: 336, protein: 5, carbs: 64.1, fat: 14.8 },  // biberiye
  'brokoli-bruksel': { kcal: 37, protein: 2.6, carbs: 7.1, fat: 0.5 },  // brüksel lahanası
  cilek: { kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },  // çilek
  dereotu: { kcal: 44, protein: 3, carbs: 7.1, fat: 1 },  // 2 kayıt: dereotu
  'elma-sirkesi': { kcal: 21, protein: 0, carbs: 0.9, fat: 0 },  // elma sirkesi
  enginar: { kcal: 54, protein: 2.9, carbs: 11.7, fat: 0.3 },  // 2 kayıt: enginar
  eriste: { kcal: 162, protein: 5.8, carbs: 30.3, fat: 0.9 },  // 2 kayıt: erişte
  feslegen: { kcal: 24, protein: 4, carbs: 2, fat: 0 },  // fesleğen
  hardal: { kcal: 58, protein: 3.8, carbs: 5.7, fat: 3.4 },  // hardal
  'hindistan-cevizi-sutu': { kcal: 197, protein: 2, carbs: 2.8, fat: 21.2 },  // hindistan cevizi sütü
  hurma: { kcal: 288, protein: 2.4, carbs: 75.4, fat: 0.4 },  // hurma
  kahve: { kcal: 1, protein: 0.1, carbs: 0, fat: 0 },  // türk kahvesi
  kakule: { kcal: 315, protein: 10.9, carbs: 68.3, fat: 6.4 },  // kakule
  karabiber: { kcal: 245, protein: 10.5, carbs: 64.1, fat: 3 },  // 2 kayıt: karabiber
  karanfil: { kcal: 277, protein: 6.1, carbs: 65.1, fat: 12.8 },  // karanfil
  kavun: { kcal: 34, protein: 0.8, carbs: 8.3, fat: 0.2 },  // kavun
  kayisi: { kcal: 48, protein: 1.4, carbs: 11.1, fat: 0.4 },  // kayısı
  kereviz: { kcal: 18, protein: 0.8, carbs: 4, fat: 0.2 },  // kereviz
  kimyon: { kcal: 379, protein: 17.8, carbs: 44.5, fat: 22.4 },  // 2 kayıt: kimyon
  kiraz: { kcal: 64, protein: 1.1, carbs: 15.9, fat: 0.2 },  // kiraz
  'kisnis-tohumu': { kcal: 301, protein: 12.3, carbs: 55.8, fat: 17.7 },  // kişniş tohumu
  kori: { kcal: 101, protein: 12.1, carbs: 3.2, fat: 4.7 },  // köri
  'kuru-domates': { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },  // kuru domates
  'kuru-incir': { kcal: 76, protein: 0.8, carbs: 19.4, fat: 0.3 },  // kuru incir
  'kuru-kekik': { kcal: 103, protein: 5, carbs: 25.1, fat: 1.2 },  // kuru kekik
  'kuru-nane': { kcal: 405, protein: 0, carbs: 98.6, fat: 0 },  // kuru nane
  'kuru-uzum-kus': { kcal: 290, protein: 4.1, carbs: 72.8, fat: 0.3 },  // 2 kayıt: kuş üzümü
  kuskus: { kcal: 114, protein: 3.8, carbs: 23.4, fat: 0.2 },  // kuskus
  'kuyruk-yagi': { kcal: 926, protein: 0, carbs: 0, fat: 100 },  // kuyruk yağı
  'limon-kabugu': { kcal: 47, protein: 1.5, carbs: 15.8, fat: 0.3 },  // limon kabuğu rendesi
  mandalina: { kcal: 47, protein: 0.9, carbs: 11.9, fat: 0.2 },  // mandalina
  maydanoz: { kcal: 36, protein: 2.9, carbs: 6.2, fat: 0.8 },  // 2 kayıt: maydanoz
  nane: { kcal: 44, protein: 3.4, carbs: 8.3, fat: 0.7 },  // taze nane
  palamut: { kcal: 289, protein: 62.3, carbs: 0, fat: 2.2 },  // palamut
  pazi: { kcal: 19, protein: 1.9, carbs: 4, fat: 0.1 },  // pazı
  'pirinc-sirkesi': { kcal: 18, protein: 0, carbs: 0.1, fat: 0 },  // pirinç sirkesi
  'pirinc-unu': { kcal: 363, protein: 6, carbs: 80.9, fat: 1.4 },  // pirinç unu
  portakal: { kcal: 50, protein: 0.9, carbs: 12.4, fat: 0.1 },  // portakal
  'pul-biber': { kcal: 39, protein: 1.9, carbs: 8.8, fat: 0.4 },  // 2 kayıt: pul biber
  'rezene-tohumu': { kcal: 336, protein: 16.1, carbs: 53, fat: 14.9 },  // rezene tohumu
  safran: { kcal: 302, protein: 11.5, carbs: 65.5, fat: 5.8 },  // 2 kayıt: safran
  'sarimsak-tozu': { kcal: 332, protein: 16.5, carbs: 72.1, fat: 0.6 },  // sarımsak tozu
  seftali: { kcal: 40, protein: 0.9, carbs: 9.7, fat: 0.3 },  // şeftali
  semizotu: { kcal: 19, protein: 1.5, carbs: 3.5, fat: 0.2 },  // semizotu
  sumak: { kcal: 277, protein: 13.3, carbs: 49.2, fat: 14.5 },  // sumak
  'susam-yagi': { kcal: 859, protein: 0, carbs: 0, fat: 100 },  // susam yağı
  tarcin: { kcal: 247, protein: 3.9, carbs: 80.4, fat: 1.1 },  // 2 kayıt: tarçın
  'tavuk-suyu': { kcal: 6, protein: 0.6, carbs: 0.4, fat: 0.2 },  // tavuk suyu
  'taze-kekik': { kcal: 103, protein: 5, carbs: 25.1, fat: 1.2 },  // 2 kayıt: taze kekik
  'toz-kirmizi-biber': { kcal: 28, protein: 0.9, carbs: 6.8, fat: 0.2 },  // toz kırmızı biber
  'yaban-mersini': { kcal: 56, protein: 0.7, carbs: 14.8, fat: 0 },  // yaban mersini
  yenibahar: { kcal: 268, protein: 6.4, carbs: 72.3, fat: 8.9 },  // 2 kayıt: yenibahar
  zencefil: { kcal: 80, protein: 2, carbs: 17.9, fat: 1 },  // taze zencefil
  zerdecal: { kcal: 309, protein: 9.6, carbs: 68, fat: 3.4 },  // 2 kayıt: zerdeçal
};
