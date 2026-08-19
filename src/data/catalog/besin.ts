/**
 * Kaba besin değeri modeli — 100 gram başına.
 *
 * Tarif sayfasındaki kalori/protein alanları sabit sayı gösteriyordu (560 Cal,
 * 36 g). Sabit sayı yanlış bilgi demek; hesaplanmış tahmin ise en azından
 * malzemeye göre değişiyor ve tutarlı.
 *
 * Kaynak: USDA FoodData Central ve TÜBİTAK ulusal besin veritabanındaki tipik
 * değerlerin yuvarlanmış hâli. **Tahmindir**: pişirme kaybı, yağ emilimi ve
 * çeşit farkı hesaba katılmıyor. Arayüzde bu yüzden "tahmini" yazıyor.
 *
 * Katalogda 248 malzeme var; hepsine tek tek değer yazmak yerine en çok
 * kullanılan ~90'ına gerçek değer, kalanına kategori ortalaması veriliyor.
 */

import type { IngredientCategory } from '@/engine';

export interface Macros {
  /** kcal / 100 g */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Kategori ortalaması — açık değeri olmayan malzemeler buraya düşüyor. */
export const CATEGORY_MACROS: Record<IngredientCategory, Macros> = {
  protein: { kcal: 200, protein: 20, carbs: 0, fat: 13 },
  deniz: { kcal: 130, protein: 20, carbs: 0, fat: 5 },
  sarkuteri: { kcal: 330, protein: 22, carbs: 2, fat: 26 },
  sut: { kcal: 150, protein: 8, carbs: 5, fat: 11 },
  sebze: { kcal: 35, protein: 1.5, carbs: 6, fat: 0.3 },
  mantar: { kcal: 25, protein: 3, carbs: 3, fat: 0.3 },
  ot: { kcal: 40, protein: 3, carbs: 6, fat: 0.8 },
  baharat: { kcal: 280, protein: 11, carbs: 45, fat: 8 },
  meyve: { kcal: 60, protein: 0.8, carbs: 14, fat: 0.3 },
  kuruyemis: { kcal: 600, protein: 18, carbs: 18, fat: 52 },
  tahil: { kcal: 350, protein: 10, carbs: 70, fat: 2 },
  baklagil: { kcal: 340, protein: 22, carbs: 55, fat: 2 },
  yag: { kcal: 850, protein: 0, carbs: 0, fat: 95 },
  asit: { kcal: 30, protein: 0.5, carbs: 6, fat: 0 },
  tatlandirici: { kcal: 330, protein: 1, carbs: 78, fat: 2 },
  icecek: { kcal: 70, protein: 0.2, carbs: 3, fat: 0 },
  diger: { kcal: 50, protein: 2, carbs: 8, fat: 1 },
};

/** En çok kullanılan malzemeler için gerçek değerler. */
export const INGREDIENT_MACROS: Record<string, Macros> = {
  // Et ve kümes
  'kuzu-but': { kcal: 230, protein: 25, carbs: 0, fat: 14 },
  'kuzu-pirzola': { kcal: 280, protein: 24, carbs: 0, fat: 20 },
  'kuzu-incik': { kcal: 240, protein: 26, carbs: 0, fat: 15 },
  'kuzu-kiyma': { kcal: 280, protein: 20, carbs: 0, fat: 22 },
  'dana-antrikot': { kcal: 270, protein: 24, carbs: 0, fat: 19 },
  'dana-kusbasi': { kcal: 190, protein: 26, carbs: 0, fat: 9 },
  'dana-kiyma': { kcal: 250, protein: 21, carbs: 0, fat: 18 },
  'dana-kaburga': { kcal: 340, protein: 20, carbs: 0, fat: 29 },
  'kuzu-cigeri': { kcal: 140, protein: 20, carbs: 2, fat: 5 },
  'tavuk-gogsu': { kcal: 120, protein: 23, carbs: 0, fat: 3 },
  'tavuk-but': { kcal: 180, protein: 19, carbs: 0, fat: 11 },
  hindi: { kcal: 150, protein: 22, carbs: 0, fat: 7 },
  yumurta: { kcal: 145, protein: 13, carbs: 1, fat: 10 },
  pastirma: { kcal: 240, protein: 33, carbs: 3, fat: 11 },
  sucuk: { kcal: 400, protein: 20, carbs: 2, fat: 35 },
  kavurma: { kcal: 350, protein: 24, carbs: 0, fat: 28 },

  // Deniz
  hamsi: { kcal: 130, protein: 20, carbs: 0, fat: 5 },
  levrek: { kcal: 100, protein: 20, carbs: 0, fat: 2 },
  cipura: { kcal: 115, protein: 20, carbs: 0, fat: 4 },
  somon: { kcal: 205, protein: 20, carbs: 0, fat: 13 },
  uskumru: { kcal: 205, protein: 19, carbs: 0, fat: 14 },
  karides: { kcal: 85, protein: 20, carbs: 0, fat: 1 },
  midye: { kcal: 85, protein: 12, carbs: 4, fat: 2 },
  kalamar: { kcal: 90, protein: 16, carbs: 3, fat: 1 },

  // Süt
  sut: { kcal: 62, protein: 3.3, carbs: 4.8, fat: 3.3 },
  yogurt: { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.2 },
  'suzme-yogurt': { kcal: 95, protein: 6, carbs: 4, fat: 6 },
  ayran: { kcal: 37, protein: 2, carbs: 3, fat: 2 },
  krema: { kcal: 290, protein: 2, carbs: 3, fat: 30 },
  kaymak: { kcal: 400, protein: 3, carbs: 3, fat: 42 },
  tereyagi: { kcal: 740, protein: 0.8, carbs: 0.6, fat: 82 },
  'beyaz-peynir': { kcal: 265, protein: 17, carbs: 2, fat: 21 },
  kasar: { kcal: 350, protein: 25, carbs: 2, fat: 27 },
  'tulum-peyniri': { kcal: 380, protein: 24, carbs: 1, fat: 31 },
  lor: { kcal: 95, protein: 12, carbs: 3, fat: 4 },
  cokelek: { kcal: 130, protein: 18, carbs: 3, fat: 5 },
  'keci-peyniri': { kcal: 360, protein: 22, carbs: 2, fat: 30 },
  labne: { kcal: 170, protein: 7, carbs: 4, fat: 14 },
  'krem-santi': { kcal: 260, protein: 2, carbs: 20, fat: 20 },

  // Sebze
  patlican: { kcal: 25, protein: 1, carbs: 6, fat: 0.2 },
  kabak: { kcal: 17, protein: 1.2, carbs: 3, fat: 0.3 },
  domates: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  'domates-salcasi': { kcal: 82, protein: 4, carbs: 19, fat: 0.5 },
  'biber-salcasi': { kcal: 90, protein: 3, carbs: 18, fat: 1 },
  'kuru-sogan': { kcal: 40, protein: 1.1, carbs: 9, fat: 0.1 },
  'taze-sogan': { kcal: 32, protein: 1.8, carbs: 7, fat: 0.2 },
  sarimsak: { kcal: 149, protein: 6, carbs: 33, fat: 0.5 },
  patates: { kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  havuc: { kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  ispanak: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  'kirmizi-biber': { kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  'yesil-biber': { kcal: 20, protein: 0.9, carbs: 4.6, fat: 0.2 },
  'carliston-biber': { kcal: 22, protein: 1, carbs: 5, fat: 0.2 },
  salatalik: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  prasa: { kcal: 61, protein: 1.5, carbs: 14, fat: 0.3 },
  lahana: { kcal: 25, protein: 1.3, carbs: 6, fat: 0.1 },
  karnabahar: { kcal: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  brokoli: { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  'taze-fasulye': { kcal: 31, protein: 1.8, carbs: 7, fat: 0.1 },
  bezelye: { kcal: 81, protein: 5, carbs: 14, fat: 0.4 },
  bamya: { kcal: 33, protein: 1.9, carbs: 7, fat: 0.2 },
  mantar: { kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  'siyah-zeytin': { kcal: 115, protein: 0.8, carbs: 6, fat: 11 },
  'yesil-zeytin': { kcal: 145, protein: 1, carbs: 4, fat: 15 },
  'misir-konserve': { kcal: 86, protein: 3, carbs: 19, fat: 1 },
  marul: { kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },

  // Tahıl ve hamur
  un: { kcal: 364, protein: 10, carbs: 76, fat: 1 },
  pirinc: { kcal: 360, protein: 7, carbs: 79, fat: 0.6 },
  bulgur: { kcal: 342, protein: 12, carbs: 76, fat: 1.3 },
  'ince-bulgur': { kcal: 342, protein: 12, carbs: 76, fat: 1.3 },
  makarna: { kcal: 371, protein: 13, carbs: 75, fat: 1.5 },
  sehriye: { kcal: 360, protein: 12, carbs: 73, fat: 1.5 },
  irmik: { kcal: 360, protein: 12, carbs: 73, fat: 1 },
  ekmek: { kcal: 265, protein: 9, carbs: 49, fat: 3 },
  'tost-ekmegi': { kcal: 270, protein: 9, carbs: 50, fat: 3 },
  yufka: { kcal: 300, protein: 9, carbs: 60, fat: 2 },
  kadayif: { kcal: 340, protein: 8, carbs: 70, fat: 2 },
  'galeta-unu': { kcal: 380, protein: 13, carbs: 72, fat: 5 },
  nisasta: { kcal: 380, protein: 0.3, carbs: 91, fat: 0.1 },
  biskuvi: { kcal: 460, protein: 7, carbs: 70, fat: 17 },
  milfoy: { kcal: 400, protein: 6, carbs: 38, fat: 26 },
  tarhana: { kcal: 330, protein: 14, carbs: 60, fat: 4 },

  // Bakliyat
  'kirmizi-mercimek': { kcal: 350, protein: 25, carbs: 60, fat: 1.2 },
  'yesil-mercimek': { kcal: 345, protein: 25, carbs: 60, fat: 1.1 },
  nohut: { kcal: 365, protein: 19, carbs: 61, fat: 6 },
  'kuru-fasulye': { kcal: 335, protein: 22, carbs: 60, fat: 1.5 },
  barbunya: { kcal: 335, protein: 22, carbs: 60, fat: 1.5 },

  // Yağ ve tatlandırıcı
  zeytinyagi: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  'sivi-yag': { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  'aycicek-yagi': { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  margarin: { kcal: 720, protein: 0.2, carbs: 0.7, fat: 80 },
  mayonez: { kcal: 680, protein: 1, carbs: 2, fat: 75 },
  seker: { kcal: 400, protein: 0, carbs: 100, fat: 0 },
  'pudra-sekeri': { kcal: 400, protein: 0, carbs: 100, fat: 0 },
  bal: { kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  'uzum-pekmezi': { kcal: 293, protein: 1, carbs: 72, fat: 0 },
  tahin: { kcal: 595, protein: 17, carbs: 21, fat: 53 },
  kakao: { kcal: 230, protein: 20, carbs: 58, fat: 14 },
  'bitter-cikolata': { kcal: 550, protein: 6, carbs: 46, fat: 38 },
  ketcap: { kcal: 100, protein: 1, carbs: 25, fat: 0 },

  // Kuruyemiş ve meyve
  ceviz: { kcal: 654, protein: 15, carbs: 14, fat: 65 },
  findik: { kcal: 628, protein: 15, carbs: 17, fat: 61 },
  badem: { kcal: 579, protein: 21, carbs: 22, fat: 50 },
  'antep-fistigi': { kcal: 560, protein: 20, carbs: 28, fat: 45 },
  'cam-fistigi': { kcal: 673, protein: 14, carbs: 13, fat: 68 },
  'hindistan-cevizi': { kcal: 354, protein: 3, carbs: 15, fat: 33 },
  'yer-fistigi': { kcal: 567, protein: 26, carbs: 16, fat: 49 },
  'kuru-uzum': { kcal: 299, protein: 3, carbs: 79, fat: 0.5 },
  'kuru-kayisi': { kcal: 241, protein: 3.4, carbs: 63, fat: 0.5 },
  elma: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  muz: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  limon: { kcal: 29, protein: 1.1, carbs: 9, fat: 0.3 },
  nar: { kcal: 83, protein: 1.7, carbs: 19, fat: 1.2 },
  visne: { kcal: 50, protein: 1, carbs: 12, fat: 0.3 },

  // Sıfır / ihmal edilebilir
  su: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  tuz: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  'maden-suyu': { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  soda: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  'kabartma-tozu': { kcal: 53, protein: 0, carbs: 28, fat: 0 },
  karbonat: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  maya: { kcal: 325, protein: 40, carbs: 38, fat: 8 },
};

export function macrosFor(slug: string, category: IngredientCategory): Macros {
  return INGREDIENT_MACROS[slug] ?? CATEGORY_MACROS[category] ?? CATEGORY_MACROS.diger;
}
