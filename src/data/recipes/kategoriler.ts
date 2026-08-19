/**
 * Yemek kategorileri.
 *
 * Ana sayfadaki "Nereden başlayalım" ızgarası bunları gösteriyor ve her biri
 * o kategorideki tarif listesine gidiyor. Kategoriler mutfağa göre değil
 * **yemek tipine** göre: Türk mutfağı da uzak doğu da aynı kutucuklara düşüyor,
 * mutfak ayrı bir filtre. Böylece "çorbalar"a bakan biri hem mercimek
 * çorbasını hem miso çorbasını görüyor.
 *
 * `sos-marine` kategorisi özel: içindeki tarifler tek başına yemek değil,
 * düz bir ana malzemenin üzerine giden bileşenler. "Düz antrikot pişirip
 * üzerine sos yapmak istiyorum" durumunun karşılığı bu.
 */

export interface DishCategory {
  id: string;
  labelTr: string;
  emoji: string;
  /** Izgarada altta görünen tek satır. */
  hintTr: string;
}

export const DISH_CATEGORIES: DishCategory[] = [
  { id: 'corba', labelTr: 'Çorbalar', emoji: '🥣', hintTr: 'Mercimek, tarhana, miso' },
  { id: 'kebap-izgara', labelTr: 'Kebap ve ızgara', emoji: '🔥', hintTr: 'Adana, köfte, yakitori' },
  { id: 'etli-sulu', labelTr: 'Etli sulu yemekler', emoji: '🍲', hintTr: 'Güveç, tas kebabı, curry' },
  { id: 'zeytinyagli', labelTr: 'Zeytinyağlılar', emoji: '🫒', hintTr: 'Enginar, taze fasulye, imambayıldı' },
  { id: 'dolma-sarma', labelTr: 'Dolma ve sarma', emoji: '🍃', hintTr: 'Yaprak sarma, biber dolması' },
  { id: 'pilav-makarna', labelTr: 'Pilav ve makarna', emoji: '🍚', hintTr: 'İç pilav, mantı, ramen' },
  { id: 'hamur-isi', labelTr: 'Hamur işi', emoji: '🥟', hintTr: 'Börek, pide, gözleme' },
  { id: 'deniz', labelTr: 'Deniz ürünleri', emoji: '🐟', hintTr: 'Hamsi, levrek, midye' },
  { id: 'kahvalti', labelTr: 'Kahvaltı', emoji: '🍳', hintTr: 'Menemen, sucuklu yumurta' },
  { id: 'meze-salata', labelTr: 'Meze ve salata', emoji: '🥗', hintTr: 'Haydari, piyaz, cacık' },
  { id: 'sos-marine', labelTr: 'Sos ve marine', emoji: '🥄', hintTr: 'Düz etin üzerine giden' },
  { id: 'tatli', labelTr: 'Tatlılar', emoji: '🍮', hintTr: 'Sütlaç, revani, künefe' },
  { id: 'icecek', labelTr: 'İçecekler', emoji: '🥤', hintTr: 'Ayran, şerbet, limonata' },
];

export const CATEGORY_BY_ID = new Map(DISH_CATEGORIES.map((c) => [c.id, c]));
