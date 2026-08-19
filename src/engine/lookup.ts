/**
 * Motorun aroma verisine tek erişim noktası.
 *
 * İki kaynak var ve motor hangisinin kullanıldığını bilmemeli:
 *  - Uygulamada: Supabase'ten gelen önceden hesaplanmış kenarlar (hızlı)
 *  - Veri hattında / "ne olurdu?" hesaplarında: bileşik setlerinden anlık hesap
 */

import type { CompoundRef, Ingredient, PairingIndex } from './types';
import { aromaAffinity } from './affinity';

export interface PairFacts {
  aroma: number;
  sharedCount: number;
  prior?: number;
  topCompounds: CompoundRef[];
}

export interface AffinityLookup {
  pair(a: Ingredient, b: Ingredient): PairFacts;
}

const EMPTY: PairFacts = { aroma: 0, sharedCount: 0, topCompounds: [] };

/** Önceden hesaplanmış kenarlardan okur. Kenar yoksa eşik altı demektir → 0. */
export function lookupFromIndex(index: PairingIndex): AffinityLookup {
  return {
    pair(a, b) {
      if (a.id === b.id) return EMPTY;
      const edge = index.get(a.id, b.id);
      if (!edge) return EMPTY;
      return {
        aroma: edge.aromaScore,
        sharedCount: edge.sharedCount,
        prior: edge.priorNpmi,
        topCompounds: edge.topCompounds,
      };
    },
  };
}

/**
 * Bileşik setlerinden anlık hesaplar. Yavaş — yalnızca veri hattında veya
 * kullanıcının kendi eklediği malzeme için kullan.
 */
export function lookupFromCompounds(
  idf: Map<number, number>,
  compoundNames: Map<number, { slug: string; nameTr: string }>,
  norms?: Map<number, number>,
  topN = 5,
): AffinityLookup {
  return {
    pair(a, b) {
      if (a.id === b.id) return EMPTY;
      const { score, shared } = aromaAffinity(a, b, idf, norms);

      const topCompounds: CompoundRef[] = shared
        .map((id) => {
          const meta = compoundNames.get(id);
          return meta ? { slug: meta.slug, nameTr: meta.nameTr, weight: idf.get(id) ?? 0 } : null;
        })
        .filter((c): c is CompoundRef => c !== null)
        .sort((x, y) => y.weight - x.weight)
        .slice(0, topN);

      return { aroma: score, sharedCount: shared.length, topCompounds };
    },
  };
}
