/**
 * Tarifin tat profili.
 *
 * Motorun tabak matematiğinin tarife uygulanmış hâli:
 *
 *     profil = Σ(gram × potency × tat) / Σ(gram × potency)
 *
 * Aynı hesap menü kurucuda, ölçü denetiminde ve "canım ne istiyor"
 * filtresinde ayrı ayrı yazılmıştı; üçü de buraya bakıyor artık.
 *
 * **Neden malzeme adına bakmak yetmiyor:** filtre eskiden "tarifte pul biber
 * geçiyor mu" diye soruyordu. Bir tutam pul biberli mercimek çorbası da
 * "baharatlı" sayılıyordu. Burada gerçek acılık sayısı çıkıyor — malzemenin
 * miktarı ve etki gücü hesaba katılarak.
 *
 * Sonuç önbelleğe alınıyor: filtre 3.000 tarifi her tuş vuruşunda tarıyor,
 * her seferinde 27.000 malzeme araması yapmak ekranı kilitliyordu.
 */

import { BY_SLUG } from '@/data/catalog';
import { costPer100g } from '@/data/catalog/maliyet';
import type { Recipe } from '@/data/recipes';
import { TASTE_AXES, ZERO_TASTE, type TasteVector } from '@/engine';

const cache = new Map<string, TasteVector>();

/** Tabağın tat profili, eksenler 0–10. */
export function dishTaste(recipe: Recipe): TasteVector {
  const hit = cache.get(recipe.slug);
  if (hit) return hit;

  const acc: TasteVector = { ...ZERO_TASTE };
  let total = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;

      const w = ri.grams * ing.potency;
      if (!Number.isFinite(w) || w <= 0) continue;

      total += w;
      for (const axis of TASTE_AXES) acc[axis] += ing.taste[axis] * w;
    }
  }

  if (total > 0) for (const axis of TASTE_AXES) acc[axis] /= total;

  cache.set(recipe.slug, acc);
  return acc;
}

// ── Kademeler ──────────────────────────────────────────────────────

/**
 * Eşikler korpusun kendi dağılımından geldi, tahminden değil.
 * Acılık ekseninde medyan 0,15 · %75 dilim 0,36 · %90 dilim 0,62.
 */
export type HeatLevel = 'acisiz' | 'az-aci' | 'acili' | 'cok-acili';

export const HEAT_LABELS: Record<HeatLevel, string> = {
  acisiz: 'Acısız',
  'az-aci': 'Az acı',
  acili: 'Acılı',
  'cok-acili': 'İyice acı',
};

export function heatLevel(recipe: Recipe): HeatLevel {
  const h = dishTaste(recipe).heat;
  if (h < 0.1) return 'acisiz';
  if (h < 0.45) return 'az-aci';
  if (h < 0.9) return 'acili';
  return 'cok-acili';
}

/**
 * Emek ölçüsü.
 *
 * "Tek tencere" tek bileşenli ve tek kapta pişen tarif demek — ayrı sos,
 * ayrı garnitür yoksa bulaşık da yok. Korpusun 1.802 tarifi bunu tutuyor.
 */
export function isOnePot(recipe: Recipe): boolean {
  if (recipe.components.length !== 1) return false;
  return ['sulu', 'tava', 'haslama'].includes(recipe.components[0].method);
}

/** Kaç farklı malzeme istiyor — su, tuz gibi temel şeyler dâhil. */
export function ingredientCount(recipe: Recipe): number {
  return recipe.allSlugs.length;
}

// ── Göreli maliyet ─────────────────────────────────────────────────

/**
 * Porsiyon başına göreli maliyet.
 *
 * Birimi yok — mercimek 100 g = 1 kabul edilerek ölçeklenmiş bir sayı.
 * Tek işlevi tarifleri birbirine göre sıralamak; kullanıcıya rakam olarak
 * gösterilmiyor, "ucuz / orta / pahalı" diye gösteriliyor.
 */
export function portionCost(recipe: Recipe): number {
  let total = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;
      total += (ri.grams / 100) * costPer100g(ri.slug, ing.category);
    }
  }

  return total / Math.max(1, recipe.servings);
}
