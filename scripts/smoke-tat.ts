/**
 * Ev ölçüsü yuvarlamasının tada etkisi.
 *
 *   npm run smoke:tat
 *
 * Ev ölçüsü göstermek bedava değil: "83 g soğan"a "1 adet" demek, kullanıcının
 * 110 g soğan koyması demek. Tek başına zararsız, ama aynı anda tuz da, salça
 * da, limon da yuvarlanıyor. Soru şu: **birikmiş sapma tadı bozacak kadar
 * büyük mü?**
 *
 * Ölçüm yöntemi motorun kendi matematiği:
 *
 *   tabağın tat profili = Σ(gram × potency × tat) / Σ(gram × potency)
 *
 * İki profil hesaplıyoruz — tarifin yazdığı gramlarla ve kullanıcının ev
 * ölçüsünü uygulayınca çıkan gramlarla — ve eksen başına farka bakıyoruz.
 *
 * **Eşik nereden geliyor?** Tat algısında Weber oranı yaklaşık %15–25'tir:
 * tuzu %20 artırmadan çoğu insan farkı ayırt edemiyor. Nominal sınırı bunun
 * yarısında tutuyoruz — 0–10 ölçeğinde **0,35 eksen puanı**. Bu, fark edilir
 * eşiğin belirgin biçimde altında; yani bu sınırın altındaki sapma "tarif
 * bozuldu" demek değil.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import { measureTolerances, toHouseholdMeasure } from '../src/data/catalog/ev-olcusu.ts';
import { RECIPES, type Recipe } from '../src/data/recipes/index.ts';
import { TASTE_AXES, TASTE_LABELS_TR, ZERO_TASTE } from '../src/engine/types.ts';
import type { TasteAxis, TasteVector } from '../src/engine/types.ts';

const BY_SLUG = new Map(INGREDIENTS.map((i) => [i.slug, i]));

/** Eksen başına nominal sınır — algı eşiğinin yarısı. */
const AXIS_LIMIT = 0.35;

/**
 * Kullanıcı ev ölçüsünü uygularsa kaç gram koyar?
 *
 * Ölçü verilmediyse tarifin gramını tartıyla koyduğunu varsayıyoruz; verildiyse
 * ölçünün karşılığını koyuyor — yuvarlama farkı tam olarak burada doğuyor.
 */
function toleranceFor(recipe: Recipe): Map<string, number> {
  const lines = recipe.components.flatMap((c) =>
    c.ingredients.flatMap((ri) => {
      const ing = BY_SLUG.get(ri.slug);
      return ing ? [{ slug: ri.slug, grams: ri.grams, potency: ing.potency, taste: ing.taste }] : [];
    }),
  );
  return measureTolerances(lines);
}

function cookedGrams(slug: string, category: string, grams: number, drift?: number): number {
  const m = toHouseholdMeasure(slug, category, grams, drift);
  return m ? m.appliedGrams : grams;
}

function profileOf(recipe: Recipe, applyMeasures: boolean, tol?: Map<string, number>): TasteVector {
  const acc: TasteVector = { ...ZERO_TASTE };
  let total = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      const ing = BY_SLUG.get(ri.slug);
      if (!ing) continue;

      const g = applyMeasures
        ? cookedGrams(ri.slug, ing.category, ri.grams, tol?.get(ri.slug))
        : ri.grams;
      const w = g * ing.potency;
      if (w <= 0) continue;

      total += w;
      for (const axis of TASTE_AXES) acc[axis] += ing.taste[axis] * w;
    }
  }

  if (total > 0) for (const axis of TASTE_AXES) acc[axis] /= total;
  return acc;
}

interface Offender {
  recipe: string;
  axis: TasteAxis;
  shift: number;
  /** En çok kayan malzeme ve gram farkı. */
  culprit: string;
}

const offenders: Offender[] = [];
let worstByAxis: Record<string, number> = {};

for (const recipe of RECIPES) {
  const tol = toleranceFor(recipe);
  const exact = profileOf(recipe, false);
  const cooked = profileOf(recipe, true, tol);

  let worstAxis: TasteAxis = 'salty';
  let worstShift = 0;

  for (const axis of TASTE_AXES) {
    const shift = Math.abs(cooked[axis] - exact[axis]);
    // Malzemesi tanınmayan tarifte profil hesaplanamıyor; sayımı bozmasın.
    if (!Number.isFinite(shift)) continue;
    if (shift > worstShift) {
      worstShift = shift;
      worstAxis = axis;
    }
    worstByAxis[axis] = Math.max(worstByAxis[axis] ?? 0, shift);
  }

  if (worstShift > AXIS_LIMIT) {
    // Kaymadan en çok sorumlu malzemeyi bul.
    let culprit = '';
    let worstDelta = 0;
    for (const c of recipe.components) {
      for (const ri of c.ingredients) {
        const ing = BY_SLUG.get(ri.slug);
        if (!ing) continue;
        const g = cookedGrams(ri.slug, ing.category, ri.grams, tol.get(ri.slug));
        const delta = Math.abs(g - ri.grams) * ing.potency * ing.taste[worstAxis];
        if (delta > worstDelta) {
          worstDelta = delta;
          culprit = `${ing.nameTr} ${ri.grams}→${Math.round(g)} g`;
        }
      }
    }
    offenders.push({ recipe: recipe.title, axis: worstAxis, shift: worstShift, culprit });
  }
}

// ── Rapor ──────────────────────────────────────────────────────────

console.log('\n════ EV ÖLÇÜSÜ YUVARLAMASININ TADA ETKİSİ');
console.log(`  tarif sayısı:        ${RECIPES.length}`);
console.log(`  nominal sınır:       ${AXIS_LIMIT} eksen puanı (0–10 ölçeğinde)`);
console.log(`  sınırı aşan tarif:   ${offenders.length} (%${((offenders.length / RECIPES.length) * 100).toFixed(1)})`);

console.log('\n── EKSEN BAŞINA EN BÜYÜK KAYMA');
for (const axis of TASTE_AXES) {
  const v = worstByAxis[axis] ?? 0;
  const bar = '█'.repeat(Math.min(30, Math.round(v * 20)));
  console.log(`  ${TASTE_LABELS_TR[axis].padEnd(14)} ${v.toFixed(3)} ${bar}`);
}

if (offenders.length) {
  console.log('\n── EN KÖTÜ 12 TARİF');
  for (const o of offenders.sort((a, b) => b.shift - a.shift).slice(0, 12)) {
    console.log(
      `  ${o.shift.toFixed(2)}  ${TASTE_LABELS_TR[o.axis].padEnd(13)} ${o.recipe.slice(0, 34).padEnd(36)} ${o.culprit}`,
    );
  }
}

const ok = offenders.length / RECIPES.length <= 0.02;
console.log(
  ok
    ? `\n✓ Tariflerin %${(100 - (offenders.length / RECIPES.length) * 100).toFixed(1)}'i nominal sınırın altında\n`
    : `\n✗ %${((offenders.length / RECIPES.length) * 100).toFixed(1)} tarif sınırı aşıyor — yuvarlama fazla gevşek\n`,
);
process.exit(ok ? 0 : 1);
