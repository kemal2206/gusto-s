/**
 * Adım 3 — 54 aroma ailesini gerçek bileşik id'lerine bağla.
 *
 *   npm run data:families            rapor
 *   npm run data:families -- --write src/data/catalog/bilesik-eslesme.ts üret
 *
 * Aşama 1'de her malzemeye "aroma ailesi" etiketi vermiştik (limonen, terpinen ve
 * sitral hep birlikte "sitrus-terpen"). Artık Ahn'ın 1.107 bileşiklik künyesi
 * elimizde; her ailenin temsil ettiği bileşikleri gerçek id'lere çeviriyoruz.
 *
 * Eşleşme ada göre yapılıyor ve Ahn'ın yazım kuralı bizimkinden farklı:
 *   limonene            → limonene_(d-,l-,_and_dl-)
 *   anethole            → trans-anethole
 *   1,8-cineole         → (yok; 1,4-cineole var ama aynı madde değil)
 * Bu yüzden üç kademeli eşleştirme var ve eşleşmeyenler rapora yazılıyor.
 * Rapora bakıp `aroma-classes.ts`'teki aday adları düzeltmek bu adımın işi.
 */

import fs from 'node:fs';

import { AROMA_CLASSES } from '../../src/data/aroma-classes.ts';
import { build } from './sources.ts';

interface AhnCompound {
  id: number;
  name: string;
  cas: string;
}

const data = JSON.parse(fs.readFileSync(build('ahn.json'), 'utf8')) as {
  compounds: AhnCompound[];
};

const write = process.argv.includes('--write');

/** Parantezleri ve noktalamayı at; tireyi KORU (stereo eki sıyırmak için gerekli). */
const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9,\-_ ]/g, '')
    .trim();

/**
 * Ayırıcıları eşitle. Bizim adaylar tire kullanıyor (`ethyl-acetate`),
 * Ahn alt çizgi (`ethyl_acetate`) — ikisi de aynı şeye inmeli.
 */
const collapse = (s: string) => s.replace(/[-_\s]+/g, ' ').trim();

const norm = (s: string) => collapse(clean(s));

/**
 * Stereo ve konum öneklerini sıyır: trans-anethole → anethole.
 *
 * Ahn künyesi Yunan harflerini tek harfle yazıyor: `b-caryophyllene`,
 * `a-pinene`, `g-ionone`. Bu yüzden a/b/g de önek listesinde.
 */
const STEREO =
  /^(?:(?:trans|cis|alpha|beta|gamma|delta|omega|dl|a|b|g|d|l|n|o|p|m|e|z|sec|tert|iso)-|\d[\d,]*-)+/;
const core = (s: string) => {
  let out = clean(s);
  for (let i = 0; i < 4; i += 1) {
    const next = out.replace(STEREO, '');
    if (next === out) break;
    out = next;
  }
  return collapse(out);
};

// ── İndeksler ──────────────────────────────────────────────────────

const byNorm = new Map<string, AhnCompound[]>();
const byCore = new Map<string, AhnCompound[]>();

for (const c of data.compounds) {
  const n = norm(c.name);
  const k = core(c.name);
  (byNorm.get(n) ?? byNorm.set(n, []).get(n)!).push(c);
  (byCore.get(k) ?? byCore.set(k, []).get(k)!).push(c);
}

// ── Eşleştirme ─────────────────────────────────────────────────────

interface Match {
  compound: AhnCompound;
  how: 'tam' | 'çekirdek' | 'içerme';
}

function findMatches(candidate: string): Match[] {
  const n = norm(candidate);
  const exact = byNorm.get(n);
  if (exact?.length) return exact.map((compound) => ({ compound, how: 'tam' as const }));

  const k = core(candidate);
  const byK = byCore.get(k);
  if (byK?.length) return byK.map((compound) => ({ compound, how: 'çekirdek' as const }));

  // Son çare: aday, bileşik adının içinde kelime sınırında geçiyor mu?
  // "limonene" → "limonene_(d-,l-,_and_dl-)" bunu yakalıyor.
  if (k.length < 5) return [];
  const hits = data.compounds.filter((c) => {
    const cn = core(c.name);
    return cn.startsWith(`${k} `) || cn.endsWith(` ${k}`) || cn.includes(` ${k} `);
  });
  return hits.map((compound) => ({ compound, how: 'içerme' as const }));
}

const mapping: Record<string, number[]> = {};
const report: string[] = [];
let familiesResolved = 0;
let candidatesMatched = 0;
let candidatesTotal = 0;
const unresolvedCandidates: string[] = [];

for (const family of AROMA_CLASSES) {
  const ids = new Set<number>();
  const detail: string[] = [];

  for (const candidate of family.compounds) {
    candidatesTotal += 1;
    const matches = findMatches(candidate);
    if (matches.length) {
      candidatesMatched += 1;
      for (const m of matches) ids.add(m.compound.id);
      detail.push(
        `      ✓ ${candidate.padEnd(34)} → ${matches
          .slice(0, 3)
          .map((m) => `${m.compound.name} [${m.compound.id}]`)
          .join(', ')}${matches.length > 3 ? ` +${matches.length - 3}` : ''} (${matches[0].how})`,
      );
    } else {
      unresolvedCandidates.push(`${family.slug}:${candidate}`);
      detail.push(`      ✗ ${candidate.padEnd(34)} → Ahn setinde yok`);
    }
  }

  mapping[family.slug] = [...ids].sort((a, b) => a - b);
  if (ids.size) familiesResolved += 1;

  report.push(`\n  ${family.slug} (${family.nameTr}) — ${ids.size} bileşik`);
  report.push(...detail);
}

console.log('══ AİLE → BİLEŞİK EŞLEMESİ ══');
console.log(report.join('\n'));

console.log('\n── ÖZET');
console.log(`  aile:                 ${AROMA_CLASSES.length}`);
console.log(`  bileşiğe bağlanan:    ${familiesResolved}`);
console.log(`  boş kalan:            ${AROMA_CLASSES.length - familiesResolved}`);
console.log(`  aday adı:             ${candidatesTotal}`);
console.log(`  eşleşen aday:         ${candidatesMatched}`);
console.log(`  toplam bileşik id:    ${new Set(Object.values(mapping).flat()).size} / ${data.compounds.length}`);

if (unresolvedCandidates.length) {
  console.log(`\n── AHN SETİNDE OLMAYAN ADAYLAR (${unresolvedCandidates.length})`);
  for (const u of unresolvedCandidates) console.log(`  ${u}`);
  console.log(
    '\n  Not: Ahn seti 1.107 bileşikle sınırlı (Fenaroli kaynaklı). Bu adayların\n' +
      '  gerçekten olmaması normal; aile diğer üyeleriyle çözünüyor. Boş kalan\n' +
      '  aileler elle atanmış üyeliğe geri düşer, motor çalışmaya devam eder.',
  );
}

if (write) {
  const out = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:families -- --write\` ile yenile.
 *
 * Aroma ailelerinin Ahn et al. (2011) bileşik künyesindeki karşılıkları.
 * Kaynak: Scientific Reports 1:196, doi:10.1038/srep00196
 */

export const FAMILY_COMPOUNDS: Record<string, number[]> = ${JSON.stringify(mapping, null, 2)};

/** Kaç ailenin gerçek bileşik karşılığı bulundu. */
export const FAMILY_RESOLUTION = {
  families: ${AROMA_CLASSES.length},
  resolved: ${familiesResolved},
  compounds: ${new Set(Object.values(mapping).flat()).size},
};
`;
  fs.writeFileSync('src/data/catalog/bilesik-eslesme.ts', out);
  console.log('\nsrc/data/catalog/bilesik-eslesme.ts yazıldı');
}
