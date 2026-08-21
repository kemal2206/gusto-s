/**
 * Adım 10 — malzeme uyumunu korpustan öğren.
 *
 *   npm run data:uyum             rapor
 *   npm run data:uyum -- --write  src/data/catalog/uyum.ts üret
 *   npm run data:uyum -- --incele dana-antrikot
 *
 * ── Sorun ──────────────────────────────────────────────────────────
 *
 * Lab, antrikot + tereyağı seçildikten sonra **tarhana** öneriyordu. Kimya
 * haklıydı: tarhana ile tereyağı gerçekten çok ortak bileşik paylaşıyor.
 * Ama tarhana bir çorba tabanı; antrikotun üzerine konmaz.
 *
 * Zincir kuralı bunu yakalayamıyor çünkü kural "seçilenlerden EN AZ BİRİYLE
 * bağı olsun" diyor ve tereyağı evrensel bir bağlayıcı — her şey onun
 * üzerinden listeye giriyor.
 *
 * ── Çözüm ──────────────────────────────────────────────────────────
 *
 * Soru şu: **"ana malzemenin kurduğu türden yemeklerde bu malzeme geçiyor
 * mu?"** Cevabı korpus veriyor, kültürel varsayım gerekmiyor.
 *
 * Doğrudan saymak yetmiyor: antrikot korpusta yalnızca 12 tarifte geçiyor,
 * 12 tariften çıkan istatistik gürültüdür. O yüzden **geri çekilmeli
 * (backoff) hiyerarşi** kuruluyor — kaba olandan inceye:
 *
 *   L1  tam malzeme        antrikot geçen tarifler
 *   L2  aynı gıda          dana eti geçen tarifler (Ahn kimliği ortak olanlar)
 *   L3  aynı kategori      protein geçen tarifler
 *   G   genel taban        malzemenin korpustaki genel sıklığı
 *
 * Her düzey bir üstünü **önsel** olarak kullanıyor; kanıt arttıkça alt
 * düzeyin sözü ağır basıyor. Klasik toplamalı yumuşatma:
 *
 *   p3 = (c3 + α·pG) / (n3 + α)
 *   p2 = (c2 + α·p3) / (n2 + α)
 *   p1 = (c1 + α·p2) / (n1 + α)
 *
 * Sonra **kaldıraç** (lift) = p1 / pG. "Tesadüfen beklenenden kaç kat sık."
 * Kaldıraç sıfıra yakınsa o malzeme o tür yemekte hiç görülmüyor demektir.
 *
 * ── Neden kültürden bağımsız ───────────────────────────────────────
 *
 * Mekanizma "bu mutfağın korpusunda ne ile ne kullanılıyor" sorusundan
 * ibaret. Formül aynı kalıp korpus değişince cevap da değişiyor: kırmızı
 * şarap antrikotla Türk korpusunda sıfıra yakın, Batı Avrupa diliminde
 * tepede. İki korpus birden kullanılıyor:
 *
 *   Türkçe tarifler   3.481 tarif, kendi korpusumuz — `tr` mutfağı için
 *   Ahn et al. (2011) 56.498 tarif, mutfak etiketli — yabancı mutfaklar için
 *
 * Ahn'ın dağılımı dengesiz (Kuzey Amerika 41.524, Orta Doğu 645); ince
 * dilimlerde geri çekilme zaten devreye giriyor.
 */

import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { AHN_INGREDIENT_ID } from '../../src/data/catalog/ahn-eslesme.ts';
import { RECIPES } from '../../src/data/recipes/index.ts';
import { raw, BUILD_DIR } from './sources.ts';

const write = process.argv.includes('--write');
const inspectAt = process.argv.indexOf('--incele');
const INSPECT = inspectAt > -1 ? process.argv[inspectAt + 1] : null;

/** Yumuşatma sözde-sayısı. Küçükse alt düzey erken güveniyor, büyükse geç. */
const ALPHA = 8;

/** Bu kadar kanıt yoksa veto yok — bilmemek, yanlış bilmekten iyidir. */
const MIN_EVIDENCE = 25;

/** Kaldıraç bunun altındaysa listeden çıkar. */
const VETO_LIFT = 0.15;

/**
 * Kaldıraç sınırda ama malzeme pratikte hiç görünmüyorsa yine veto.
 *
 * Tarhana antrikotta kaldıraç 0,155 ile eşiğin bir tık üstünde kalıyordu —
 * çünkü tarhananın korpustaki genel sıklığı da düşük (%0,6) ve oran ikisini
 * birden küçültünce bölüm sınırda çıkıyor. Oysa mutlak olasılık %0,09:
 * bin tarifte bir. Oran tek başına yetmiyor, mutlak eşik de gerekiyor.
 */
const VETO_ABS_P = 0.002;
const VETO_ABS_LIFT = 0.5;

/** Kaldıraç bunun altındaysa listede kalır ama geri plana atılır. */
const DEMOTE_LIFT = 0.5;

// ── Malzeme grupları ───────────────────────────────────────────────

const bySlug = new Map(INGREDIENTS.map((i) => [i.slug, i]));

/**
 * "Aynı gıda" grubu — Ahn kimliği ortak olanlar aynı şeyin farklı parçası.
 * Antrikot, kuşbaşı, kıyma ve kaburga hepsi 248 (beef).
 */
const foodGroup = new Map<string, string[]>();
for (const i of INGREDIENTS) {
  const id = AHN_INGREDIENT_ID[i.slug];
  const key = id !== undefined ? `ahn:${id}` : (i.kin ? `kin:${i.kin}` : `slug:${i.slug}`);
  const arr = foodGroup.get(key) ?? [];
  arr.push(i.slug);
  foodGroup.set(key, arr);
}
const groupOf = new Map<string, string[]>();
for (const [, slugs] of foodGroup) for (const s of slugs) groupOf.set(s, slugs);

const catOf = new Map<string, string[]>();
for (const i of INGREDIENTS) {
  const arr = catOf.get(i.category) ?? [];
  arr.push(i.slug);
  catOf.set(i.category, arr);
}

// ── Korpuslar ──────────────────────────────────────────────────────

interface Corpus {
  id: string;
  label: string;
  /** Her tarif: malzeme slug kümesi. */
  docs: Set<string>[];
}

/** Türkçe korpus — kendi tariflerimiz. */
const trDocs: Set<string>[] = RECIPES.map((r) => new Set(r.allSlugs));

/**
 * Ahn korpusu. Malzeme adları İngilizce ve bizim slug'larımıza `ahn-eslesme`
 * üzerinden bağlanıyor; eşleşmeyen malzeme sayıma girmiyor.
 */
const ahnRaw = JSON.parse(fs.readFileSync(`${BUILD_DIR}/recipes.json`, 'utf8')) as {
  recipes: { cuisine: string; ingredients: string[] }[];
};

/** Ahn malzeme adı → id (ingr_info.tsv). */
const ahnNameToId = new Map<string, number>();
for (const line of fs.readFileSync(raw('ingr_info.tsv'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [id, name] = line.split('\t');
  if (id && name) ahnNameToId.set(name.trim(), Number(id));
}
/** Ahn id → bizim slug'larımız. */
const ahnIdToSlugs = new Map<number, string[]>();
for (const [slug, id] of Object.entries(AHN_INGREDIENT_ID)) {
  const arr = ahnIdToSlugs.get(id) ?? [];
  arr.push(slug);
  ahnIdToSlugs.set(id, arr);
}

/** `CuisineId` → Ahn mutfak etiketleri. */
const CUISINE_MAP: Record<string, string[]> = {
  levanten: ['MiddleEastern'],
  'iran-kafkas': ['MiddleEastern'],
  'yunan-balkan': ['SouthernEuropean', 'EasternEuropean'],
  uzakdogu: ['EastAsian', 'SoutheastAsian'],
};

function ahnDocs(labels: string[]): Set<string>[] {
  const want = new Set(labels);
  const out: Set<string>[] = [];
  for (const r of ahnRaw.recipes) {
    if (!want.has(r.cuisine)) continue;
    const s = new Set<string>();
    for (const name of r.ingredients) {
      const id = ahnNameToId.get(name);
      if (id === undefined) continue;
      for (const slug of ahnIdToSlugs.get(id) ?? []) s.add(slug);
    }
    if (s.size >= 3) out.push(s);
  }
  return out;
}

/**
 * Ahn korpusundan türeyen dilimlerde, Ahn sözlüğünde karşılığı OLMAYAN
 * malzemeye veto uygulanmıyor.
 *
 * Sucuk, tarhana, pekmez, isot — bunlar Ahn'ın malzeme listesinde yok. O
 * korpusta hiç görünmemeleri "Uzak Doğu mutfağında kullanılmaz" demek değil,
 * "bu veri onlar hakkında bir şey söylemiyor" demek. Kanıtın yokluğunu
 * yokluğun kanıtı saymak, korpusun kendi boşluğunu kurala çevirir.
 */
const mappable = new Set(Object.keys(AHN_INGREDIENT_ID));

const corpora: Corpus[] = [
  { id: 'tr', label: 'Türk (kendi korpusumuz)', docs: trDocs },
  ...Object.entries(CUISINE_MAP).map(([id, labels]) => ({
    id,
    label: `${id} (Ahn: ${labels.join('+')})`,
    docs: ahnDocs(labels),
  })),
];

// ── Model ──────────────────────────────────────────────────────────

interface Model {
  /** Kaç tarifte geçiyor. */
  count: Map<string, number>;
  /** Malzeme → o malzemeyi içeren tariflerin indeksi. */
  withIng: Map<string, Set<number>>;
  n: number;
}

function build(docs: Set<string>[]): Model {
  const count = new Map<string, number>();
  const withIng = new Map<string, Set<number>>();
  docs.forEach((d, i) => {
    for (const s of d) {
      count.set(s, (count.get(s) ?? 0) + 1);
      const set = withIng.get(s) ?? new Set<number>();
      set.add(i);
      withIng.set(s, set);
    }
  });
  return { count, withIng, n: docs.length };
}

/** Verilen tarif indekslerinde `cand` kaç kere geçiyor. */
function countIn(docs: Set<string>[], idx: Set<number>, cand: string): number {
  let c = 0;
  for (const i of idx) if (docs[i].has(cand)) c += 1;
  return c;
}

const union = (sets: (Set<number> | undefined)[]): Set<number> => {
  const out = new Set<number>();
  for (const s of sets) if (s) for (const v of s) out.add(v);
  return out;
};

interface Fit {
  lift: number;
  p1: number;
  evidence: number;
}

function fitFor(docs: Set<string>[], m: Model, main: string, cand: string): Fit {
  const pG = (m.count.get(cand) ?? 0) / Math.max(1, m.n);

  const catIdx = union((catOf.get(bySlug.get(main)?.category ?? '') ?? []).map((s) => m.withIng.get(s)));
  const grpIdx = union((groupOf.get(main) ?? [main]).map((s) => m.withIng.get(s)));
  const ownIdx = m.withIng.get(main) ?? new Set<number>();

  const n3 = catIdx.size;
  const c3 = countIn(docs, catIdx, cand);
  const p3 = (c3 + ALPHA * pG) / (n3 + ALPHA);

  const n2 = grpIdx.size;
  const c2 = countIn(docs, grpIdx, cand);
  const p2 = (c2 + ALPHA * p3) / (n2 + ALPHA);

  const n1 = ownIdx.size;
  const c1 = countIn(docs, ownIdx, cand);
  const p1 = (c1 + ALPHA * p2) / (n1 + ALPHA);

  /**
   * Kanıt **üç düzeyin toplamı**, yalnızca ilk ikisi değil.
   *
   * İlk hâli `n1 + n2` sayıyordu ve filtreyi en çok gerektiği yerde
   * kapatıyordu. Levrek korpusta 6 tarifte geçiyor, Ahn grubu da tek
   * başına — kanıt 12, eşik 25, sonuç: levrek için **hiç kayıt yok**.
   * Yani en zayıf malzemeler hiç korunmuyordu.
   *
   * Oysa kategori düzeyinde 62 deniz tarifi var ve tahmin (`p1`) zaten
   * oraya yaslanıyor: `p1` → `p2` → `p3` zinciri kanıt azaldıkça üst
   * düzeyin sözünü ağırlaştırıyor. Kanıtı sayarken o düzeyi görmezden
   * gelmek, kullandığımız bilgiyi yok saymak oluyordu.
   *
   * Somut sonuç: levreğe elma, şeftali ve bitter çikolata öneriliyordu —
   * üçü de 62 deniz tarifinin HİÇBİRİNDE geçmiyor.
   */
  return { lift: pG > 0 ? p1 / pG : 0, p1, evidence: n1 + n2 + n3 };
}

// ── Üretim ─────────────────────────────────────────────────────────

interface Entry {
  main: string;
  veto: string[];
  demote: string[];
}

const results: Record<string, Entry[]> = {};

for (const corpus of corpora) {
  const m = build(corpus.docs);
  const entries: Entry[] = [];
  /** Ahn türevi dilimlerde yalnızca eşleşebilen malzemeler hakkında konuşuyoruz. */
  const ahnDerived = corpus.id !== 'tr';

  for (const main of INGREDIENTS) {
    const veto: string[] = [];
    const demote: string[] = [];

    if (ahnDerived && !mappable.has(main.slug)) continue;

    for (const cand of INGREDIENTS) {
      if (cand.slug === main.slug) continue;
      if (ahnDerived && !mappable.has(cand.slug)) continue;
      const f = fitFor(corpus.docs, m, main.slug, cand.slug);
      // Kanıt yetersizse karışmıyoruz.
      if (f.evidence < MIN_EVIDENCE) continue;
      const vetoed = f.lift < VETO_LIFT || (f.p1 < VETO_ABS_P && f.lift < VETO_ABS_LIFT);
      if (vetoed) veto.push(cand.slug);
      else if (f.lift < DEMOTE_LIFT) demote.push(cand.slug);
    }

    if (veto.length || demote.length) entries.push({ main: main.slug, veto, demote });
  }

  results[corpus.id] = entries;

  const totalVeto = entries.reduce((a, e) => a + e.veto.length, 0);
  const totalDemote = entries.reduce((a, e) => a + e.demote.length, 0);
  console.log(
    `  ${corpus.label.padEnd(34)} ${String(corpus.docs.length).padStart(6)} tarif · ` +
      `${String(entries.length).padStart(3)} ana malzeme · ${totalVeto} veto · ${totalDemote} geri plan`,
  );
}

console.log('\n════ MALZEME UYUMU ════');

if (INSPECT) {
  const m = build(trDocs);
  console.log(`\n── "${bySlug.get(INSPECT)?.nameTr ?? INSPECT}" için kaldıraçlar (Türk korpusu)`);
  const rows = INGREDIENTS.map((c) => ({ c, f: fitFor(trDocs, m, INSPECT, c.slug) }))
    .filter((x) => x.c.slug !== INSPECT)
    .sort((a, b) => b.f.lift - a.f.lift);
  console.log('\n  EN UYUMLU 10:');
  for (const x of rows.slice(0, 10)) {
    console.log(`    ${x.f.lift.toFixed(2).padStart(6)}  ${x.c.nameTr}`);
  }
  console.log('\n  EN UYUMSUZ 14:');
  for (const x of rows.slice(-14)) {
    const tag = x.f.evidence < MIN_EVIDENCE ? ' (kanıt yetersiz)' : x.f.lift < VETO_LIFT ? ' ← VETO' : '';
    console.log(`    ${x.f.lift.toFixed(2).padStart(6)}  ${x.c.nameTr}${tag}`);
  }
  for (const probe of ['tarhana', 'biberiye', 'kadayif', 'makarna', 'kirmizi-sarap', 'sut']) {
    const f = fitFor(trDocs, m, INSPECT, probe);
    console.log(
      `\n  ${(bySlug.get(probe)?.nameTr ?? probe).padEnd(16)} kaldıraç ${f.lift.toFixed(3)} · ` +
        `p ${(f.p1 * 100).toFixed(2)}% · kanıt ${f.evidence}` +
        (f.evidence < MIN_EVIDENCE
          ? ' → dokunulmuyor'
          : f.lift < VETO_LIFT || (f.p1 < VETO_ABS_P && f.lift < VETO_ABS_LIFT)
            ? ' → VETO'
            : f.lift < DEMOTE_LIFT
              ? ' → geri plan'
              : ' → serbest'),
    );
  }
}

if (write) {
  const body = Object.entries(results)
    .map(([cid, entries]) => {
      const lines = entries.map(
        (e) =>
          `    '${e.main}': { v: [${e.veto.map((s) => `'${s}'`).join(', ')}], d: [${e.demote
            .map((s) => `'${s}'`)
            .join(', ')}] },`,
      );
      return `  '${cid}': {\n${lines.join('\n')}\n  },`;
    })
    .join('\n');

  const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:uyum -- --write\` ile yenile.
 *
 * Ana malzemeye göre uyum tablosu. Her mutfak için ayrı hesaplanıyor:
 * \`tr\` kendi 3.481 tarifimizden, diğerleri Ahn et al. (2011) korpusunun
 * o mutfağa ait diliminden.
 *
 * \`v\` (veto)      ana malzemenin kurduğu yemek türünde bu malzeme
 *                 neredeyse hiç görülmüyor — aday listesine girmiyor.
 * \`d\` (geri plan) görülüyor ama seyrek — listede kalıyor, skoru düşüyor.
 *
 * Kanıtı ${MIN_EVIDENCE} tariften az olan çiftlere hiç dokunulmuyor: bilmemek,
 * yanlış bilmekten iyidir.
 *
 * Yöntem \`scripts/pipeline/10-uyum.ts\` başında anlatılıyor — geri çekilmeli
 * hiyerarşi (malzeme → gıda grubu → kategori → genel) ve kaldıraç oranı.
 */

export interface UyumEntry {
  v: string[];
  d: string[];
}

export const UYUM: Record<string, Record<string, UyumEntry>> = {
${body}
};

/** Ana malzemeye göre veto listesi — mutfak bilinmiyorsa Türkçeye düşer. */
export function uyumFor(cuisine: string, mainSlug: string): UyumEntry | undefined {
  return UYUM[cuisine]?.[mainSlug] ?? UYUM.tr?.[mainSlug];
}
`;
  fs.writeFileSync('src/data/catalog/uyum.ts', header);
  console.log(`\nsrc/data/catalog/uyum.ts yazıldı`);
}
