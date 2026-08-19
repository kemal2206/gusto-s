/**
 * Aroma benzerliği ve kültürel önsel.
 *
 * İki ayrı sinyal var ve ikisi de gerçek:
 *  1. Paylaşılan uçucu bileşikler (Ahn et al. 2011 — Batı mutfağında doğrulanmış)
 *  2. Tarif korpusunda birlikte geçme (Doğu Asya'da bileşik paylaşımı TERS orantılı,
 *     yani kimya tek başına yeterli değil)
 */

import type { Ingredient, PairingEdge, PairingIndex, PairingMode } from './types';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Bileşik başına IDF ağırlığı.
 *
 * Asetik asit gibi neredeyse her şeyde bulunan bileşikler bilgi taşımaz;
 * ağırlıklandırmazsak her malzeme her malzemeye benziyor çıkar.
 *
 *   w(c) = ln(1 + N / df(c))
 */
export function buildCompoundIdf(ingredients: Ingredient[]): Map<number, number> {
  const df = new Map<number, number>();
  let n = 0;

  for (const ing of ingredients) {
    if (!ing.compoundIds?.length) continue;
    n += 1;
    for (const c of new Set(ing.compoundIds)) {
      df.set(c, (df.get(c) ?? 0) + 1);
    }
  }

  const idf = new Map<number, number>();
  for (const [c, d] of df) idf.set(c, Math.log(1 + n / d));
  return idf;
}

/** IDF vektörünün L2 normu. Kosinüs paydası — çift başına yeniden hesaplanmasın diye ayrı. */
export function compoundNorm(ing: Ingredient, idf: Map<number, number>): number {
  let sum = 0;
  for (const c of new Set(ing.compoundIds ?? [])) {
    const w = idf.get(c) ?? 0;
    sum += w * w;
  }
  return Math.sqrt(sum);
}

export function buildNormCache(
  ingredients: Ingredient[],
  idf: Map<number, number>,
): Map<number, number> {
  const cache = new Map<number, number>();
  for (const ing of ingredients) cache.set(ing.id, compoundNorm(ing, idf));
  return cache;
}

export interface AromaResult {
  /** IDF ağırlıklı kosinüs ∈ [0,1]. */
  score: number;
  /** Ham ortak bileşik id'leri — sayısı kullanıcıya gösterilir. */
  shared: number[];
}

/**
 *   aroma(a,b) = Σ_{c ∈ Ca∩Cb} w(c)²  /  ( ‖a‖ · ‖b‖ )
 *
 * Bileşik verisi olmayan malzeme için 0 döner (yanlış pozitif üretmemek için).
 */
export function aromaAffinity(
  a: Ingredient,
  b: Ingredient,
  idf: Map<number, number>,
  norms?: Map<number, number>,
): AromaResult {
  const ca = a.compoundIds;
  const cb = b.compoundIds;
  if (!ca?.length || !cb?.length) return { score: 0, shared: [] };

  const setB = new Set(cb);
  const shared: number[] = [];
  let dot = 0;

  for (const c of new Set(ca)) {
    if (!setB.has(c)) continue;
    const w = idf.get(c) ?? 0;
    dot += w * w;
    shared.push(c);
  }

  const na = norms?.get(a.id) ?? compoundNorm(a, idf);
  const nb = norms?.get(b.id) ?? compoundNorm(b, idf);
  const denom = na * nb;

  return { score: denom > 0 ? clamp01(dot / denom) : 0, shared };
}

/**
 * Normalize edilmiş noktasal karşılıklı bilgi ∈ [-1,1].
 * Tarif korpusunda birlikte geçme sıklığını, ayrı ayrı popülerliklerinden arındırır —
 * yoksa "soğan her şeyle uyumlu" gibi anlamsız bir sonuç çıkar.
 */
export function npmi(coCount: number, aCount: number, bCount: number, total: number): number {
  if (coCount <= 0 || total <= 0 || aCount <= 0 || bCount <= 0) return 0;

  const pAB = coCount / total;
  const pA = aCount / total;
  const pB = bCount / total;

  const denom = -Math.log(pAB);
  if (denom === 0) return 0;

  return Math.log(pAB / (pA * pB)) / denom;
}

// ── Önceden hesaplanmış kenar indeksi ──────────────────────────────────

const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * 1.500 malzeme = ~1.1M çift. Uygulamada kenarlar Supabase'ten hazır gelir,
 * bu indeks sadece O(1) erişim sağlar.
 */
export function createPairingIndex(edges: PairingEdge[]): PairingIndex {
  const byPair = new Map<string, PairingEdge>();
  const adjacency = new Map<number, PairingEdge[]>();

  for (const e of edges) {
    byPair.set(key(e.aId, e.bId), e);
    for (const id of [e.aId, e.bId]) {
      const list = adjacency.get(id);
      if (list) list.push(e);
      else adjacency.set(id, [e]);
    }
  }

  for (const list of adjacency.values()) {
    list.sort((x, y) => y.aromaScore - x.aromaScore);
  }

  return {
    get: (a, b) => byPair.get(key(a, b)),
    neighbors: (id, limit) => {
      const list = adjacency.get(id) ?? [];
      return limit == null ? list : list.slice(0, limit);
    },
  };
}

/**
 * Moda göre etkin aroma terimi.
 *
 * Zıtlık modunda düşük bileşik örtüşmesi *iyidir* — ama gelişigüzel değil:
 * kültürel önsel yoksa "domates + vanilya" gibi saçmalıklar tepeye çıkar.
 * Bu yüzden zıtlık skoru önsel ile kapılanıyor.
 */
export function effectiveAroma(
  aroma: number,
  prior: number | undefined,
  mode: PairingMode,
): number {
  if (mode === 'benzerlik') return clamp01(aroma);
  const p = clamp01(prior ?? 0);
  return clamp01((1 - clamp01(aroma)) * (0.35 + 0.65 * p));
}
