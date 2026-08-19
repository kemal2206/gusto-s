/**
 * Alışveriş listesi.
 *
 * Tarif sayfasındaki "Alışveriş listesine ekle" düğmesinin karşılığı.
 * Malzemeler slug + gram olarak birikiyor; aynı malzeme iki tariften
 * gelirse gramları toplanıyor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface GroceryItem {
  slug: string;
  grams: number;
  /** Hangi tariften geldi — listede bağlam versin diye. */
  from: string[];
}

interface GroceryState {
  items: GroceryItem[];
  hydrated: boolean;
  addMany: (recipeTitle: string, items: { slug: string; grams: number }[]) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

export const useGrocery = create<GroceryState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,
      addMany: (recipeTitle, incoming) =>
        set((s) => {
          const map = new Map(s.items.map((i) => [i.slug, { ...i }]));
          for (const it of incoming) {
            const cur = map.get(it.slug);
            if (cur) {
              cur.grams += it.grams;
              if (!cur.from.includes(recipeTitle)) cur.from.push(recipeTitle);
            } else {
              map.set(it.slug, { slug: it.slug, grams: it.grams, from: [recipeTitle] });
            }
          }
          return { items: [...map.values()] };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'tatbilim-grocery',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }) as GroceryState,
      onRehydrateStorage: () => () => useGrocery.setState({ hydrated: true }),
    },
  ),
);
