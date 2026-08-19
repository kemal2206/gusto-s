/**
 * Yemek kitabının birleşik görünümü.
 *
 * Kitap üç kaynaktan besleniyor ve ekran bunların üçünü ayrı ayrı bilmek
 * zorunda kalmasın diye burada tek listede toplanıyor:
 *
 *  - `useFavorites` — her karttaki yer imi düğmesiyle kaydedilen tarifler
 *  - `useCookbook`  — sosyal medya videoları ve kullanıcının kendi tarifleri
 *  - `useCookbook.cooked` + `useHistory` — pişirdim işaretleri
 *
 * Bölümler otomatik: kaydedilenin cinsine göre (tatlı, kebap, börek…).
 * Boş bölüm gösterilmiyor, sıra `DISH_CATEGORIES` sırası.
 */

import { useMemo } from 'react';

import { DISH_CATEGORIES, RECIPE_BY_SLUG, type Recipe } from '@/data/recipes';
import type { CookbookItem, RecipeItem } from '@/lib/cookbook/types';
import { useCookbook } from '@/lib/store/cookbook';
import { useFavorites } from '@/lib/store/favorites';

export * from './types';
export * from './video';

export interface CookbookSection {
  id: string;
  labelTr: string;
  emoji: string;
  items: CookbookItem[];
}

export interface CookedEntry {
  item: CookbookItem;
  at: number;
  count: number;
}

export interface CookbookView {
  hydrated: boolean;
  all: CookbookItem[];
  sections: CookbookSection[];
  /** Pişirilenler — en yeni önce. */
  cooked: CookedEntry[];
  counts: { tarif: number; video: number; kendi: number };
}

/** Bir kitap içeriğinin karşılık geldiği uygulama tarifi (varsa). */
export function recipeOf(item: CookbookItem): Recipe | undefined {
  return item.kind === 'tarif' ? RECIPE_BY_SLUG.get(item.recipeSlug) : undefined;
}

export function useCookbookItems(): CookbookView {
  const savedSlugs = useFavorites((s) => s.slugs);
  const favHydrated = useFavorites((s) => s.hydrated);
  const items = useCookbook((s) => s.items);
  const cookedMap = useCookbook((s) => s.cooked);
  const bookHydrated = useCookbook((s) => s.hydrated);

  return useMemo(() => {
    // Kaydedilen tarifler kitap içeriğine çevriliyor. Kategori tarifin
    // kendisinden geliyor — tahmine gerek yok.
    const fromFavorites: RecipeItem[] = savedSlugs.flatMap((slug) => {
      const recipe = RECIPE_BY_SLUG.get(slug);
      if (!recipe) return [];
      const cooked = cookedMap[slug];
      return [
        {
          id: `tarif:${slug}`,
          kind: 'tarif' as const,
          recipeSlug: slug,
          categoryId: recipe.categoryId,
          // Favori deposu zaman tutmuyor; sıra zaten yeniden eskiye.
          addedAt: 0,
          cookedAt: cooked?.at,
          cookCount: cooked?.count ?? 0,
        },
      ];
    });

    /**
     * Pişirilmiş ama kaydedilmemiş tarifler de kitapta görünmeli: "bunu
     * pişirdim" demek en az yer imi kadar güçlü bir sahiplenme.
     */
    const savedSet = new Set(savedSlugs);
    const fromCooked: RecipeItem[] = Object.entries(cookedMap)
      .filter(([slug]) => !savedSet.has(slug) && RECIPE_BY_SLUG.has(slug))
      .map(([slug, c]) => ({
        id: `tarif:${slug}`,
        kind: 'tarif' as const,
        recipeSlug: slug,
        categoryId: RECIPE_BY_SLUG.get(slug)?.categoryId ?? null,
        addedAt: c.at,
        cookedAt: c.at,
        cookCount: c.count,
      }));

    const all: CookbookItem[] = [...items, ...fromFavorites, ...fromCooked];

    const byCategory = new Map<string, CookbookItem[]>();
    for (const item of all) {
      const key = item.categoryId ?? 'diger';
      const list = byCategory.get(key);
      if (list) list.push(item);
      else byCategory.set(key, [item]);
    }

    const sections: CookbookSection[] = DISH_CATEGORIES.flatMap((c) => {
      const list = byCategory.get(c.id);
      return list?.length ? [{ id: c.id, labelTr: c.labelTr, emoji: c.emoji, items: list }] : [];
    });

    const other = byCategory.get('diger');
    if (other?.length) sections.push({ id: 'diger', labelTr: 'Diğer', emoji: '📌', items: other });

    const cooked: CookedEntry[] = all
      .filter((i) => i.cookedAt)
      .map((i) => ({ item: i, at: i.cookedAt!, count: i.cookCount }))
      .sort((a, b) => b.at - a.at);

    return {
      hydrated: favHydrated && bookHydrated,
      all,
      sections,
      cooked,
      counts: {
        tarif: fromFavorites.length + fromCooked.length,
        video: items.filter((i) => i.kind === 'video').length,
        kendi: items.filter((i) => i.kind === 'kendi').length,
      },
    };
  }, [savedSlugs, items, cookedMap, favHydrated, bookHydrated]);
}

/** "3 gün önce", "dün" — pişirme zaman çizelgesi için. */
export function relativeDay(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}
