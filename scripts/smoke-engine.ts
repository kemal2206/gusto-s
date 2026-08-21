/**
 * Motor duman testi — Lezzet Lab zincirini terminalde yürütür.
 *
 *   npm run smoke
 *
 * Her adımda motorun ürettiği adayları ve **neden** üretildiğini (zincir bağını)
 * basıyor. Bağsız aday hiç görünmemeli; görünürse `requireLink` kapısı bozuk.
 */

import { CATALOG_STATS, INGREDIENTS, LOOKUP, ing } from '../src/data/catalog';
import {
  ARCHETYPES,
  CHAIN_WEIGHTS,
  dishProfile,
  findBridges,
  suggestAdditions,
  TASTE_AXES,
  TASTE_LABELS_TR,
  type DishComponent,
  type DishState,
  type SuggestionLink,
} from '../src/engine';
import { CHARACTERS, ROLE_STEPS, rolesOf } from '../src/lib/lab-flow';

console.log('\n════ KATALOG ════');
console.log(`  ${CATALOG_STATS.ingredients} malzeme`);
console.log(`  ${CATALOG_STATS.withRealCompounds} gerçek bileşik setli / ${CATALOG_STATS.withFamilyCompounds} aile tahminli`);
console.log(`  ${CATALOG_STATS.compounds} farklı bileşik · IDF ${CATALOG_STATS.idfDocuments} dokümandan`);
console.log(`  ${CATALOG_STATS.edges} eşleşme bağı (${CATALOG_STATS.classicPairs} geleneksel çift)`);

const describeLink = (l: SuggestionLink) => {
  const anchor = l.isAnchor ? '★' : ' ';
  if (l.kind === 'kimya') {
    const senses = (l.compounds ?? []).slice(0, 2).map((c) => c.senseTr || c.nameTr).join(', ');
    return `${anchor} KİMYA   ${l.withName} ile ${l.strength} ortak bileşik (${senses})`;
  }
  if (l.kind === 'gelenek') {
    return `${anchor} GELENEK ${l.withName} ile klasik eşleşme (${l.strength.toFixed(2)})`;
  }
  return `${anchor} DENGE   tat açığını ${(l.strength * 100).toFixed(0)}% kapatıyor`;
};

/** Zinciri baştan sona yürüt, her adımda en yüksek skorluyu seç. */
function walkChain(mainSlug: string, characterIndex: number) {
  const character = CHARACTERS[characterIndex];
  const archetype = ARCHETYPES[character.archetypeId];

  const picks: (DishComponent & { accompaniment?: boolean })[] = [
    { ingredient: ing(mainSlug), grams: 250, role: 'ana' },
  ];

  console.log(`\n\n════ ZİNCİR: ${ing(mainSlug).nameTr} · ${character.labelTr} ════`);
  console.log(`  hedef: ${archetype.labelTr} — odak: ${character.focusAxes.join(', ')}`);

  for (const [i, step] of ROLE_STEPS.entries()) {
    const dish: DishState = {
      components: picks.filter((p) => !p.accompaniment),
      pairedWith: picks.filter((p) => p.accompaniment),
      archetypeId: character.archetypeId,
    };
    const last = picks[picks.length - 1];

    const results = suggestAdditions(dish, INGREDIENTS, LOOKUP, {
      mode: 'benzerlik',
      weights: CHAIN_WEIGHTS,
      focusAxes: character.focusAxes,
      allowedRoles: rolesOf(step),
      anchorIngredientId: last.ingredient.id,
      doseBounds: step.slots[0].doseRange,
      fixedGrams: step.slots[0].fixedGrams,
      requireLink: true,
      limit: 4,
    });

    console.log(`\n── ${String(4 + i).padStart(2, '0')} · ${step.questionTr}`);
    console.log(`   (zincirin son halkası: ${last.ingredient.nameTr})`);

    if (!results.length) {
      console.log('   — bağlı aday yok, adım atlanır');
      continue;
    }

    for (const s of results) {
      console.log(`\n   ${s.ingredient.nameTr}  ·  ${s.suggestedGrams} g  ·  skor ${s.score.toFixed(3)}`);
      for (const l of s.links.slice(0, 3)) console.log(`       ${describeLink(l)}`);
    }

    const chosen = results[0];
    picks.push({
      ingredient: chosen.ingredient,
      grams: chosen.suggestedGrams,
      role: rolesOf(step)[0],
      accompaniment: step.accompaniment,
    });
    console.log(`\n   → seçildi: ${chosen.ingredient.nameTr}`);
  }

  // Son denge — yanına gidenler (pilav, ekmek) profile karışmıyor.
  const profile = dishProfile({ components: picks.filter((p) => !p.accompaniment) });
  console.log('\n── SON TAT DENGESİ');
  for (const axis of TASTE_AXES) {
    const now = profile[axis];
    const goal = archetype.target[axis];
    const off = now - goal;
    const mark = Math.abs(off) > archetype.tolerance ? (off > 0 ? ' ← fazla' : ' ← az') : '';
    const bar = '█'.repeat(Math.round(now)) + '·'.repeat(10 - Math.round(now));
    console.log(
      `   ${TASTE_LABELS_TR[axis].padEnd(14)} ${bar} ${now.toFixed(1)} / hedef ${goal.toFixed(1)}${mark}`,
    );
  }

  console.log('\n── TABAK');
  for (const p of picks) {
    console.log(`   ${p.ingredient.nameTr.padEnd(22)} ${String(p.grams).padStart(5)} g   ${p.role}`);
  }
}

walkChain('kuzu-but', 0); // doyurucu ve derin
walkChain('levrek', 1); // hafif ve ferah

// ── Bağlayıcı (köprü) ────────────────────────────────────────────────
console.log('\n\n════ BAĞLAYICI ARAMA ════');
console.log('   Antrikot ↔ yaban mersini arasını ne bağlar?\n');

for (const b of findBridges(
  ing('dana-antrikot'),
  ing('yaban-mersini'),
  INGREDIENTS,
  LOOKUP,
  { minLink: 0.1, limit: 5 },
)) {
  console.log(
    `   ${b.ingredient.nameTr.padEnd(20)} köprü ${b.score.toFixed(3)}` +
      `  (antrikot ${b.toA.toFixed(2)}/${b.sharedWithA} · yaban mersini ${b.toB.toFixed(2)}/${b.sharedWithB})`,
  );
}

console.log('');
