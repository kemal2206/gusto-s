/**
 * Yemek kitabı deposu.
 *
 * **Neden burada sadece video ve kendi tarifleri var:** uygulamanın kendi
 * tariflerinin kaydı zaten `useFavorites`'te tutuluyor ve her karttaki yer
 * imi düğmesi oraya yazıyor. Aynı bilgiyi ikinci bir yerde tutmak iki
 * listenin ayrışması demek. Kitap ekranı üç kaynağı birleştiriyor:
 * favoriler + burası + pişirme geçmişi (`useHistory`).
 *
 * Yerel öncelikli: hesap olmadan da çalışıyor, oturum açılınca Supabase'e
 * eşitleniyor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { guessCategory } from '@/data/recipes/ad-kurallari';
import type { CookbookItem, OwnIngredient, OwnItem, VideoItem } from '@/lib/cookbook/types';
import type { VideoMeta } from '@/lib/cookbook/video';

interface CookbookState {
  hydrated: boolean;
  /** Yalnızca video ve kullanıcının kendi tarifleri. */
  items: (VideoItem | OwnItem)[];
  /** Tarif slug'ı → en son pişirme zamanı ve sayısı. */
  cooked: Record<string, { at: number; count: number }>;
  /**
   * Kitabın kişisel adı. **Boş bırakılabilir** — ad verilmediyse başlıkta
   * yalnızca "Gusto's" görünüyor, uydurma bir isim yazmıyoruz.
   */
  title: string;
  bio: string;
  isPublic: boolean;

  addVideo: (meta: VideoMeta, title?: string) => VideoItem | null;
  addOwn: (input: {
    title: string;
    summary?: string;
    ingredients: OwnIngredient[];
    steps: string[];
    minutes?: number;
    servings?: number;
  }) => OwnItem;
  remove: (id: string) => void;
  markCooked: (key: string) => void;
  setBook: (patch: { title?: string; bio?: string; isPublic?: boolean }) => void;
  clear: () => void;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useCookbook = create<CookbookState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      items: [],
      cooked: {},
      title: '',
      bio: '',
      isPublic: false,

      addVideo: (meta, manualTitle) => {
        // Aynı video iki kez girmesin.
        if (get().items.some((i) => i.kind === 'video' && i.url === meta.url)) return null;

        const title = (manualTitle?.trim() || meta.title || '').trim();
        if (!title) return null;

        const item: VideoItem = {
          id: newId(),
          kind: 'video',
          url: meta.url,
          platform: meta.platform,
          videoId: meta.videoId,
          title,
          author: meta.author,
          thumbUrl: meta.thumbUrl,
          metaSource: meta.source,
          // Elimizdeki tek ipucu başlık; tutmazsa "Diğer"de kalıyor.
          categoryId: guessCategory(title, meta.author),
          addedAt: Date.now(),
          cookCount: 0,
        };

        set((s) => ({ items: [item, ...s.items] }));
        return item;
      },

      addOwn: (input) => {
        const item: OwnItem = {
          id: newId(),
          kind: 'kendi',
          title: input.title.trim(),
          summary: input.summary?.trim() || undefined,
          ingredients: input.ingredients,
          steps: input.steps,
          minutes: input.minutes,
          servings: input.servings,
          categoryId: guessCategory(input.title, input.summary),
          addedAt: Date.now(),
          cookCount: 0,
        };

        set((s) => ({ items: [item, ...s.items] }));
        return item;
      },

      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      /**
       * "Bunu pişirdim" — hem uygulama tarifi (slug) hem kitap içeriği (id)
       * aynı çağrıyı kullanıyor, anahtar hangisiyse orada tutuluyor.
       */
      markCooked: (key) =>
        set((s) => {
          const at = Date.now();
          const local = s.items.find((i) => i.id === key);
          if (local) {
            return {
              items: s.items.map((i) =>
                i.id === key ? { ...i, cookedAt: at, cookCount: i.cookCount + 1 } : i,
              ),
            };
          }
          const prev = s.cooked[key];
          return { cooked: { ...s.cooked, [key]: { at, count: (prev?.count ?? 0) + 1 } } };
        }),

      setBook: (patch) => set((s) => ({ ...s, ...patch })),
      clear: () => set({ items: [], cooked: {} }),
    }),
    {
      name: 'tatbilim-cookbook',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) =>
        ({
          items: s.items,
          cooked: s.cooked,
          title: s.title,
          bio: s.bio,
          isPublic: s.isPublic,
        }) as CookbookState,
      onRehydrateStorage: () => () => useCookbook.setState({ hydrated: true }),
    },
  ),
);

/**
 * Kullanıcının verdiği kişisel ad — yoksa `null`.
 *
 * Eski sürümlerde varsayılan "Yemek Kitabım" yazıyordu; onu da "ad verilmemiş"
 * sayıyoruz, yoksa hiç ad vermemiş kullanıcının başlığında kalıyor.
 */
export function personalTitle(title: string): string | null {
  const t = title.trim();
  return !t || t === 'Yemek Kitabım' ? null : t;
}

/** Kitaptaki bir içeriği kimliğiyle bul. */
export function findItem(items: CookbookItem[], id: string): CookbookItem | undefined {
  return items.find((i) => i.id === id);
}
