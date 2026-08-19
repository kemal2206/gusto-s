/**
 * Özel seçkiler — Keşfet'teki ikinci blok.
 *
 * Ana malzeme ("tavuk", "çorba") tarifi *neyden yapıldığına* göre ayırıyor.
 * Seçkiler ise **niye seçildiğine** göre: bugün vaktim yok, cebim dar,
 * hafif bir şey istiyorum, çocuk da yiyecek.
 *
 * Her seçki sert bir süzgeç: listede yalnızca o niteliği taşıyan tarifler
 * var. Eşikler korpusun kendi dağılımından alındı, tahminle değil — her
 * seçkinin kaç tarif tuttuğu yorumlarda yazıyor ve `smoke:kesfet` bunu
 * ölçüyor, çünkü 20 tarif tutan bir seçki raf değil çıkmaz sokaktır.
 */

import { BY_SLUG } from '@/data/catalog';
import type { Recipe } from '@/data/recipes';
import { nutritionOf } from '@/lib/recipe-facts';
import { dishTaste, portionCost } from '@/lib/recipe-taste';

export interface Collection {
  id: string;
  labelTr: string;
  hintTr: string;
  emoji: string;
  match: (r: Recipe) => boolean;
}

const ANIMAL = new Set(['protein', 'deniz', 'sarkuteri']);
const PLANT = new Set(['sebze', 'mantar', 'baklagil', 'ot']);

/** Bir tarifte sebze ve baklagilin gram payı — su sayılmıyor. */
export function plantShare(recipe: Recipe): number {
  let plant = 0;
  let total = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      if (ri.slug === 'su') continue;
      total += ri.grams;
      if (PLANT.has(BY_SLUG.get(ri.slug)?.category ?? '')) plant += ri.grams;
    }
  }

  return total > 0 ? plant / total : 0;
}

export function hasAnimalProduct(recipe: Recipe): boolean {
  return recipe.allSlugs.some((s) => ANIMAL.has(BY_SLUG.get(s)?.category ?? ''));
}

/**
 * Maliyet kademesi.
 *
 * Sayı göreli ve birimsiz (bkz. `maliyet.ts`), o yüzden kullanıcıya rakam
 * değil kademe gösteriliyor. Sınırlar korpus dağılımından: %25 dilim 3,8 ·
 * medyan 6,3 · %75 dilim 10,1.
 */
export type CostLevel = 'ucuz' | 'orta' | 'pahali';

export function costLevel(recipe: Recipe): CostLevel {
  const c = portionCost(recipe);
  if (c <= 4) return 'ucuz';
  if (c <= 10) return 'orta';
  return 'pahali';
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'saglikli',
    labelTr: 'Sağlıklı',
    hintTr: 'Hafif, sebzeli, kızartmasız',
    emoji: '🥗',
    // 1.101 tarif: porsiyonu 500 kalorinin altında, yağı düşük,
    // en az üçte biri sebze ve kızartma yok.
    match: (r) => {
      const n = nutritionOf(r);
      if (!n.kcal || n.kcal > 500) return false;
      if (dishTaste(r).fat > 3) return false;
      if (r.components.some((c) => c.method === 'kizartma')) return false;
      /**
       * Yöntem alanı her zaman doğru değil: korpusta adı "…Kızartması" olup
       * yöntemi "tava" yazan tarifler var ve sağlıklı listesinin başına
       * geçiyorlardı. Ad da denetleniyor.
       */
      if (/kızart|kizart|fritöz|derin yağ/i.test(r.title)) return false;
      return plantShare(r) >= 0.3;
    },
  },
  {
    id: 'hizli',
    labelTr: '15 dakikadan az',
    hintTr: 'Acelesi olana',
    emoji: '⏱️',
    // 238 tarif.
    match: (r) => r.totalMinutes <= 15,
  },
  {
    id: 'ucuz',
    labelTr: 'Cebe uygun',
    hintTr: 'Ucuz malzemeyle',
    emoji: '🪙',
    match: (r) => costLevel(r) === 'ucuz',
  },
  {
    id: 'etsiz',
    labelTr: 'Etsiz',
    hintTr: 'Sebze, bakliyat, süt ürünü',
    emoji: '🌱',
    // 1.338 tarif.
    match: (r) => !hasAnimalProduct(r),
  },
  {
    id: 'cocuk',
    labelTr: 'Çocuk dostu',
    hintTr: 'Acısız ve sade',
    emoji: '🧒',
    // 1.161 tarif: acısız, kekremsi tarafı düşük, malzemesi az.
    match: (r) => {
      const t = dishTaste(r);
      return t.heat < 0.15 && t.bitter < 1.5 && r.allSlugs.length <= 10;
    },
  },
];

export const COLLECTION_BY_ID = new Map(COLLECTIONS.map((c) => [c.id, c]));
