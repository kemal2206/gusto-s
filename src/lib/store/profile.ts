/**
 * Kullanıcı profili — açılış sorularının cevapları ve oturum.
 *
 * **Yerel öncelikli.** Uygulama Supabase olmadan da tam çalışıyor: profil
 * cihazda tutuluyor. Oturum açılınca aynı veri buluta yazılıyor ve başka
 * cihazdan da okunabiliyor. Bu sayede kullanıcı hesap açmaya zorlanmıyor;
 * hesap yalnızca cihazlar arası taşımak isteyene gerekiyor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Appliance, DietRestriction, Household } from '@/lib/profile-model';
import type { ProfileFilter } from '@/lib/profile-filter';

export type {
  Appliance,
  DietRestriction,
  Household,
} from '@/lib/profile-model';
export { APPLIANCE_LABELS, DIET_LABELS, eaterCount } from '@/lib/profile-model';

interface ProfileState {
  hydrated: boolean;
  onboarded: boolean;
  /** Oturum açıksa e-posta; yerel modda null. */
  email: string | null;
  userId: string | null;

  household: Household;
  diets: DietRestriction[];
  dislikedSlugs: string[];
  appliances: Appliance[];
  /** Sağlık gerekçeli eliminasyon — tercihden ayrı tutuluyor. */
  eliminations: string[];
  excludedSlugs: string[];

  setHousehold: (h: Partial<Household>) => void;
  toggleDiet: (d: DietRestriction) => void;
  toggleDislike: (slug: string) => void;
  toggleAppliance: (a: Appliance) => void;
  toggleElimination: (id: string) => void;
  toggleExcluded: (slug: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setSession: (userId: string | null, email: string | null) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboarded: false,
      email: null,
      userId: null,

      household: { adults: 2, children: 0, dogs: 0, cats: 0 },
      diets: [],
      dislikedSlugs: [],
      eliminations: [],
      excludedSlugs: [],
      // Ocak varsayılan açık: ocağı olmayan mutfak yok denecek kadar az.
      appliances: ['ocak'],

      setHousehold: (h) => set((s) => ({ household: { ...s.household, ...h } })),

      toggleDiet: (d) =>
        set((s) => ({
          diets: s.diets.includes(d) ? s.diets.filter((x) => x !== d) : [...s.diets, d],
        })),

      toggleDislike: (slug) =>
        set((s) => ({
          dislikedSlugs: s.dislikedSlugs.includes(slug)
            ? s.dislikedSlugs.filter((x) => x !== slug)
            : [...s.dislikedSlugs, slug],
        })),

      toggleElimination: (id) =>
        set((s) => ({
          eliminations: s.eliminations.includes(id)
            ? s.eliminations.filter((x) => x !== id)
            : [...s.eliminations, id],
        })),

      toggleExcluded: (slug) =>
        set((s) => ({
          excludedSlugs: s.excludedSlugs.includes(slug)
            ? s.excludedSlugs.filter((x) => x !== slug)
            : [...s.excludedSlugs, slug],
        })),

      toggleAppliance: (a) =>
        set((s) => ({
          appliances: s.appliances.includes(a)
            ? s.appliances.filter((x) => x !== a)
            : [...s.appliances, a],
        })),

      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
      setSession: (userId, email) => set({ userId, email }),
    }),
    {
      name: 'tatbilim-profile',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) =>
        ({
          onboarded: s.onboarded,
          email: s.email,
          userId: s.userId,
          household: s.household,
          diets: s.diets,
          dislikedSlugs: s.dislikedSlugs,
          eliminations: s.eliminations,
          excludedSlugs: s.excludedSlugs,
          appliances: s.appliances,
        }) as ProfileState,
      onRehydrateStorage: () => () => useProfile.setState({ hydrated: true }),
    },
  ),
);

/**
 * Süzgeç nesnesini tek yerde kur.
 *
 * Yedi ekran ayrı ayrı `{ diets, dislikedSlugs, appliances }` yazıyordu;
 * eliminasyon alanları eklenince yedisini de tek tek güncellemek ve birini
 * unutmak kaçınılmazdı. Unutulan ekran, sağlık gerekçesiyle elenmiş bir
 * malzemeyi kullanıcının önüne koyardı.
 */
export function useProfileFilter(): ProfileFilter {
  const diets = useProfile((s) => s.diets);
  const dislikedSlugs = useProfile((s) => s.dislikedSlugs);
  const appliances = useProfile((s) => s.appliances);
  const eliminations = useProfile((s) => s.eliminations);
  const excludedSlugs = useProfile((s) => s.excludedSlugs);

  return useMemo(
    () => ({ diets, dislikedSlugs, appliances, eliminations, excludedSlugs }),
    [diets, dislikedSlugs, appliances, eliminations, excludedSlugs],
  );
}
