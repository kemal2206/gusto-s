/**
 * Kaydedilen tarifler.
 *
 * Referans tasarımdaki yer imi simgesinin karşılığı. Cihazda tutuluyor,
 * dışarı çıkmıyor; hesap açılınca (aşama 6) Supabase'e taşınacak.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoritesState {
  slugs: string[];
  hydrated: boolean;
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      slugs: [],
      hydrated: false,
      toggle: (slug) =>
        set((s) => ({
          slugs: s.slugs.includes(slug)
            ? s.slugs.filter((x) => x !== slug)
            : [slug, ...s.slugs],
        })),
      has: (slug) => get().slugs.includes(slug),
    }),
    {
      name: 'tatbilim-favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ slugs: s.slugs }) as FavoritesState,
      onRehydrateStorage: () => () => useFavorites.setState({ hydrated: true }),
    },
  ),
);
