/**
 * Malzeme katalogu — Türk mutfağı ve komşuları.
 *
 * Bileşik verisi iki kaynaktan geliyor:
 *
 *  1. **Gerçek bileşikler.** 169 malzeme Ahn et al. (2011) veri setine eşlendi;
 *     onlar malzemenin gerçek uçucu bileşik setini kullanıyor.
 *  2. **Aroma aileleri.** Eşleşmeyen 23 malzeme (patlıcan, nar ekşisi, sucuk,
 *     çörekotu…) Türk mutfağına özgü ya da Ahn setinde yok. Onlar elle atanmış
 *     aile etiketlerini kullanıyor; aileler mümkün olduğunca gerçek bileşik
 *     id'lerine açılıyor, açılamayan 4 aile ayrı adres alanına düşüyor.
 *
 * IDF ağırlıkları Ahn'ın 1.525 malzemesinden hesaplandı (bkz. ahn-eslesme.ts).
 * Aşama 1'de bu hesap 192 malzemeden yapılıyordu ve ayırt edicilik ölçülemiyordu.
 */

import type { CompoundRef, Ingredient, PairingEdge } from '@/engine';
import {
  aromaAffinity,
  buildCompoundIdf,
  buildNormCache,
  createPairingIndex,
  lookupFromIndex,
} from '@/engine';

import { AROMA_CLASSES, AROMA_CLASS_BY_SLUG } from '../aroma-classes';
import { KIN_OF } from './akrabalik';
import { AHN_COMPOUNDS, AHN_COVERAGE, COMPOUND_IDF, COMPOUND_NAMES } from './ahn-eslesme';
import { BAHARAT_SIVI } from './baharat-sivi';
import { EK_MALZEME, ITHAL_EK } from './ek-malzeme';
import { FAMILY_COMPOUNDS } from './bilesik-eslesme';
import { CLASSIC_PAIRS } from './gelenek';
import { NPMI_PAIRS } from './npmi-tr';
import { HAYVANSAL } from './hayvansal';
import { KURU_GIDA } from './kuru-gida';
import { MEYVE } from './meyve';
import type { RawIngredient } from './raw';
import { SEBZE_OT } from './sebze-ot';

const RAW: RawIngredient[] = [
  ...HAYVANSAL,
  ...SEBZE_OT,
  ...BAHARAT_SIVI,
  ...KURU_GIDA,
  ...MEYVE,
  ...EK_MALZEME,
  ...ITHAL_EK,
];

// Aynı slug iki kez yazılırsa sessizce yanlış eşleşme üretir; erken patlasın.
{
  const seen = new Set<string>();
  for (const r of RAW) {
    if (seen.has(r.s)) throw new Error(`Katalogda tekrar eden slug: ${r.s}`);
    seen.add(r.s);
  }
}

// ── Bileşik adres alanı ────────────────────────────────────────────

/**
 * Gerçek bileşik id'leri 0–1106 aralığında. Çözülemeyen aroma aileleri için
 * sentetik id üretiyoruz ve bu tabana kaydırıyoruz — yoksa "aile 5" ile
 * "bileşik 5" aynı şey sayılır ve motor sessizce yanlış eşleşme üretir.
 */
export const SYNTHETIC_COMPOUND_BASE = 1_000_000;

const syntheticId = (familySlug: string) =>
  SYNTHETIC_COMPOUND_BASE + (AROMA_CLASS_BY_SLUG.get(familySlug)?.id ?? 0);

/** Bileşik id → hangi aromatik aileye ait (gösterim için duyusal tarif verir). */
const FAMILY_OF_COMPOUND = new Map<number, string>();
for (const [slug, ids] of Object.entries(FAMILY_COMPOUNDS)) {
  for (const id of ids) if (!FAMILY_OF_COMPOUND.has(id)) FAMILY_OF_COMPOUND.set(id, slug);
}

function resolveCompounds(rawIng: RawIngredient): { ids: number[]; source: 'ahn' | 'aile' } {
  const real = AHN_COMPOUNDS[rawIng.s];
  if (real?.length) return { ids: real, source: 'ahn' };

  const out = new Set<number>();
  for (const family of rawIng.x) {
    const expanded = FAMILY_COMPOUNDS[family];
    if (expanded?.length) for (const id of expanded) out.add(id);
    else out.add(syntheticId(family));
  }
  return { ids: [...out].sort((a, b) => a - b), source: 'aile' };
}

// ── Malzemeler ─────────────────────────────────────────────────────

const sources = new Map<string, 'ahn' | 'aile'>();

export const INGREDIENTS: Ingredient[] = RAW.map((r, index) => {
  const { ids, source } = resolveCompounds(r);
  sources.set(r.s, source);
  return {
    id: index + 1,
    slug: r.s,
    nameTr: r.n,
    nameEn: r.e,
    category: r.c,
    defaultRole: r.r,
    roles: r.rr ?? [],
    cuisines: r.k ?? ['tr'],
    taste: {
      sweet: r.t[0],
      sour: r.t[1],
      salty: r.t[2],
      bitter: r.t[3],
      umami: r.t[4],
      fat: r.t[5],
      heat: r.t[6],
    },
    potency: r.p,
    aromaPower: r.a,
    compoundIds: ids,
    kin: KIN_OF.get(r.s),
    allergenTags: r.al ?? [],
    dietTags: r.d ?? [],
    isStaple: r.st ?? false,
  };
});

export const BY_SLUG = new Map(INGREDIENTS.map((i) => [i.slug, i]));
export const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export function ing(slug: string): Ingredient {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`Malzeme bulunamadı: ${slug}`);
  return found;
}

/** Bu malzemenin bileşikleri gerçek veriden mi geliyor, aile tahmininden mi? */
export const compoundSource = (slug: string) => sources.get(slug) ?? 'aile';

// ── Geleneksel eşleşme haritası ────────────────────────────────────

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Kültürel önsel iki katmandan geliyor ve sıra önemli.
 *
 *  1. `npmi-tr.ts` — 3.481 Türk tarifinden hesaplanan birlikte geçme
 *     istatistiği. Geniş ama kaba: "bu ikisi sık sık aynı tarifte" diyor.
 *  2. `gelenek.ts` — elle kürate edilmiş 388 çift. Dar ama keskin: "bu ikisi
 *     olmadan o yemek olmaz" diyor.
 *
 * Elle yazılan SONRA yükleniyor ve istatistiği eziyor. Sebebi ölçüldü:
 * ikisi korele çıkmadı. Kuzu ile kuru nane ikonik ama korpusta kuzu tarifi
 * az; istatistik onu göremez, kürasyon bilir.
 */
const PRIORS = new Map<string, number>();
for (const [slugA, slugB, strength] of [...NPMI_PAIRS, ...CLASSIC_PAIRS]) {
  const a = BY_SLUG.get(slugA);
  const b = BY_SLUG.get(slugB);
  if (!a) throw new Error(`gelenek.ts: bilinmeyen malzeme "${slugA}"`);
  if (!b) throw new Error(`gelenek.ts: bilinmeyen malzeme "${slugB}"`);
  PRIORS.set(pairKey(a.id, b.id), strength);
}

// ── IDF ────────────────────────────────────────────────────────────

/**
 * Karma IDF: gerçek bileşikler için Ahn korpusundan gelen ağırlık,
 * sentetik aile id'leri için yerel katalogdan hesaplanan ağırlık.
 */
const idf = new Map<number, number>();
for (const [id, weight] of Object.entries(COMPOUND_IDF)) idf.set(Number(id), weight);

const localIdf = buildCompoundIdf(INGREDIENTS);
for (const [id, weight] of localIdf) if (!idf.has(id)) idf.set(id, weight);

const norms = buildNormCache(INGREDIENTS, idf);

// ── Kenarlar ───────────────────────────────────────────────────────

/** Bu eşiğin altındaki ve geleneksel bağı da olmayan çiftler tabloya girmiyor. */
const AROMA_FLOOR = 0.02;

function compoundRefs(sharedIds: number[]): CompoundRef[] {
  return sharedIds
    .map((id): CompoundRef | null => {
      if (id >= SYNTHETIC_COMPOUND_BASE) {
        const cls = AROMA_CLASSES.find((c) => c.id === id - SYNTHETIC_COMPOUND_BASE);
        if (!cls) return null;
        return { slug: cls.slug, nameTr: cls.nameTr, senseTr: cls.senseTr, weight: idf.get(id) ?? 0 };
      }

      const name = COMPOUND_NAMES[id];
      if (!name) return null;
      const family = FAMILY_OF_COMPOUND.get(id);
      const cls = family ? AROMA_CLASS_BY_SLUG.get(family) : undefined;
      return {
        slug: name,
        // Ekranda "b-ionone" değil "kuru meyve, gül" okunur olsun.
        nameTr: name.replace(/_/g, ' '),
        senseTr: cls?.senseTr,
        weight: idf.get(id) ?? 0,
      };
    })
    .filter((c): c is CompoundRef => c !== null)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 5);
}

export const PAIRING_EDGES: PairingEdge[] = (() => {
  const edges: PairingEdge[] = [];

  for (let i = 0; i < INGREDIENTS.length; i += 1) {
    for (let j = i + 1; j < INGREDIENTS.length; j += 1) {
      const a = INGREDIENTS[i];
      const b = INGREDIENTS[j];

      const { score, shared } = aromaAffinity(a, b, idf, norms);
      const prior = PRIORS.get(pairKey(a.id, b.id));

      if (score < AROMA_FLOOR && !prior) continue;

      edges.push({
        aId: a.id,
        bId: b.id,
        sharedCount: shared.length,
        aromaScore: score,
        priorNpmi: prior,
        topCompounds: compoundRefs(shared),
        kind: prior && score < 0.15 ? 'geleneksel' : 'paylasilan',
      });
    }
  }

  return edges;
})();

export const PAIRING_INDEX = createPairingIndex(PAIRING_EDGES);
export const LOOKUP = lookupFromIndex(PAIRING_INDEX);

export const CATALOG_STATS = {
  ingredients: INGREDIENTS.length,
  /** Gerçek bileşik seti olan malzeme sayısı. */
  withRealCompounds: AHN_COVERAGE.matched,
  /** Aile tahminine dayanan malzeme sayısı. */
  withFamilyCompounds: AHN_COVERAGE.unmatched,
  aromaClasses: AROMA_CLASSES.length,
  compounds: new Set(INGREDIENTS.flatMap((i) => i.compoundIds ?? [])).size,
  idfDocuments: AHN_COVERAGE.idfDocuments,
  edges: PAIRING_EDGES.length,
  classicPairs: CLASSIC_PAIRS.length,
};
