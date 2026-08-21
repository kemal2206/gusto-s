/**
 * Sepet — alışveriş listesi.
 *
 * Tarif sayfasında bir malzemeye dokununca satır buraya düşüyor, sepet
 * ekranında market reyonlarına göre toplanıyor.
 *
 * **Neden tek bir gram sayısı tutmuyoruz.** Aynı malzeme iki tariften
 * gelebiliyor (soğan hemen her tarifte var). Tek toplam tutulsaydı,
 * kullanıcı bir tarifin soğanını geri çıkardığında öbür tarifin payı da
 * silinir, markette elinde eksik liste kalırdı. Bu yüzden her satır
 * *kaynaklarını* ayrı ayrı saklıyor; ekranda görünen gram bunların toplamı.
 *
 * Aynı tarif aynı malzemeyi ikinci kez eklerse gram **toplanmıyor,
 * değişiyor**: kullanıcı kişi sayısını 4'ten 6'ya çıkarıp yeniden eklemiş
 * olabilir. Eski hâli toplamak sepete iki kat soğan yazıyordu.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Bir malzemeyi sepete koyan tek bir tarif ve o tarifin istediği miktar. */
export interface GrocerySource {
  recipe: string;
  grams: number;
}

export interface GroceryItem {
  /** Katalog malzemesinde slug; elle yazılmış satırda `metin:` önekli anahtar. */
  slug: string;
  /**
   * Katalogda karşılığı olmayan satırın yazıldığı hâli.
   *
   * Kendi tariflerinde her satır katalogla eşleşmiyor ("bir tutam sevgi",
   * "annemin turşusundan"). Eşleşmeyeni sepete almamak, kullanıcının kendi
   * yazdığı listeyi sessizce budamak olurdu.
   */
  label?: string;
  sources: GrocerySource[];
  /**
   * Markette alındı işareti. Satır listeden silinmiyor, üstü çiziliyor —
   * "aldım mı almadım mı" sorusunun cevabı raf başında lazım oluyor.
   */
  bought: boolean;
  /** Ekleme sırası korunsun diye; liste her açılışta aynı görünüyor. */
  addedAt: number;
}

/** Satırın ekranda görünen miktarı: bütün tariflerin toplamı. */
export const gramsOf = (item: GroceryItem): number =>
  item.sources.reduce((total, s) => total + s.grams, 0);

/** Bu malzeme hangi tarifler için sepette. */
export const recipesOf = (item: GroceryItem): string[] => [
  ...new Set(item.sources.map((s) => s.recipe)),
];

/** Sepete eklenmek üzere verilen satır. */
export interface GroceryInput {
  slug: string;
  grams: number;
  label?: string;
}

interface GroceryState {
  items: GroceryItem[];
  hydrated: boolean;
  /**
   * Tarifin bütün malzemeleri. Aynı tarif ikinci kez eklenirse miktar
   * toplanmıyor, tazeleniyor.
   *
   * Gelen listede aynı slug iki kez varsa sonuncusu geçerli olur — çağıran
   * önce `consolidate` (bkz. `lib/sepet.ts`) ile tekilleştirmeli.
   */
  addMany: (recipe: string, incoming: GroceryInput[]) => void;
  /** Tek malzeme: bu tarif onu sepete koyduysa çıkarır, koymadıysa koyar. */
  toggleOne: (recipe: string, item: GroceryInput) => void;
  /** Satırı bütün kaynaklarıyla siler — yalnızca sepet ekranındaki çarpı. */
  remove: (slug: string) => void;
  /** Bir tarifin bütün payını geri alır; başka tariflerden gelenler kalır. */
  removeRecipe: (recipe: string) => void;
  toggleBought: (slug: string) => void;
  /** Alışveriş bitti: alınanlar listeden düşsün, kalanlar dursun. */
  clearBought: () => void;
  clear: () => void;
}

function addSource(items: GroceryItem[], recipe: string, line: GroceryInput): GroceryItem[] {
  const { slug, grams, label } = line;
  const index = items.findIndex((i) => i.slug === slug);
  if (index === -1) {
    return [
      ...items,
      { slug, label, sources: [{ recipe, grams }], bought: false, addedAt: Date.now() },
    ];
  }

  const item = items[index];
  const at = item.sources.findIndex((s) => s.recipe === recipe);
  const sources =
    at === -1
      ? [...item.sources, { recipe, grams }]
      : item.sources.map((s, k) => (k === at ? { recipe, grams } : s));

  const next = [...items];
  // Yeni bir tarif için yeniden lazım olduysa "aldım" işareti kalkıyor:
  // dünkü çorbaya aldığın maydanoz bugünkü salataya yetmeyebilir.
  next[index] = { ...item, sources, bought: at === -1 ? false : item.bought };
  return next;
}

function dropSource(items: GroceryItem[], recipe: string, slug: string): GroceryItem[] {
  return items.flatMap((item) => {
    if (item.slug !== slug) return [item];
    const sources = item.sources.filter((s) => s.recipe !== recipe);
    return sources.length ? [{ ...item, sources }] : [];
  });
}

export const useGrocery = create<GroceryState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,

      addMany: (recipe, incoming) =>
        set((s) => ({
          items: incoming.reduce((acc, line) => addSource(acc, recipe, line), s.items),
        })),

      toggleOne: (recipe, line) =>
        set((s) => {
          const mine = s.items.some(
            (i) => i.slug === line.slug && i.sources.some((x) => x.recipe === recipe),
          );
          return {
            items: mine
              ? dropSource(s.items, recipe, line.slug)
              : addSource(s.items, recipe, line),
          };
        }),

      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),

      removeRecipe: (recipe) =>
        set((s) => ({
          items: s.items.flatMap((item) => {
            const sources = item.sources.filter((x) => x.recipe !== recipe);
            return sources.length ? [{ ...item, sources }] : [];
          }),
        })),

      toggleBought: (slug) =>
        set((s) => ({
          items: s.items.map((i) => (i.slug === slug ? { ...i, bought: !i.bought } : i)),
        })),

      clearBought: () => set((s) => ({ items: s.items.filter((i) => !i.bought) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'tatbilim-grocery',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      /**
       * Sürüm 0'da satır `{ slug, grams, from[] }` biçimindeydi: tek toplam
       * gram ve tarif adları ayrı. Hangi tarifin ne kadar koyduğu bilinmiyor,
       * o yüzden toplam ilk tarife yazılıyor — sayı doğru kalıyor, yalnızca
       * kaynak dağılımı kabalaşıyor.
       */
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as { items: GroceryItem[] };
        const old = (persisted ?? {}) as {
          items?: { slug: string; grams: number; from?: string[] }[];
        };
        return {
          items: (old.items ?? []).map((i, k) => ({
            slug: i.slug,
            sources: [{ recipe: i.from?.[0] ?? 'Listen', grams: i.grams }],
            bought: false,
            addedAt: k,
          })),
        };
      },
      partialize: (s) => ({ items: s.items }) as GroceryState,
      onRehydrateStorage: () => () => useGrocery.setState({ hydrated: true }),
    },
  ),
);
