/**
 * Lab önerilerinin bütün ana malzemelerde denetimi.
 *
 *   npm run denetim:oneri
 *   npm run denetim:oneri -- --detay     bozuk vakaları tek tek bas
 *   npm run denetim:oneri -- --tara      ağırlık taraması
 *
 * ── Neden ──────────────────────────────────────────────────────────
 *
 * Bozuk öneriler şimdiye kadar tek tek bildirildi: antrikota tarhana,
 * levreğe elma ve şeftali, kremalı levreğe salça. Her seferinde o vaka
 * düzeltildi ve "çözüldü" dendi — ama sınıf devam etti, çünkü **tek vakaya
 * bakarak sınıfı ölçemezsiniz.** Levrek düzeltilirken antrikot iyi
 * görünüyordu; antrikot düzeltilirken levrek bozuktu.
 *
 * Bu betik kataloğun tamamını tarıyor: her ana malzeme × her tat hedefi,
 * hem ana yemek hem sos bileşeni, Lab'in gerçekten göstereceği listeyle.
 *
 * ── Ölçülen iki şey ────────────────────────────────────────────────
 *
 * **Zararlı öneri.** Motor bir adayın tabağı arketip hedefine yaklaştırıp
 * yaklaştırmadığını zaten hesaplıyor. Uzaklaştırdığı hâlde ilk üçe giren
 * her aday bir kusur.
 *
 * **Bağ gücü — karşı ölçüt.** Denge ağırlığını tek başına artırmak zararlı
 * öneriyi azaltır ama kimyasal bağı zayıf adayları öne çıkarır; Lab'in
 * bütün iddiası "gerekçesiz seçenek göstermemek". O yüzden ilk üçün
 * ortalama aroma + gelenek bağı da ölçülüyor. İyi bir ağırlık ikisini
 * birden idare eder, birini diğerine feda etmez.
 *
 * Denetim `lab-oneri.ts`'i çağırıyor — uygulamanın gerçekten çalıştırdığı
 * kodu ölçüyor, kopyasını değil.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import { ARCHETYPES, CHAIN_WEIGHTS, evaluateBalance } from '../src/engine/index.ts';
import type { ArchetypeId, DishState, Ingredient, ScoreWeights, TasteAxis } from '../src/engine/index.ts';
import { COMPONENT_PLANS, TASTES, planFor, type RoleStep } from '../src/lib/lab-flow.ts';
import { suggestForStep } from '../src/lib/lab-oneri.ts';

const detail = process.argv.includes('--detay');
const sweep = process.argv.includes('--tara');

/** Lab'in ilk adımında ana malzeme olarak gösterilen kategoriler. */
const MAIN_CATEGORIES = new Set([
  'protein', 'deniz', 'sebze', 'mantar', 'baklagil', 'tahil', 'sarkuteri',
]);
const mains = INGREDIENTS.filter((i) => MAIN_CATEGORIES.has(i.category));

/** Her tat için bir temsilci gövde yeter; gövde yöntemi belirliyor, hedefi değil. */
const combos = TASTES.map((t) => ({
  taste: t,
  plan: planFor(t.id, t.hideBody?.includes('doyurucu') ? 'ateste' : 'doyurucu'),
})).filter((c) => Boolean(c.plan));

interface Bad {
  main: string;
  taste: string;
  step: string;
  cand: string;
  rank: number;
  before: number;
  after: number;
}

interface Result {
  bad: Bad[];
  top3: number;
  steps: number;
  thin: number;
  /** İlk üçün ortalama aroma + gelenek bağı — karşı ölçüt. */
  avgLink: number;
}

type Pick = { ingredient: Ingredient; grams: number; role: never };

interface Walk {
  steps: RoleStep[];
  archetypeId: ArchetypeId;
  seed: Pick[];
  pairedWith: Pick[];
  prefix: string;
  mainSlug: string;
  mainName: string;
  tasteName: string;
  focusAxes: TasteAxis[];
  anchorId: number;
}

function run(weights: ScoreWeights): Result {
  const bad: Bad[] = [];
  let top3 = 0;
  let steps = 0;
  let thin = 0;
  let linkSum = 0;
  let linkN = 0;

  /** Bir bileşenin adımlarını yürüt, her adımda ilk üçü denetle. */
  const walk = (w: Walk): Pick[] => {
    const picks: Pick[] = [...w.seed];
    const arch = ARCHETYPES[w.archetypeId];

    for (const step of w.steps) {
      const dish: DishState = {
        components: picks as never,
        pairedWith: w.pairedWith as never,
        archetypeId: w.archetypeId,
      };

      const res = suggestForStep({
        dish,
        step,
        stepPicks: [],
        mainSlug: w.mainSlug,
        cuisine: 'tr',
        focusAxes: w.focusAxes,
        anchorIngredientId: picks[picks.length - 1]?.ingredient.id ?? w.anchorId,
        limit: 6,
        weights,
      });

      steps += 1;
      if (res.length < 2) {
        thin += 1;
        continue;
      }

      for (const [rank, r] of res.slice(0, 3).entries()) {
        top3 += 1;
        /**
         * Gerekçenin gücü. `links` boş olamaz (bağsız aday üretilmiyor);
         * kimya ve gelenek bağlarının en güçlüsünü alıyoruz. Tat bağı
         * sayılmıyor — zaten ölçtüğümüz şey onun doğru yönde olup olmadığı.
         */
        const strongest = r.links.reduce(
          (m, l) =>
            l.kind === 'tat'
              ? m
              : Math.max(m, l.kind === 'gelenek' ? l.strength : Math.min(1, l.strength / 30)),
          0,
        );
        linkSum += strongest;
        linkN += 1;

        const ev = evaluateBalance(
          dish,
          { target: arch.target, tolerance: arch.tolerance },
          r.ingredient,
          r.suggestedGrams,
        );
        if (ev.distanceAfter > ev.distanceBefore + 0.02) {
          bad.push({
            main: w.mainName,
            taste: w.tasteName,
            step: w.prefix + step.id,
            cand: r.ingredient.nameTr,
            rank: rank + 1,
            before: ev.distanceBefore,
            after: ev.distanceAfter,
          });
        }
      }

      const top = res[0];
      if (top) {
        picks.push({ ingredient: top.ingredient, grams: top.suggestedGrams, role: top.slotRole as never });
      }
    }
    return picks;
  };

  for (const main of mains) {
    for (const { taste, plan } of combos) {
      if (!plan) continue;
      const base = {
        mainSlug: main.slug,
        mainName: main.nameTr,
        tasteName: taste.labelTr,
        focusAxes: plan.focusAxes,
        anchorId: main.id,
      };

      const mainPicks = walk({
        ...base,
        steps: COMPONENT_PLANS.ana.steps,
        archetypeId: plan.mainArchetype,
        seed: [{ ingredient: main, grams: 250, role: 'ana' as never }],
        pairedWith: [],
        prefix: '',
      });

      /**
       * Sos bileşeni. Kullanıcının bildirdiği vaka buradaydı ve denetimin
       * ilk hâli sosu hiç taramıyordu — ana yemekte kusur oranı %0,1
       * çıkıyor, sos eklenince %2,4'e fırlıyordu.
       */
      if (!plan.sauceArchetype) continue;
      walk({
        ...base,
        steps: COMPONENT_PLANS.sos.steps,
        archetypeId: plan.sauceArchetype,
        seed: [],
        // Ana yemek yanında duruyor: sosun hedefi onun yağına göre kayıyor.
        pairedWith: mainPicks,
        prefix: 'sos:',
      });
    }
  }

  return { bad, top3, steps, thin, avgLink: linkN ? linkSum / linkN : 0 };
}

// ── Koşum ──────────────────────────────────────────────────────────

if (sweep) {
  /**
   * Ağırlık adayları. Denge artarken aroma ve gelenek azalıyor; rol payı
   * sabit çünkü zaten küçük ve yalnızca boş rolü doldurmak için var.
   */
  const grid: { ad: string; w: ScoreWeights }[] = [
    { ad: 'mevcut', w: { aroma: 0.3, balance: 0.27, prior: 0.33, role: 0.1 } },
    { ad: 'denge+', w: { aroma: 0.27, balance: 0.35, prior: 0.28, role: 0.1 } },
    { ad: 'denge++', w: { aroma: 0.24, balance: 0.43, prior: 0.23, role: 0.1 } },
    { ad: 'denge+++', w: { aroma: 0.2, balance: 0.52, prior: 0.18, role: 0.1 } },
    { ad: 'gelenek-', w: { aroma: 0.32, balance: 0.4, prior: 0.18, role: 0.1 } },
  ];

  console.log('\n════ AĞIRLIK TARAMASI ════');
  console.log('  ağırlık     aroma denge gelenek    zararlı öneri    ortalama bağ');
  for (const g of grid) {
    const r = run(g.w);
    const pct = (r.bad.length / Math.max(1, r.top3)) * 100;
    console.log(
      `  ${g.ad.padEnd(10)}  ${g.w.aroma.toFixed(2)}  ${g.w.balance.toFixed(2)}   ${g.w.prior.toFixed(2)}` +
        `      %${pct.toFixed(2).padStart(5)} (${String(r.bad.length).padStart(4)})` +
        `       ${r.avgLink.toFixed(3)}`,
    );
  }
  console.log(
    '\n  Zararlı öneri düşsün ama ortalama bağ çökmesin: Lab\'in iddiası\n' +
      '  "gerekçesiz seçenek göstermemek", bağ o gerekçenin gücü.\n',
  );
} else {
  const r = run(CHAIN_WEIGHTS);
  console.log('\n════ LAB ÖNERİ DENETİMİ ════');
  console.log(`  ana malzeme:      ${mains.length}`);
  console.log(`  tat hedefi:       ${combos.length}`);
  console.log(`  taranan adım:     ${r.steps}`);
  console.log(`  adayı yetersiz:   ${r.thin}`);
  console.log(`  incelenen ilk-3:  ${r.top3}`);
  console.log('');
  console.log(
    `  HEDEFTEN UZAKLAŞTIRAN: ${r.bad.length}  (%${((r.bad.length / Math.max(1, r.top3)) * 100).toFixed(2)})`,
  );
  console.log(`  ortalama aroma/gelenek bağı: ${r.avgLink.toFixed(3)}`);

  const byRank = [1, 2, 3].map((k) => r.bad.filter((b) => b.rank === k).length);
  console.log(`    1. sırada ${byRank[0]} · 2. sırada ${byRank[1]} · 3. sırada ${byRank[2]}`);

  const byStep = new Map<string, number>();
  for (const b of r.bad) byStep.set(b.step, (byStep.get(b.step) ?? 0) + 1);
  console.log('\n  ADIMA GÖRE:');
  for (const [s, n] of [...byStep].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(16)} ${n}`);
  }

  const byCand = new Map<string, number>();
  for (const b of r.bad) byCand.set(b.cand, (byCand.get(b.cand) ?? 0) + 1);
  console.log('\n  EN ÇOK YANLIŞ ÖNERİLEN 12:');
  for (const [c, n] of [...byCand].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${String(n).padStart(4)}×  ${c}`);
  }

  /**
   * Eşik bir sözleşme: bugünkü oran %0,71 ve bu ölçülerek elde edildi.
   * %1,5'e tırmanırsa bir gerileme var demektir — ya ağırlıklar değişmiş
   * ya uyum tablosu bozulmuş ya yeni bir arketip hedefi tutarsız.
   */
  const pct = (r.bad.length / Math.max(1, r.top3)) * 100;
  const ok = pct <= 1.5 && r.avgLink >= 0.6;
  console.log(
    `
  ${ok ? '✓' : '✗'} eşik: zararlı ≤%1,5 (şu an %${pct.toFixed(2)}) · ` +
      `bağ ≥0,60 (şu an ${r.avgLink.toFixed(3)})`,
  );

  if (detail) {
    console.log('\n  EN KÖTÜ 25 VAKA:');
    for (const b of [...r.bad].sort((x, y) => y.after - y.before - (x.after - x.before)).slice(0, 25)) {
      console.log(
        `    ${b.main.padEnd(16)} ${b.taste.padEnd(18)} ${b.step.padEnd(16)} ` +
          `${b.rank}. ${b.cand.padEnd(18)} ${b.before.toFixed(2)} → ${b.after.toFixed(2)}`,
      );
    }
  }
  console.log('');
  process.exit(ok ? 0 : 1);
}
