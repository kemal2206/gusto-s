/**
 * Mutfak ölçüsü → gram.
 *
 * İki yerde birden gerekiyor ve ikisinin aynı sayıları kullanması şart,
 * yoksa aynı tarif içe aktarıldığında bir, kullanıcı elle yazdığında başka
 * bir gramaj çıkıyor:
 *
 *  - `scripts/pipeline/05-tarif-ithal.ts` — korpusu içe aktarırken
 *  - Kullanıcının kendi tarifini yazarken ("2 su bardağı un")
 *
 * **Hacim ölçüleri malzemeye göre değişiyor.** Aşağıdaki sayılar ml cinsinden;
 * grama çevirirken `ev-olcusu.ts`'teki yoğunlukla çarpılıyorlar. Tek bir
 * "su bardağı = 200 g" sayısı kullanmak unu (110 g) iki katına çıkarıyordu.
 */

import { densityOf, PIECE_G } from './ev-olcusu';

/** Hacim ölçüleri — ml. Grama çevirmek için yoğunluk gerekiyor. */
export const UNIT_ML: Record<string, number> = {
  ml: 1, litre: 1000, lt: 1000, cl: 10, mililitre: 1, santilitre: 10,
  'su bardağı': 200, 'çay bardağı': 100, 'kahve fincanı': 60, bardak: 200,
  'yemek kaşığı': 15, 'tatlı kaşığı': 7, 'çay kaşığı': 5, kaşık: 15,
  // "çorba kaşığı" yemek kaşığının başka adı — yemek.com korpusunda geçiyor.
  'çorba kaşığı': 15,
  // yemek.com korpusunda geçen, tabloda olmayan hacimler.
  kase: 300,
};

/** Doğrudan gram olan ölçüler — yoğunluktan bağımsız. */
export const UNIT_G: Record<string, number> = {
  gr: 1, gram: 1, g: 1, kilo: 1000, kg: 1000,
  tutam: 0.5, pençik: 1.5, diş: 4, demet: 60, dilim: 25, damla: 0.05, sap: 10,
  paket: 10, avuç: 30, fiske: 0.5,
  /**
   * yemek.com korpusunda geçenler. `dal` maydanoz/nane sapı, `baş` bütün
   * sarımsak, `yaprak` defne yaprağı — üçü de küçük ve `adet` varsayımına
   * düşerse (sebze için 120 g) tarifi zehirliyorlar: "2 dal maydanoz"
   * 240 g maydanoz oluyordu.
   */
  dal: 10, çimdik: 0.5, yaprak: 2, baş: 40, kutu: 400,
};

export const CAT_PIECE_G: Record<string, number> = {
  sebze: 120, meyve: 140, protein: 180, deniz: 200, sut: 100, tahil: 100,
  baharat: 3, ot: 20, kuruyemis: 15, baklagil: 100, yag: 15, asit: 40,
  tatlandirici: 20, mantar: 60, sarkuteri: 60, icecek: 100, diger: 50,
};

/** Ölçü birimlerinin uzundan kısaya listesi — metin ayrıştırmada sıra önemli. */
export const UNIT_NAMES = [...Object.keys(UNIT_ML), ...Object.keys(UNIT_G)].sort(
  (a, b) => b.length - a.length,
);

/**
 * Miktarı grama çevir.
 *
 * Hacim ölçüsüyse malzemenin yoğunluğuyla çarpılıyor: bir su bardağı su 200 g
 * ama un 110 g, bal 285 g. Birim tanınmıyorsa "adet" varsayılıyor — korpusta
 * da kullanıcı girdisinde de en sık atlanan birim bu ("2 soğan").
 */
export function gramsFor(
  amount: number | null,
  unit: string | null,
  slug: string,
  category: string | undefined,
): number {
  /**
   * Miktar sayı olmayabiliyor: korpusta "yarım", "bir tutam" gibi metinler
   * ve boş alanlar var. `?? 1` bunları yakalamıyordu ve `NaN` gramajlar
   * üretiliyordu — 39 tarif sessizce bozulmuştu.
   */
  const n = Number(amount);
  const q = Number.isFinite(n) && n > 0 ? n : 1;
  const u = (unit ?? '').trim().toLocaleLowerCase('tr-TR');

  if (u in UNIT_ML) {
    return Math.max(1, Math.round(q * UNIT_ML[u] * densityOf(slug, category ?? 'diger')));
  }
  if (u in UNIT_G) return Math.max(1, Math.round(q * UNIT_G[u]));

  const per = PIECE_G[slug] ?? CAT_PIECE_G[category ?? 'diger'] ?? 50;
  return Math.max(1, Math.round(q * per));
}
