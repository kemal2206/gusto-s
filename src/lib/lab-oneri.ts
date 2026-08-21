/**
 * Lab'in aday üretimi — tek nüsha.
 *
 * Bu mantık önce `lab.tsx` içinde duruyordu. Dışarı çıkarmasının sebebi
 * `scripts/denetim-oneri.ts`: denetim, uygulamanın **gerçekten çalıştırdığı**
 * kodu ölçmek zorunda. Kopyasını ölçen bir denetim hiçbir şey söylemez —
 * kopya ile asıl birbirinden ayrıldığı anda sessizce yanlış rapor verir.
 *
 * ── Üç katman ──────────────────────────────────────────────────────
 *
 *  1. **Yuva yuva sorma.** Her rolün doz aralığı farklı; baharat binde iki
 *     ile yüzde iki, aromatik yüzde beş ile otuz arasında. Tek aralık
 *     verilirse biri için "2 g soğan", diğeri için "60 g kimyon" çıkıyor.
 *  2. **Uyum vetosu.** Ana malzemenin kurduğu türden yemeklerde görülmeyen
 *     malzeme listeye hiç girmiyor (`uyum.ts`).
 *  3. **Tekilleştirme.** Aynı malzeme iki yuvadan gelebiliyor; aynı
 *     akrabalık grubundan birden fazlası listeyi dolduruyor (süzme yoğurt,
 *     labne, yoğurt yan yana).
 */

import { AHN_INGREDIENT_ID } from '@/data/catalog/ahn-eslesme';
import { BY_SLUG, INGREDIENTS, LOOKUP } from '@/data/catalog';
import { uyumFor } from '@/data/catalog/uyum';
import type { DishState, Ingredient, IngredientRole, Suggestion, TasteAxis } from '@/engine';
import { CHAIN_WEIGHTS, suggestAdditions } from '@/engine';
import type { RoleStep } from '@/lib/lab-flow';

export interface StepSuggestion extends Suggestion {
  /** Hangi rol yuvasından geldi — seçilince bu rol yazılıyor. */
  slotRole: IngredientRole;
}

export interface StepPickLite {
  role: IngredientRole;
}

/**
 * Ana malzemeye göre veto ve geri plan listeleri.
 *
 * Kardeş parçalar da veto: antrikot seçildikten sonra listede "dana kıyma"
 * çıkıyordu. İstatistik haklı (dana tariflerinde dana eti geçer) ama tabakta
 * aynı hayvanın iki ayrı parçası olmaz.
 */
export function uyumIds(cuisine: string, mainSlug: string | undefined) {
  if (!mainSlug) return { veto: [] as number[], demote: [] as number[] };

  const u = uyumFor(cuisine, mainSlug);
  const ahnId = AHN_INGREDIENT_ID[mainSlug];
  const siblings =
    ahnId === undefined
      ? []
      : INGREDIENTS.filter((i) => i.slug !== mainSlug && AHN_INGREDIENT_ID[i.slug] === ahnId).map(
          (i) => i.id,
        );

  const ids = (slugs: string[] | undefined) =>
    (slugs ?? []).flatMap((s) => {
      const i = BY_SLUG.get(s);
      return i ? [i.id] : [];
    });

  return { veto: [...siblings, ...ids(u?.v)], demote: ids(u?.d) };
}

export interface SuggestStepInput {
  dish: DishState;
  step: RoleStep;
  /** Bu adımda şimdiye kadar seçilenler — rol sınırı için. */
  stepPicks: StepPickLite[];
  mainSlug?: string;
  cuisine?: string;
  focusAxes?: TasteAxis[];
  anchorIngredientId?: number;
  limit?: number;
  /** Ağırlık taraması için — normalde `CHAIN_WEIGHTS` geçerli. */
  weights?: typeof CHAIN_WEIGHTS;
}

export function suggestForStep(input: SuggestStepInput): StepSuggestion[] {
  const { dish, step, stepPicks, mainSlug, cuisine = 'tr', focusAxes, anchorIngredientId } = input;
  const { veto, demote } = uyumIds(cuisine, mainSlug);

  const out: StepSuggestion[] = [];
  for (const slot of step.slots) {
    const used = stepPicks.filter((p) => p.role === slot.role).length;
    if (used >= slot.max) continue;

    const res = suggestAdditions(dish, INGREDIENTS, LOOKUP, {
      mode: 'benzerlik',
      weights: input.weights ?? CHAIN_WEIGHTS,
      focusAxes,
      allowedRoles: [slot.role],
      anchorIngredientId,
      doseBounds: slot.doseRange,
      fixedGrams: slot.fixedGrams,
      excludeIngredientIds: veto,
      demoteIngredientIds: demote,
      requireLink: true,
      limit: 4,
    });
    for (const r of res) out.push({ ...r, slotRole: slot.role });
  }

  const seenId = new Set<number>();
  const seenKin = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      if (seenId.has(r.ingredient.id)) return false;
      const kin = (r.ingredient as Ingredient).kin;
      if (kin && seenKin.has(kin)) return false;
      seenId.add(r.ingredient.id);
      if (kin) seenKin.add(kin);
      return true;
    })
    .slice(0, input.limit ?? 8);
}
