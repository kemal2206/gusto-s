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

/**
 * Kategoriye göre bir porsiyonun tipik ham gramajı.
 *
 * Sayılar uydurma değil: korpusun kendi dağılımından, kategori başına medyan
 * "toplam gramaj / porsiyon" olarak çıkarıldı. Yani tariflerin çoğunluğunun
 * zaten söylediği şey.
 */
export const PORTION_G: Record<string, number> = {
  corba: 350,
  'kebap-izgara': 280,
  'etli-sulu': 260,
  zeytinyagli: 290,
  'dolma-sarma': 350,
  'pilav-makarna': 260,
  'hamur-isi': 240,
  deniz: 260,
  kahvalti: 160,
  'meze-salata': 200,
  'sos-marine': 200,
  tatli: 240,
  icecek: 280,
};
const PORTION_DEFAULT = 260;

/** Porsiyon sayısı bu değerin üstüne çıkamıyor — tepsi tatlısı bile. */
const MAX_SERVINGS = 24;

/**
 * Bildirilen porsiyon sayısı gramajla tutuyor mu?
 *
 * Korpusun en büyük besin hatası buradan geliyordu. Kaynak porsiyon alanını
 * çoğu zaman boş bırakıyor ya da "12 adet" gibi bir ÜRÜN sayısı yazıyor;
 * ikisinde de içe aktarıcı varsayılan 4'e düşüyor. Tepsi tatlılarında sonuç
 * saçma oluyordu:
 *
 *   Aşure Tatlısı        11.107 g  ÷ 4 =  2.777 g porsiyon → 4.236 kcal
 *   Bisküvili Etimek      5.413 g  ÷ 4 =  1.353 g porsiyon → 2.940 kcal
 *
 * Kimse bir öğünde 2,8 kilo aşure yemiyor. Kural tek yönlü ve temkinli:
 * porsiyon gramajı kategorinin tipik değerinin **2,5 katını** aşıyorsa
 * porsiyon sayısı gramajdan yeniden hesaplanıyor. Yalnızca ARTIRIYOR —
 * azaltmak kaloriyi şişirir ve o yönde yanılmak daha kötü.
 *
 * Eşik geniş bilerek: 2,5 kat, "biraz cömert porsiyon" ile "bu bir tepsi"
 * arasındaki farkı ayırıyor ve normal tariflerin hiçbirine dokunmuyor.
 */
export function sanePortions(
  categoryId: string,
  totalGrams: number,
  declared: number,
): number {
  const srv = Math.max(1, declared);
  if (totalGrams <= 0) return srv;

  const typical = PORTION_G[categoryId] ?? PORTION_DEFAULT;
  const perPortion = totalGrams / srv;
  if (perPortion <= typical * 2.5) return srv;

  return Math.min(MAX_SERVINGS, Math.max(srv, Math.round(totalGrams / typical)));
}
