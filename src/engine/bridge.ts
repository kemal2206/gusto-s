/**
 * Bağlayıcı (köprü) malzeme bulucu.
 *
 * "Bu sos bu etle uyumlu değil, arada ne kullanmalıyım?" sorusunun cevabı.
 * İki uçla da makul aroma örtüşmesi olan üçüncü bir malzeme arıyoruz.
 *
 *   bridge(a,b) = argmax_x  H( aroma(a,x), aroma(b,x) )      H = harmonik ortalama
 *
 * Harmonik ortalama seçildi çünkü aritmetik ortalama tek tarafa çok yakın olan
 * malzemeyi ödüllendirir — köprü olması için İKİ ucu da tutması gerekiyor.
 */

import type { BridgeResult, Ingredient, IngredientRole } from './types';
import type { AffinityLookup } from './lookup';

const BRIDGE_ROLES: IngredientRole[] = [
  'aromatik',
  'yag',
  'asit',
  'tatlandirici',
  'baglayici',
  'baharat',
];

export interface BridgeOptions {
  /** Her iki uçla da bu eşiğin üstünde bağlantı şart. */
  minLink?: number;
  /** Hangi rollerdeki malzemeler köprü olabilir. */
  roles?: IngredientRole[];
  excludeIngredientIds?: number[];
  excludeAllergens?: string[];
  limit?: number;
}

const harmonic = (x: number, y: number) => (x + y <= 0 ? 0 : (2 * x * y) / (x + y));

export function findBridges(
  a: Ingredient,
  b: Ingredient,
  candidates: Ingredient[],
  lookup: AffinityLookup,
  options: BridgeOptions = {},
): BridgeResult[] {
  const {
    minLink = 0.15,
    roles = BRIDGE_ROLES,
    excludeIngredientIds = [],
    excludeAllergens = [],
    limit = 8,
  } = options;

  const excluded = new Set([a.id, b.id, ...excludeIngredientIds]);
  const roleSet = new Set(roles);
  const results: BridgeResult[] = [];

  for (const x of candidates) {
    if (excluded.has(x.id)) continue;

    const xRoles = new Set<IngredientRole>([x.defaultRole, ...x.roles]);
    if (![...xRoles].some((r) => roleSet.has(r))) continue;

    if (excludeAllergens.length && x.allergenTags.some((t) => excludeAllergens.includes(t))) {
      continue;
    }

    const fa = lookup.pair(a, x);
    const fb = lookup.pair(b, x);

    // Kapı: tek uca yapışan malzeme köprü değildir.
    if (Math.min(fa.aroma, fb.aroma) < minLink) continue;

    results.push({
      ingredient: x,
      score: harmonic(fa.aroma, fb.aroma),
      toA: fa.aroma,
      toB: fb.aroma,
      sharedWithA: fa.sharedCount,
      sharedWithB: fb.sharedCount,
    });
  }

  results.sort((p, q) => q.score - p.score);
  return results.slice(0, limit);
}
