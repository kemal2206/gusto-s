/**
 * Arama geçmişi.
 *
 * Ne aradığı, ne pişirdiği kadar güçlü bir sinyal: kişi "karnabahar" diye
 * arıyorsa ana sayfada karnabaharlı tarif görmek istiyordur. Terimleri sayıp
 * en çok arananları saklıyoruz.
 *
 * Yalnızca terim ve sayaç tutuluyor — arama zamanı ya da sonuç tıklamaları
 * gibi ayrıntıya gerek yok, tavsiye için terim yeterli.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SearchTerm {
  term: string;
  count: number;
}

interface SearchLogState {
  hydrated: boolean;
  terms: SearchTerm[];
  record: (term: string) => void;
  clear: () => void;
}

/** Aynı terimin farklı yazımları tek sayaçta toplansın. */
const normalize = (t: string) => t.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');

const MAX_TERMS = 40;

export const useSearchLog = create<SearchLogState>()(
  persist(
    (set) => ({
      hydrated: false,
      terms: [],

      record: (raw) => {
        const term = normalize(raw);
        if (term.length < 3) return;

        set((s) => {
          const next = [...s.terms];
          const i = next.findIndex((t) => t.term === term);
          if (i >= 0) next[i] = { term, count: next[i].count + 1 };
          else next.push({ term, count: 1 });

          next.sort((a, b) => b.count - a.count);
          return { terms: next.slice(0, MAX_TERMS) };
        });
      },

      clear: () => set({ terms: [] }),
    }),
    {
      name: 'tatbilim-search-log',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ terms: s.terms }) as SearchLogState,
      onRehydrateStorage: () => () => useSearchLog.setState({ hydrated: true }),
    },
  ),
);

/** En çok aranan terimler — ana sayfadaki kişisel ray bunu kullanıyor. */
export function topTerms(terms: SearchTerm[], n = 3): string[] {
  return terms
    .filter((t) => t.count >= 2)
    .slice(0, n)
    .map((t) => t.term);
}
