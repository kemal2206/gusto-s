/**
 * Ne gösterdiğimizin hafızası.
 *
 * Sorun şuydu: aynı cevapları veren kişi her seferinde aynı beş tarifi
 * görüyordu. "Tavuk + hafif + 20 dakika" diyen biri üçüncü kez aynı listeye
 * bakınca uygulamanın bir şey bilmediğini düşünüyor.
 *
 * **Çözüm rastgelelik değil.** Listeyi karıştırmak en iyi eşleşmeleri aşağı
 * iter ve kalitesi düşer. Onun yerine iki şey yapıyoruz:
 *
 *  1. Daha önce **gösterilmiş** tarif hafif bir ceza alıyor — hâlâ listede
 *     ama arkadaki eşit güçteki tarifler öne geçebiliyor.
 *  2. Aynı puanı alan tarifler arasında sıra, her turda değişen bir
 *     tohumla belirleniyor. Eşitlik zaten sık: puanlar tam sayı adımlarla
 *     ilerlediği için onlarca tarif aynı puanda toplanıyor.
 *
 * Yani liste her açılışta tazeleniyor ama hep en uygunlar arasından.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DiscoveryState {
  hydrated: boolean;
  /** Tarif slug'ı → kaç kez sonuç listesinde gösterildi. */
  shown: Record<string, number>;
  /** Cevap birleşimi → kaçıncı tur. Tohum bundan geliyor. */
  runs: Record<string, number>;

  /** Bu cevaplarla yeni bir tur başlat, tohumu döndür. */
  nextRun: (key: string) => number;
  /** Gösterilen tarifleri işaretle. */
  markShown: (slugs: string[]) => void;
  clear: () => void;
}

/** Hafıza sınırsız büyümesin; 400 tarif fazlasıyla yeter. */
const MAX_SHOWN = 400;

export const useDiscovery = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      shown: {},
      runs: {},

      nextRun: (key) => {
        const next = (get().runs[key] ?? 0) + 1;
        set((s) => ({ runs: { ...s.runs, [key]: next } }));
        return next;
      },

      markShown: (slugs) =>
        set((s) => {
          const shown = { ...s.shown };
          for (const slug of slugs) shown[slug] = (shown[slug] ?? 0) + 1;

          // Taşarsa en az gösterilenleri koru; sık görülenler zaten cezalı.
          const keys = Object.keys(shown);
          if (keys.length > MAX_SHOWN) {
            const trimmed: Record<string, number> = {};
            for (const k of keys.sort((a, b) => shown[b] - shown[a]).slice(0, MAX_SHOWN)) {
              trimmed[k] = shown[k];
            }
            return { shown: trimmed };
          }
          return { shown };
        }),

      clear: () => set({ shown: {}, runs: {} }),
    }),
    {
      name: 'tatbilim-discovery',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ shown: s.shown, runs: s.runs }) as DiscoveryState,
      onRehydrateStorage: () => () => useDiscovery.setState({ hydrated: true }),
    },
  ),
);

/** Cevapları tek bir anahtara çevirir — aynı birleşim aynı sayaca düşsün. */
export function answerKey(answers: Record<string, string | undefined>): string {
  return Object.entries(answers)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}
