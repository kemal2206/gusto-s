/**
 * Malzeme katalogunun ham yazım biçimi.
 *
 * 200+ malzemeyi elle yazacağımız için alan adları kısa. Anahtarlar:
 *
 *   s  slug (kimlik)                  n  Türkçe ad
 *   e  İngilizce ad — aşama 2'de FlavorDB/Ahn veri setine bağlanma anahtarı
 *   c  kategori                       r  ana rol      rr ek roller
 *   t  tat vektörü [tatlı, ekşi, tuzlu, kekremsi, umami, yağlı, yakıcı] her biri 0–10
 *   p  potency — 1 gramın yemeği ne kadar etkilediği (patates 1, safran 10)
 *   a  aromaPower — malzemenin "sesi" 0–10
 *   x  aroma aileleri (aroma-classes.ts slug'ları)
 *   k  karakteristik olduğu mutfaklar (boşsa ['tr'])
 *   al alerjen etiketleri            d  diyet etiketleri
 *   st "Elimde ne var?" hızlı kartlarında görünsün mü
 */

import type { IngredientCategory, IngredientRole } from '@/engine';

export type TasteTuple = [
  sweet: number,
  sour: number,
  salty: number,
  bitter: number,
  umami: number,
  fat: number,
  heat: number,
];

export interface RawIngredient {
  s: string;
  n: string;
  e?: string;
  c: IngredientCategory;
  r: IngredientRole;
  rr?: IngredientRole[];
  t: TasteTuple;
  p: number;
  a: number;
  x: string[];
  k?: string[];
  al?: string[];
  d?: string[];
  st?: boolean;
}

/** Bölge etiketleri — Türk mutfağı ve komşuları. */
export const CUISINES = {
  tr: 'Türk',
  ege: 'Ege',
  guneydogu: 'Güneydoğu',
  karadeniz: 'Karadeniz',
  levanten: 'Levanten (Suriye, Lübnan)',
  balkan: 'Balkan',
  yunan: 'Yunan',
  iran: 'İran',
  kafkas: 'Kafkas',
  ortaasya: 'Orta Asya',
} as const;

export type CuisineId = keyof typeof CUISINES;
