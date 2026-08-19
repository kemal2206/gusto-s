/**
 * Tatbilim tasarım token'ları.
 *
 * Referans: ödüllü ama sade uygulamaların ortak dili — geniş beyaz alan,
 * güçlü tipografik hiyerarşi, gölge yerine saç teli çizgi, tek vurgu rengi,
 * küçük harf aralıklı "eyebrow" etiketler, veride tablo hizalı sayılar.
 *
 * Erişilebilirlik kısıtları hâlâ geçerli: dokunma alanı 52'nin altına inmiyor,
 * kontrast oranları WCAG'a göre hesaplandı.
 */

import type { TextStyle } from 'react-native';

export const palette = {
  /** Birincil marka rengi. Beyaz üstünde 4.67:1 → AA. */
  brand: '#e6103b',
  /** Başlık ve küçük vurgulu metin. Beyaz üstünde 8.62:1 → AAA. */
  brandDeep: '#961238',
  /** Marka renginin çok açık tonu — seçili kart zemini. */
  brandSoft: '#fdf1f4',
  brandSoftBorder: '#f2ccd6',

  /** Gövde metni. Beyaz üstünde 18.5:1 → AAA. */
  ink: '#141414',
  /** İkincil metin. Beyaz üstünde 6.66:1 → AA. */
  inkMuted: '#5c5c5c',
  /** Yalnızca dekoratif/pasif. Metin için kullanma. */
  inkFaint: '#9a9a9a',

  surface: '#ffffff',
  surfaceAlt: '#fafafa',
  /** Saç teli çizgi — gölgenin yerini bu aldı. */
  border: '#e8e8ea',
  borderStrong: '#d2d2d7',

  success: '#1f7a4d',
  successSoft: '#eef7f2',
  warning: '#9a5300',
  warningSoft: '#fdf4ec',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 44,
  '5xl': 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,

  /**
   * Dokunulabilir her yüzeyin köşesi: buton, çip, sekme, arama kutusu.
   * Tek değer olması önemli — kimi yerde hap, kimi yerde köşeli olunca
   * uygulama farklı ellerden çıkmış gibi duruyor.
   */
  control: 12,

  /** YALNIZCA gerçekten daire olması gerekenler: rozet, tik, sayaç, avatar. */
  pill: 999,
} as const;

/** Dokunulabilir her şeyin minimum yüksekliği. Platform kılavuzu 44 der, 52 alıyoruz. */
export const MIN_TOUCH = 52;

export const fontFamily = {
  regular: 'ZalandoSans_SemiExpanded_Regular',
  medium: 'ZalandoSans_SemiExpanded_Medium',
  semibold: 'ZalandoSans_SemiExpanded_SemiBold',
  bold: 'ZalandoSans_SemiExpanded_Bold',
} as const;

/**
 * Tip ölçeği. Başlıklarda sıkı harf aralığı (editöryel görünüm),
 * gövdede geniş satır yüksekliği (okunabilirlik).
 */
export const type = {
  display: { fontFamily: fontFamily.bold, fontSize: 27, lineHeight: 33, letterSpacing: -0.6 },
  h1: { fontFamily: fontFamily.bold, fontSize: 23, lineHeight: 29, letterSpacing: -0.4 },
  h2: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 23 },
  button: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 20 },
  /** Bölüm üstü küçük etiket. Daima büyük harf yazılır. */
  eyebrow: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
} as const;

export type TypeVariant = keyof typeof type;

/** Sayılar sütun hâlinde hizalansın — ölçüm ve skor gösterimlerinde. */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Sistem yazı boyutu ayarına saygı duyuyoruz ama sınırsız değil —
 * 1.6x üstünde düzen kırılıyor, kullanıcı içeriği hiç göremiyor.
 */
export const MAX_FONT_SCALE = 1.6;

/**
 * Gölge neredeyse hiç kullanılmıyor: yükseklik hissi saç teli çizgi ve
 * beyaz alanla veriliyor. Yalnızca ekrana sabitlenen çubuklarda var.
 */
export const shadow = {
  sticky: { boxShadow: '0px -1px 0px rgba(20, 20, 20, 0.06)' },
  raised: { boxShadow: '0px 6px 24px rgba(20, 20, 20, 0.08)' },
} as const;

export const HAIRLINE = 1;

/**
 * Kart zemin tonları.
 *
 * Referans tasarımda kartların üstünde yemek fotoğrafı var ve renk oradan
 * geliyor. Bizde fotoğraf yok, emoji var; renk hissini bu yumuşak tonlar
 * veriyor. Hepsi markanın sıcak ailesinden — kırmızı, kum, zeytin, tarçın —
 * yani rastgele değil, palete bağlı.
 */
export const tints = [
  '#fdf1f4', // marka pembesi
  '#f7f3ec', // kum
  '#f0f4ee', // zeytin
  '#fbf1e8', // tarçın
  '#f2f2f5', // taş
  '#fdf6e9', // bal
] as const;

/** Kategori id'sine göre sabit ton — liste her açılışta aynı görünsün. */
export function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return tints[hash % tints.length];
}
