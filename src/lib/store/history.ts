/**
 * Kullanıcının kurduğu tabakların geçmişi.
 *
 * Ana sayfadaki "Senin mutfağın" bölümü bunu kullanıyor: 10 tabağın 6'sı
 * tavuksa tavuk önerileri öne çıkıyor. Tek amacı bu; analitik değil,
 * cihazdan dışarı çıkmıyor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface DishLog {
  mainSlug: string;
  groupId: string;
  /** Karakter arketipi — hangi tarzda pişirdiği. */
  archetypeId: string;
  at: number;
}

interface HistoryState {
  logs: DishLog[];
  /** AsyncStorage'dan okuma bitti mi — bitmeden "hiç tabak yok" demeyelim. */
  hydrated: boolean;
  logDish: (entry: Omit<DishLog, 'at'>) => void;
  clear: () => void;
}

/** Geçmiş sınırsız büyümesin; öneri için son 100 tabak fazlasıyla yeter. */
const MAX_LOGS = 100;

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      logs: [],
      hydrated: false,
      logDish: (entry) =>
        set((s) => ({ logs: [{ ...entry, at: Date.now() }, ...s.logs].slice(0, MAX_LOGS) })),
      clear: () => set({ logs: [] }),
    }),
    {
      name: 'tatbilim-history',
      storage: createJSONStorage(() => AsyncStorage),
      // `hydrated` diske yazılmaz — her açılışta yeniden hesaplanır.
      partialize: (s) => ({ logs: s.logs }) as HistoryState,
      // Depoda kayıt olsun ya da olmasın, okuma denemesi bittiğinde çağrılır.
      onRehydrateStorage: () => () => useHistory.setState({ hydrated: true }),
    },
  ),
);

export interface Favourite {
  slug: string;
  count: number;
  total: number;
  /** Toplam içindeki payı — "10 tabağın 6'sı" için. */
  ratio: number;
}

/**
 * En sık kullanılan ana malzeme.
 *
 * Tek bir tabak yetmez: bir kez tavuk pişiren birine "sen tavukçusun" demek
 * yanlış olur. En az 3 tabak ve %30 pay şartı arıyoruz.
 */
export function favouriteMain(logs: DishLog[], minLogs = 3, minRatio = 0.3): Favourite | null {
  if (logs.length < minLogs) return null;

  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.mainSlug, (counts.get(l.mainSlug) ?? 0) + 1);

  let best: { slug: string; count: number } | null = null;
  for (const [slug, count] of counts) {
    if (!best || count > best.count) best = { slug, count };
  }
  if (!best) return null;

  const ratio = best.count / logs.length;
  if (ratio < minRatio) return null;

  return { slug: best.slug, count: best.count, total: logs.length, ratio };
}
