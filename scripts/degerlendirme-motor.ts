/**
 * Motorun önerisi ne kadar isabetli — birini-dışarıda-bırak sınavı.
 *
 *   npm run degerlendirme:motor
 *   npm run degerlendirme:motor -- --adet 800
 *
 * ── Soru ───────────────────────────────────────────────────────────
 *
 * "Motor iyi öneriyor mu?" sorusunun şimdiye kadar cevabı yoktu; adayların
 * makul görünmesine bakıyorduk. Bu ölçülebilir bir soruya çevriliyor:
 *
 *   Gerçek bir tariften bir malzemeyi çıkar, motora kalanını ver.
 *   Çıkardığın malzemeyi ilk kaç aday içinde geri getiriyor?
 *
 * Tarif gerçek, yani "doğru cevap" biliniyor. Bu, tavsiye sistemlerinde
 * standart olan hold-one-out değerlendirmesi ve recall@k ile ölçülüyor.
 *
 * ── Neyi ölçer, neyi ölçmez ────────────────────────────────────────
 *
 * ÖLÇER    kültürel önselin işe yarayıp yaramadığını. Üç koşul ayrı ayrı
 *          koşuluyor: yalnız kimya, kimya + elle kürate edilmiş 388 çift,
 *          kimya + kürasyon + korpustan hesaplanan NPMI. Aradaki fark
 *          önselin katkısıdır.
 *
 * ÖLÇMEZ   yaratıcılığı. Lab'ın amacı zaten tarifte olmayan kombinasyonlar
 *          kurdurmak; korpusu birebir taklit eden bir motor iyi değil,
 *          ezberci olurdu. Bu yüzden recall@k'nın %100'e çıkması hedef
 *          DEĞİL — hedef, önsel eklendiğinde artması.
 */

import {
  createPairingIndex,
  lookupFromIndex,
  suggestAdditions,
  type DishComponent,
  type DishState,
  type Ingredient,
  type PairingEdge,
} from '../src/engine/index.ts';
import { BY_SLUG, INGREDIENTS, PAIRING_EDGES } from '../src/data/catalog/index.ts';
import { CLASSIC_PAIRS } from '../src/data/catalog/gelenek.ts';
import { RECIPES } from '../src/data/recipes/index.ts';

const argN = process.argv.indexOf('--adet');
const SAMPLE = argN > -1 ? Number(process.argv[argN + 1]) : 500;
const AROMA_FLOOR = 0.02;

/**
 * Ölçümde kullanılacak ağırlıklar.
 *
 * Varsayılan `PRESETS.denge`; `--agirlik a,b,p,r` ile değiştirilebiliyor.
 * Lab'in `CHAIN_WEIGHTS` değerini ayarlarken bu ölçütün ne kadar
 * etkilendiğini görmek gerekiyor — denge payını artırıp gelenek payını
 * kısmak zararlı öneriyi azaltıyor ama motorun mutfak bilgisini de
 * zayıflatabilir. İkisi birlikte bakılmadan karar verilemez.
 */
const wAt = process.argv.indexOf('--agirlik');
const WEIGHTS =
  wAt > -1
    ? (() => {
        const [aroma, balance, prior, role] = process.argv[wAt + 1].split(',').map(Number);
        return { aroma, balance, prior, role };
      })()
    : undefined;

// ── Üç koşulun arama tabloları ─────────────────────────────────────

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Elle kürate edilmiş çiftlerin kenar anahtarları. */
const handKeys = new Set<string>();
for (const [sa, sb] of CLASSIC_PAIRS) {
  const a = BY_SLUG.get(sa);
  const b = BY_SLUG.get(sb);
  if (a && b) handKeys.add(pairKey(a.id, b.id));
}

/**
 * Önselsiz kenar listesi. Yalnızca önsel yüzünden var olan kenarlar
 * (aroma skoru eşiğin altında olanlar) tamamen düşüyor — o kenar zaten
 * kimyadan doğmamıştı.
 */
const chemOnly: PairingEdge[] = PAIRING_EDGES.filter((e) => e.aromaScore >= AROMA_FLOOR).map(
  (e) => ({ ...e, priorNpmi: undefined, kind: 'paylasilan' as const }),
);

/** Kimya + yalnızca elle kürate edilmiş önsel. */
const chemHand: PairingEdge[] = PAIRING_EDGES.filter(
  (e) => e.aromaScore >= AROMA_FLOOR || handKeys.has(pairKey(e.aId, e.bId)),
).map((e) =>
  handKeys.has(pairKey(e.aId, e.bId)) ? e : { ...e, priorNpmi: undefined, kind: 'paylasilan' as const },
);

/**
 * **NPMI, sınav tariflerini GÖRMEDEN hesaplanıyor.**
 *
 * İlk koşumda önseli tüm korpustan alıp yine tüm korpusta sınava soktum ve
 * recall@10 %44,3 çıktı. Bu sayı şişkindi: sınavdaki tarifin kendisi de
 * istatistiğe katkı vermişti, yani motora cevabı bir yerden göstermiş
 * oluyorduk. Klasik veri sızıntısı.
 *
 * Doğrusu korpusu ikiye bölmek: NPMI yalnızca **eğitim yarısından**
 * hesaplanıyor, sınav yalnızca **test yarısından** seçiliyor. Motorun
 * hiç görmediği tarifler üzerinde ölçüyoruz.
 */
const trainIds = new Set<string>();
const testRecipes: typeof RECIPES = [];
RECIPES.forEach((r, i) => {
  if (i % 2 === 0) trainIds.add(r.slug);
  else testRecipes.push(r);
});

const MIN_CO = 8;
const coKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const singleC = new Map<string, number>();
const coC = new Map<string, number>();
let trainN = 0;
for (const r of RECIPES) {
  if (!trainIds.has(r.slug)) continue;
  trainN += 1;
  const slugs = [...new Set(r.allSlugs)].sort();
  for (const sl of slugs) singleC.set(sl, (singleC.get(sl) ?? 0) + 1);
  for (let i = 0; i < slugs.length; i += 1) {
    for (let j = i + 1; j < slugs.length; j += 1) {
      const k = coKey(slugs[i], slugs[j]);
      coC.set(k, (coC.get(k) ?? 0) + 1);
    }
  }
}

/** Eğitim yarısından hesaplanan önseller, kenar anahtarına göre. */
const trainPrior = new Map<string, number>();
for (const [k, count] of coC) {
  if (count < MIN_CO) continue;
  const [sa, sb] = k.split('|');
  const a = BY_SLUG.get(sa);
  const b = BY_SLUG.get(sb);
  if (!a || !b) continue;
  const pa = (singleC.get(sa) ?? 0) / trainN;
  const pb = (singleC.get(sb) ?? 0) / trainN;
  const pab = count / trainN;
  if (pa <= 0 || pb <= 0 || pab <= 0) continue;
  const nv = Math.log(pab / (pa * pb)) / -Math.log(pab);
  if (nv <= 0) continue;
  trainPrior.set(pairKey(a.id, b.id), 0.3 + 0.55 * Math.min(1, nv / 0.5));
}

/** Kimya + kürasyon + SIZINTISIZ NPMI. */
const chemHandNpmi: PairingEdge[] = PAIRING_EDGES.filter(
  (e) =>
    e.aromaScore >= AROMA_FLOOR ||
    handKeys.has(pairKey(e.aId, e.bId)) ||
    trainPrior.has(pairKey(e.aId, e.bId)),
).map((e) => {
  const k = pairKey(e.aId, e.bId);
  // Kürasyon önce: elle yazılan, istatistiği eziyor.
  const prior = handKeys.has(k) ? e.priorNpmi : trainPrior.get(k);
  return { ...e, priorNpmi: prior, kind: prior && e.aromaScore < 0.15 ? ('geleneksel' as const) : ('paylasilan' as const) };
});

const LOOKUPS = {
  'yalnız kimya': lookupFromIndex(createPairingIndex(chemOnly)),
  'kimya + kürasyon': lookupFromIndex(createPairingIndex(chemHand)),
  'kimya + kürasyon + NPMI': lookupFromIndex(createPairingIndex(chemHandNpmi)),
};

// ── Sınav kümesi ───────────────────────────────────────────────────

/**
 * Her mutfakta bulunan şeyler dışarıda bırakılmıyor: tuzu tahmin etmek
 * hüner değil, ve motor onu her zaman önerir. Sınav ayırt edici
 * malzemeler üzerinde anlamlı.
 */
const STAPLE = new Set(['tuz', 'su', 'seker', 'un', 'sivi-yag', 'karabiber', 'nisasta', 'zeytinyagi']);

interface Case {
  keep: Ingredient[];
  answer: Ingredient;
  title: string;
}

const cases: Case[] = [];
/** Deterministik örnekleme — koşullar birebir aynı tarifleri görsün. */
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

for (const r of testRecipes) {
  const ings = [...new Set(r.allSlugs)]
    .map((s) => BY_SLUG.get(s))
    .filter((i): i is Ingredient => Boolean(i));
  if (ings.length < 5 || ings.length > 12) continue;

  const droppable = ings.filter((i) => !STAPLE.has(i.slug));
  if (droppable.length < 2) continue;

  const answer = droppable[Math.floor(rnd() * droppable.length)];
  cases.push({ keep: ings.filter((i) => i.slug !== answer.slug), answer, title: r.title });
}

// Örneklem sabit tohumla karıştırılıp kırpılıyor.
for (let i = cases.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rnd() * (i + 1));
  [cases[i], cases[j]] = [cases[j], cases[i]];
}
const sample = cases.slice(0, SAMPLE);

// ── Koşum ──────────────────────────────────────────────────────────

const KS = [5, 10, 20];

function run(lookup: ReturnType<typeof lookupFromIndex>) {
  const hits: Record<number, number> = { 5: 0, 10: 0, 20: 0 };
  let ranked = 0;
  let missing = 0;
  let rankSum = 0;

  for (const c of sample) {
    const components: DishComponent[] = c.keep.map((ing) => ({
      ingredient: ing,
      grams: 100,
      role: ing.defaultRole,
    }));
    const dish: DishState = { components };

    const candidates = INGREDIENTS.filter((i) => !c.keep.some((k) => k.slug === i.slug));
    const out = suggestAdditions(dish, candidates, lookup, {
      limit: 60,
      requireLink: false,
      weights: WEIGHTS,
    });

    const idx = out.findIndex((s) => s.ingredient.slug === c.answer.slug);
    if (idx < 0) {
      missing += 1;
      continue;
    }
    ranked += 1;
    rankSum += idx + 1;
    for (const k of KS) if (idx < k) hits[k] += 1;
  }

  return { hits, ranked, missing, medRank: ranked ? rankSum / ranked : NaN };
}

console.log('\n════ MOTOR DEĞERLENDİRMESİ — birini dışarıda bırak ════');
console.log(`  eğitim tarifi:     ${trainN}  (NPMI buradan)`);
console.log(`  sınav tarifi:      ${sample.length}  (motorun görmediği yarıdan)`);
console.log(`  aday havuzu:       ${INGREDIENTS.length} malzeme`);
if (WEIGHTS) console.log(`  ağırlık:           aroma ${WEIGHTS.aroma} · denge ${WEIGHTS.balance} · gelenek ${WEIGHTS.prior}`);
console.log(`  rastgele taban:    recall@10 ≈ %${((10 / INGREDIENTS.length) * 100).toFixed(1)}`);
console.log('');
console.log('  koşul                       recall@5   recall@10   recall@20   ort. sıra');

const results: Record<string, ReturnType<typeof run>> = {};
for (const [label, lookup] of Object.entries(LOOKUPS)) {
  const r = run(lookup);
  results[label] = r;
  const pc = (k: number) => `%${((r.hits[k] / sample.length) * 100).toFixed(1)}`.padStart(8);
  console.log(
    `  ${label.padEnd(26)} ${pc(5)}   ${pc(10)}    ${pc(20)}    ${r.medRank.toFixed(1).padStart(6)}`,
  );
}

const base = results['yalnız kimya'];
const full = results['kimya + kürasyon + NPMI'];
const hand = results['kimya + kürasyon'];

console.log('\n── ÖNSELİN KATKISI (recall@10)');
const p = (r: typeof base) => (r.hits[10] / sample.length) * 100;
console.log(`  kimya → +kürasyon:  ${(p(hand) - p(base) >= 0 ? '+' : '')}${(p(hand) - p(base)).toFixed(1)} puan`);
console.log(`  +kürasyon → +NPMI:  ${(p(full) - p(hand) >= 0 ? '+' : '')}${(p(full) - p(hand)).toFixed(1)} puan`);
console.log(`  toplam:             ${(p(full) - p(base) >= 0 ? '+' : '')}${(p(full) - p(base)).toFixed(1)} puan`);

console.log(
  '\nNot: recall@k\'nın %100 olması hedef değil. Lab\'ın işi korpusu taklit etmek\n' +
    'değil, tarifte olmayan kombinasyon kurdurmak. Anlamlı olan, önsel\n' +
    'eklendiğinde sayının artması — yani motorun Türk mutfağını daha iyi\n' +
    'tanıması.\n',
);
