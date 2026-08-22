/**
 * Adım 6 — yemek.com tarif korpusunu içe aktar.
 *
 *   npm run data:yemekcom             kapsam raporu
 *   npm run data:yemekcom -- --write  src/data/recipes/ithal-yemekcom.ts üret
 *
 * Kaynak: `data-raw/yemekcom-tarif-besin.json` — bir Firebase dökümü.
 * İçinde 685 Türkçe tarif ve 866 malzemenin besin değeri var; buradaki
 * içe aktarıcı yalnızca tarifleri alıyor.
 *
 * **Neden ikinci bir Türkçe korpus?** Elimizdeki nefisyemektarifleri korpusu
 * (`05-tarif-ithal.ts`) tarifin kendisini iyi veriyor ama üç alanı hiç
 * vermiyor ve uygulamada bu üçü uyduruluyordu:
 *
 *   özet     `sum` ilk pişirme adımının kopyasıydı — kart ile tarif sayfası
 *            aynı cümleyi iki kere yazıyordu
 *   porsiyon 3.320 tarifin yalnızca 68'inde doluydu, kalanı "4" varsayıldı
 *   görsel   `loremflickr`'dan rastgele bir yemek fotoğrafı çekiliyordu;
 *            ekrandaki fotoğrafın tarifle ilgisi yoktu
 *
 * yemek.com kaydında üçü de gerçek: `ShortDescription` insan eliyle yazılmış
 * bir tanıtım cümlesi, `PrepDetails` porsiyon ile hazırlık/pişirme süresini
 * ayrı ayrı tutuyor, `Image` tarifin kendi fotoğrafı.
 *
 * Eşleştirme, ölçü çevirisi ve dört veri denetimi `eslestirici.ts`'ten
 * geliyor — nefisyemektarifleri içe aktarıcısıyla aynı nüsha.
 *
 * Kişisel kullanım için içe aktarıldı. Kamuya açık dağıtımdan önce kaynağın
 * lisans durumu netleştirilmeli.
 */

import fs from 'node:fs';

import { INGREDIENTS } from '../../src/data/catalog/index.ts';
import { UNIT_NAMES } from '../../src/data/catalog/olcu.ts';
import { isSogukYemek, refineCategory } from '../../src/data/recipes/ad-kurallari.ts';
import { sanePortions } from '../../src/data/recipes/kategoriler.ts';

import {
  ANIMAL_CATS,
  BY_SLUG,
  esc,
  grams,
  isHealthClaim,
  norm,
  NOT_FOOD,
  PROTEIN_GUARD,
  resolve,
  slugify,
} from './eslestirici.ts';
import { raw } from './sources.ts';

const write = process.argv.includes('--write');
/** `--neden` elenen tarifleri gerekçesiyle basar — eşleme kurallarını ayarlarken gerekiyor. */
const why = process.argv.includes('--neden');

// ── Kaynak biçimi ──────────────────────────────────────────────────

interface SrcRecipe {
  CategoryBread: string;
  Cuisine: string;
  Image: string;
  IngridientNames: string;
  Ingridients: string;
  Keywords: string;
  MainCategory: string;
  Name: string;
  /** "4 kişilik;25 dakika;25 dakika;" */
  PrepDetails: string;
  /** "1.) … \n2.) …" */
  RecipeDetails: string;
  ShortDescription: string;
}

interface SrcFile {
  Recipe: Record<string, SrcRecipe>;
  Ingredient: Record<string, Record<string, string>>;
}

/**
 * Kaynağın kaba bölümleri → bizim yemek kategorilerimiz.
 *
 * Bunlar yalnızca başlangıç noktası: `refineCategory` ada bakıp daraltıyor.
 * "Et" bölümündeki "Adana Kebabı" kebap-ızgaraya, "Sebze" bölümündeki
 * "Zeytinyağlı Enginar" zeytinyağlıya gidiyor.
 *
 * `Özel Beslenme`, `Diyet`, `Vejetaryen`, `Ramazan` ve `Dünya Mutfakları`
 * yemek tipi değil, etiket. Onlarda kaba kategori diye bir şey yok; ada
 * bakan kural ne derse o oluyor, hiçbir kural tutmazsa `etli-sulu`.
 */
const CATEGORY: Record<string, string> = {
  Et: 'etli-sulu',
  Tavuk: 'etli-sulu',
  Sebze: 'etli-sulu',
  Köfte: 'kebap-izgara',
  Çorba: 'corba',
  Balık: 'deniz',
  Makarna: 'pilav-makarna',
  Pilav: 'pilav-makarna',
  'Hamur İşi': 'hamur-isi',
  'Pratik Hamur İşi': 'hamur-isi',
  Kahvaltılık: 'kahvalti',
  Zeytinyağlı: 'zeytinyagli',
  Meze: 'meze-salata',
  Salata: 'meze-salata',
  Atıştırmalık: 'meze-salata',
  Tatlı: 'tatli',
  'Pratik Tatlı': 'tatli',
  Kek: 'tatli',
  Pasta: 'tatli',
  Kurabiye: 'tatli',
};

/**
 * Kaynakta pişirme yöntemi alanı yok; adımların metninden çıkarıyoruz.
 *
 * Sıra önemli ve iki kere yanıldı:
 *
 *  - "Fırında kızarana kadar pişirin" hem fırın hem kızartma kelimesini
 *    taşıyor ama yemek fırın yemeği — fırın önce geliyor.
 *  - `dinlendir` başta durduğunda neredeyse bütün köfte ve hamur tarifleri
 *    "dinlendirerek pişen yemek" oluyordu: hepsinin bir adımında "buzdolabında
 *    bekletin" geçiyor. Dinlendirme bir hazırlık evresi, pişirme yöntemi değil;
 *    o yüzden en sona alındı ve yalnızca başka hiçbir kural tutmazsa seçiliyor.
 */
const METHOD_RULES: [RegExp, string][] = [
  [/fırın|önceden ısıt|borcam|fırınlay/i, 'firin'],
  [/ızgara|mangal|kömür|şişe diz/i, 'izgara'],
  [/derin yağ|bol yağda kızart|kızgın yağa at/i, 'kizartma'],
  [/buhar|buharda/i, 'buhar'],
  [/haşla|kaynar suya at|suda pişir/i, 'haslama'],
  [/tencere|kısık ateşte pişir|demlen|suyunu çek/i, 'sulu'],
  [/tava|sote|kavur/i, 'tava'],
  [/blender|rondo|mikser|çırp|karıştırıcı/i, 'karistir'],
  [/buzdolabında bekle|dinlendir|mayalan/i, 'dinlendir'],
];

// ── Alan ayrıştırıcıları ───────────────────────────────────────────

/**
 * Miktar metnini sayıya çevir.
 *
 * Korpusta üç biçim var: düz sayı ("500"), kesir ("1/2") ve aralık
 * ("400-450"). Aralıkta ortası alınıyor — alt sınırı almak 685 tarifin
 * 109'unda gramajı sistematik olarak aşağı kaydırıyordu.
 */
function amountOf(token: string): number | null {
  const t = token.trim().replace(/,/g, '.');
  if (!t) return null;

  const range = t.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;

  // "1 1/2" — tam sayı artı kesir.
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);

  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ölçü adları uzundan kısaya: "çay bardağı" "çay kaşığı"ndan önce denenmeli. */
const UNITS = [...UNIT_NAMES, 'adet', 'tane', 'dal', 'baş', 'kutu', 'yaprak', 'çimdik', 'kase'].sort(
  (a, b) => b.length - a.length,
);

/**
 * "● 1/2 su bardağı toz şeker" → { amount: 0.5, unit: 'su bardağı', name: 'toz şeker' }
 *
 * Sayı bloğu ilk harfe kadar okunuyor; kalan metnin başında bir ölçü adı
 * varsa birim odur, yoksa birim yok sayılıyor ve `gramsFor` "adet" gibi
 * davranıyor — korpusta 213 satır böyle ("1 soğan").
 */
function parseLine(line: string): { amount: number | null; unit: string | null; name: string } | null {
  const clean = line.replace(/[●•*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  const head = clean.match(/^([\d.,/\s–-]*\d[\d.,/\s–-]*)(?=\D|$)/);
  const amount = head ? amountOf(head[1]) : null;
  let rest = (head ? clean.slice(head[0].length) : clean).trim();

  /**
   * Ölçüden önce gelen sıfatlar: "1 tepeleme yemek kaşığı un", "1 silme
   * tatlı kaşığı tuz". Atılmazlarsa ölçü adı satırın başında görünmüyor,
   * birim boş kalıyor ve `gramsFor` "adet" varsayıyor.
   */
  rest = rest.replace(/^(tepeleme|silme|dolusu|dolu|az|bir miktar|yaklaşık)\s+/i, '').trim();

  /**
   * "500 gr. bakla", "200 ml. krema" — korpusta 54 satırda birim noktalı
   * yazılmış. Nokta atılmazsa birim tanınmıyordu ve 500 gram bakla
   * 500 *adet* bakla oluyordu: 60 kg. İmkânsız miktar denetimi bu
   * tarifleri eliyordu, yani sessiz bir kayıptı.
   */
  const lower = rest.toLocaleLowerCase('tr-TR').replace(/^([a-zçğıöşü]+)\.\s/, '$1 ');
  const unit = UNITS.find((u) => lower === u || lower.startsWith(u + ' ')) ?? null;
  if (unit) rest = rest.slice(lower.length === rest.length ? unit.length : unit.length + 1).trim();

  return rest ? { amount, unit, name: rest } : null;
}

/** "4 kişilik;25 dakika;25 dakika;" → { servings, minutes } */
function parsePrep(s: string): { servings: number | null; minutes: number | null } {
  const parts = s.split(';').map((p) => p.trim()).filter(Boolean);

  /**
   * İlk alan iki türlü geliyor: "4 kişilik" gerçek porsiyon, "12 adet" ise
   * çıkan parça sayısı (kurabiye, poğaça). Parça sayısını porsiyon yerine
   * yazarsak 12 kişilik bir kurabiye tarifi çıkıyor ve porsiyon başına
   * hesaplar bölünüyor — o yüzden yalnızca "kişilik" olanı alıyoruz.
   */
  const srv = parts[0]?.match(/^(\d+)\s*kişilik/);
  const servings = srv ? Number(srv[1]) : null;

  const mins = parts
    .slice(1)
    .map((p) => {
      const h = p.match(/(\d+)\s*saat/);
      const m = p.match(/(\d+)\s*dakika/);
      return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
    })
    .reduce((a, b) => a + b, 0);

  return { servings, minutes: mins > 0 ? mins : null };
}

/** "1.) … \n2.) …" → adım dizisi. */
function parseSteps(s: string): string[] {
  return s
    .split(/\n?\s*\d+\.\)\s*/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 5);
}

/** Ada eklenen "Tarifi" son eki başlıkta gereksiz — 685 tarifin hepsinde var. */
const cleanTitle = (n: string) => n.replace(/\s*Tarifi\s*$/i, '').trim();

// ── İçe aktarma ────────────────────────────────────────────────────

const file = JSON.parse(fs.readFileSync(raw('yemekcom-tarif-besin.json'), 'utf8')) as SrcFile;
const src = Object.values(file.Recipe ?? {});

const MIN_COVERAGE = 0.8;
const unmatched = new Map<string, number>();
const seenSlugs = new Set<string>();
const usedIngredients = new Set<string>();
const lines: string[] = [];
let taken = 0;
let skippedCoverage = 0;
let skippedEmpty = 0;
let skippedJunk = 0;
let skippedLie = 0;
let skippedAbsurd = 0;
let injected = 0;
let realServings = 0;
let realMinutes = 0;
let withImage = 0;
let rescaledServings = 0;

for (const r of src) {
  const title = cleanTitle(r.Name ?? '');

  // Denetim 2 — sağlık iddiası içeriği yemek değil.
  if (isHealthClaim(title)) {
    skippedJunk += 1;
    continue;
  }

  const steps = parseSteps(r.RecipeDetails ?? '');
  const items = (r.Ingridients ?? '')
    .split('\n')
    .map(parseLine)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (!steps.length || items.length < 2) {
    skippedEmpty += 1;
    continue;
  }

  const mapped: { slug: string; g: number }[] = [];
  const missing: string[] = [];
  let known = 0;
  let dropped = 0;

  for (const m of items) {
    const s = resolve(m.name);
    if (s === null) {
      dropped += 1;
      continue;
    }
    if (s === undefined) {
      const key = m.name.toLocaleLowerCase('tr-TR');
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
      missing.push(norm(m.name));
      continue;
    }
    known += 1;
    if (!mapped.some((x) => x.slug === s)) mapped.push({ slug: s, g: grams(s, m.amount, m.unit) });
  }

  const denom = items.length - dropped;
  if (denom <= 0 || known / denom < MIN_COVERAGE || mapped.length < 2) {
    skippedCoverage += 1;
    if (why) console.log(`  KAPSAM ${title}  (${known}/${denom})  ←  ${missing.join(' | ')}`);
    continue;
  }

  // Denetim 1a — ad, tabakta olmayan bir malzemeyi söylüyor mu?
  const t = norm(title);
  const liesInName = missing.some((mi) =>
    mi.split(' ').some((w) => w.length >= 4 && !NOT_FOOD.has(w) && t.includes(w)),
  );
  if (liesInName) {
    skippedLie += 1;
    if (why) console.log(`  YALAN  ${title}  ←  eşleşmeyen: ${missing.join(' | ')}`);
    continue;
  }

  // Denetim 1b — ad ana proteini söylüyorsa tabakta gerçekten var mı?
  if (!mapped.some((m) => ANIMAL_CATS.has(BY_SLUG.get(m.slug)?.category ?? ''))) {
    const guard = PROTEIN_GUARD.find((g) => g.re.test(title) && !(g.not && g.not.test(title)));
    if (guard) {
      mapped.unshift({ slug: guard.slug, g: guard.g });
      injected += 1;
    }
  }

  // Denetim 4a — imkânsız miktar tarifi zehirliyor.
  if (mapped.some((m) => m.g > 5000)) {
    skippedAbsurd += 1;
    continue;
  }

  const slug = slugify(title);
  if (!slug || seenSlugs.has(slug)) continue;
  seenSlugs.add(slug);

  const prep = parsePrep(r.PrepDetails ?? '');
  if (prep.servings) realServings += 1;
  if (prep.minutes) realMinutes += 1;

  /**
   * Denetim 4b — süre alanı. Kaynak burada nefisyemektarifleri'nden çok daha
   * dürüst (685 tarifin neredeyse hepsinde dolu) ama yine de aynı sınırı
   * uyguluyoruz: 5 dakikanın altı ve 8 saatin üstü adım sayısından tahmin.
   */
  const mins =
    prep.minutes && prep.minutes >= 5 && prep.minutes <= 480
      ? prep.minutes
      : Math.min(120, 10 + steps.length * 6);

  const cat = refineCategory(title, CATEGORY[r.MainCategory] ?? 'etli-sulu');

  // Varsayılan `tava` değil: adımlarda pişirme fiili geçmeyen tarif çoğu zaman
  // pişmiyor demektir (cacık, piyaz, turşu). Bkz. 05-tarif-ithal.ts'teki not.
  const method =
    METHOD_RULES.find(([re]) => re.test(steps.join(' ')))?.[1] ??
    (cat === 'icecek' ? 'karistir' : isSogukYemek(title) ? 'cig' : 'tava');

  /**
   * Kaynakta zorluk alanı yok. Adım sayısı ile süreden tahmin ediyoruz:
   * kısa ve az adımlı bir tarif kolay, uzun ve çok adımlı olan zor.
   */
  const diff = steps.length >= 8 || mins >= 90 ? 3 : steps.length >= 5 || mins >= 40 ? 2 : 1;

  const image = (r.Image ?? '').startsWith('http') ? r.Image : '';
  if (image) withImage += 1;

  /**
   * Özet gerçek bir tanıtım cümlesi. Uzunsa cümle sınırından kesiyoruz —
   * kartın altındaki iki satıra sığması gerekiyor ve kelime ortasından
   * kesilmiş bir cümle özensiz görünüyor.
   */
  const desc = (r.ShortDescription ?? '').replace(/\s+/g, ' ').trim();
  const sum = desc.length > 150 ? desc.slice(0, desc.lastIndexOf(' ', 147)) + '…' : desc;

  /**
   * "12 adet" bir ürün sayısı, porsiyon değil — `parsePrep` onu almıyor ve
   * varsayılan 4 kalıyor. Tepsi tatlısında 4 porsiyon 1,5 kiloluk tabak
   * demek oluyordu; gramaj kategorinin tipik değerini çok aşıyorsa porsiyon
   * yeniden hesaplanıyor.
   */
  const totalGrams = mapped.reduce((a, m) => a + m.g, 0);
  const servings = sanePortions(cat, totalGrams, prep.servings ?? 4);
  if (servings !== (prep.servings ?? 4)) rescaledServings += 1;

  for (const m of mapped) usedIngredients.add(m.slug);
  taken += 1;

  lines.push(
    `  { s: '${slug}', n: '${esc(title)}', c: '${cat}', m: ${mins}, d: ${diff}, ` +
      `srv: ${servings}, me: '${method}',\n` +
      `    sum: '${esc(sum || steps[0]).slice(0, 150)}',\n` +
      (image ? `    img: '${esc(image)}',\n` : '') +
      `    ing: [${mapped.map((m) => `['${m.slug}', ${m.g}]`).join(', ')}],\n` +
      `    st: [${steps.slice(0, 10).map((s) => `'${esc(s)}'`).join(', ')}] },`,
  );
}

console.log('\n════ YEMEK.COM TARİF KORPUSU ════');
console.log(`  kaynak:             ${src.length}`);
console.log(`  alınan:             ${taken}`);
console.log(`  atlandı (kapsam):   ${skippedCoverage}`);
console.log(`  atlandı (boş/eksik):${skippedEmpty}`);
console.log(`  atlandı (sağlık iddiası): ${skippedJunk}`);
console.log(`  atlandı (adı malzemesini tutmuyor): ${skippedLie}`);
console.log(`  atlandı (imkânsız miktar): ${skippedAbsurd}`);
console.log(`  ana malzemesi eklendi: ${injected}`);
console.log(`  gerçek porsiyon:    ${realServings} / ${taken}`);
console.log(`  gerçek süre:        ${realMinutes} / ${taken}`);
console.log(`  görselli:           ${withImage} / ${taken}`);
console.log(`  porsiyonu düzeltilen: ${rescaledServings}`);
console.log(`  kullanılan malzeme: ${usedIngredients.size} / ${INGREDIENTS.length}`);

const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(`\n── EŞLEŞMEYEN AD (${unmatched.size} farklı, ilk 25)`);
for (const [n, c] of top) console.log(`  ${String(c).padStart(4)} ${n}`);

if (write) {
  const header = `/**
 * ÜRETİLMİŞ DOSYA — elle düzenleme. \`npm run data:yemekcom -- --write\` ile yenile.
 *
 * Kaynak: yemek.com içeriğinden yapılandırılmış Firebase dökümü
 * (\`data-raw/yemekcom-tarif-besin.json\`, ${src.length} tarif).
 *
 * ${taken} tarif alındı. Malzemelerinin %${MIN_COVERAGE * 100}'inden azı katalogla
 * eşleşen tarifler dışarıda bırakıldı; ölçüler grama çevrildi.
 *
 * Bu korpusun nefisyemektarifleri korpusundan farkı üç alanda: \`sum\` gerçek
 * bir tanıtım cümlesi (adımın kopyası değil), \`srv\` kaynaktan geliyor ve
 * \`img\` tarifin kendi fotoğrafı. Aynı yemek iki korpusta da varsa
 * \`index.ts\` bu dosyayı öne alıyor.
 *
 * Kişisel kullanım için içe aktarıldı. Kamuya açık dağıtımdan önce kaynağın
 * lisans durumu netleştirilmeli.
 */

import type { RawRecipe } from './types';

export const ITHAL_YEMEKCOM: RawRecipe[] = [
`;
  fs.writeFileSync('src/data/recipes/ithal-yemekcom.ts', header + lines.join('\n') + '\n];\n');
  console.log(`\nsrc/data/recipes/ithal-yemekcom.ts yazıldı (${taken} tarif)`);
}
