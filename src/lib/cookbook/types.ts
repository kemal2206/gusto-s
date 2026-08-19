/**
 * Yemek kitabı içerik modeli.
 *
 * Üç tür içerik aynı listede yaşıyor:
 *
 *  - `tarif`  uygulamanın kendi tarifi (yer imi düğmesiyle kaydedilen)
 *  - `video`  sosyal medya bağlantısı — içerik değil, kimlik ve künye
 *  - `kendi`  kullanıcının yazdığı tarif
 *
 * Üçünün de ortak alanı var (`id`, `categoryId`, `cookedAt`), böylece kitap
 * ekranı tek bir listeyi bölümlere ayırabiliyor ve "daha önce yaptıkların"
 * üçünü birden zaman sırasına dizebiliyor.
 */

import type { VideoPlatform } from './video';

export type CookbookItemKind = 'tarif' | 'video' | 'kendi';

interface Base {
  id: string;
  kind: CookbookItemKind;
  /** Otomatik atanan bölüm — `DISH_CATEGORIES` kimliği. Bilinmiyorsa null. */
  categoryId: string | null;
  addedAt: number;
  /** En son ne zaman pişirildi. "Daha önce yaptıkların" bunu sıralıyor. */
  cookedAt?: number;
  cookCount: number;
  note?: string;
}

export interface RecipeItem extends Base {
  kind: 'tarif';
  recipeSlug: string;
}

export interface VideoItem extends Base {
  kind: 'video';
  url: string;
  platform: VideoPlatform;
  videoId?: string;
  title: string;
  author?: string;
  /** Platformun CDN adresi. İndirilmiyor, oradan gösteriliyor. */
  thumbUrl?: string;
  /** Künye platformdan mı geldi, kullanıcı mı yazdı. */
  metaSource: 'oembed' | 'elle';
}

/** Kendi tarifinde bir malzeme satırı. */
export interface OwnIngredient {
  /** Katalogla eşleştiyse slug; eşleşmediyse boş. */
  slug?: string;
  grams?: number;
  /** Kullanıcının yazdığı hâli — eşleşme olmasa da satır kaybolmasın. */
  raw: string;
}

export interface OwnItem extends Base {
  kind: 'kendi';
  title: string;
  summary?: string;
  ingredients: OwnIngredient[];
  steps: string[];
  minutes?: number;
  servings?: number;
}

export type CookbookItem = RecipeItem | VideoItem | OwnItem;

/** Listede ve paylaşımda kullanılacak görünen ad. */
export function itemTitle(item: CookbookItem, recipeTitle?: string): string {
  if (item.kind === 'video') return item.title;
  if (item.kind === 'kendi') return item.title;
  return recipeTitle ?? item.recipeSlug;
}
