/**
 * Tarif görselleri — pakete gömülü.
 *
 * `Recipe.imageUrl` uzak bir adres tutuyor ve yalnızca yemek.com korpusunda
 * dolu. Kendi ürettiğimiz görseller ise uygulamanın içinde duruyor; React
 * Native'de gömülü dosya `require()` ile bağlanmak zorunda, `{ uri }` ile
 * çalışmıyor. Bu yüzden ayrı bir sözlük.
 *
 * ── Sıra ───────────────────────────────────────────────────────────
 *
 *   1. YEREL_GORSEL   kendi ürettiğimiz kare — en güvenilir, tarife ait
 *   2. Recipe.imageUrl  yemek.com'un fotoğrafı (uzak, hotlink)
 *   3. yer tutucu      konusu yemek olan rastgele bir fotoğraf
 *
 * Üçüncü basamak hâlâ yerinde ve hâlâ yanlış: gösterdiği fotoğrafın tarifle
 * ilgisi yok. Sözlük doldukça o basamak kendiliğinden boşalıyor.
 *
 * ── Neden elle yazılmış bir sözlük ─────────────────────────────────
 *
 * Metro yalnızca **sabit dizgi** alan `require()` çağrılarını paketliyor;
 * `require(\`../../assets/tarif/${slug}.jpg\`)` çalışmıyor. Yani bu dosya
 * üretilebilir ama dinamik olamaz. Görsel eklendikçe buraya satır eklenecek.
 *
 * ── Boyut ──────────────────────────────────────────────────────────
 *
 * Görseller 1200 piksel genişliğe indirilip JPEG'e çevrildi: 10,4 MB → 2,5 MB.
 * Kaynak PNG'ler `data-build/` altında duruyor, pakete girmiyor.
 *
 * Bu yaklaşım birkaç yüz görsele kadar ölçekleniyor. Korpusun tamamı (2.964
 * kare) pakete gömülemez — o noktada görseller Supabase Storage'a ya da bir
 * CDN'e taşınıp `imageUrl` üzerinden gelmeli.
 */

import type { ImageSourcePropType } from 'react-native';

export const YEREL_GORSEL: Record<string, ImageSourcePropType> = {
  'adana-kebap': require('../../../assets/tarif/adana-kebap.jpg'),
  'ev-ayrani': require('../../../assets/tarif/ev-ayrani.jpg'),
  'ezogelin-corbasi': require('../../../assets/tarif/ezogelin-corbasi.jpg'),
  'iskembe-alternatifi-tavuk-suyu': require('../../../assets/tarif/iskembe-alternatifi-tavuk-suyu.jpg'),
  'karides-guvec': require('../../../assets/tarif/karides-guvec.jpg'),
  keskek: require('../../../assets/tarif/keskek.jpg'),
  kunefe: require('../../../assets/tarif/kunefe.jpg'),
  manti: require('../../../assets/tarif/manti.jpg'),
  'mercimek-corbasi': require('../../../assets/tarif/mercimek-corbasi.jpg'),
  salep: require('../../../assets/tarif/salep.jpg'),
  'tarhana-corbasi': require('../../../assets/tarif/tarhana-corbasi.jpg'),
  'turk-kahvesi': require('../../../assets/tarif/turk-kahvesi.jpg'),
  'yayla-corbasi': require('../../../assets/tarif/yayla-corbasi.jpg'),
};

/** Tarifin kendi görseli var mı — yerel ya da uzak. */
export function hasRealImage(slug: string, imageUrl?: string): boolean {
  return Boolean(YEREL_GORSEL[slug] ?? imageUrl);
}

/**
 * `expo-image`'e verilecek kaynak.
 *
 * `size` yalnızca yer tutucu için gerekiyor; gerçek görselde kullanılmıyor.
 */
export function gorselKaynagi(
  slug: string,
  imageUrl: string | undefined,
  size: `${number}/${number}` = '400/400',
): ImageSourcePropType {
  const yerel = YEREL_GORSEL[slug];
  if (yerel) return yerel;
  if (imageUrl) return { uri: imageUrl };
  return { uri: `https://loremflickr.com/${size}/food,recipe?random=${slug}` };
}
