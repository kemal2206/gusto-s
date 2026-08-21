/**
 * Besin hesabını KENDİ tariflerimizle sına.
 *
 *   npm run kalibrasyon:tr
 *
 * Yummly kalibrasyonu (`kalibrasyon-besin.ts`) modelin yönünü doğruluyor ama
 * İngilizce malzeme eşleştirmesi üzerinden çalıştığı için mutlak hatası kendi
 * düzeneğinin gürültüsünü de taşıyor. Burada Türkçe tarafta, dışarıdan hiçbir
 * referans olmadan ölçülebilen dört şey var:
 *
 *  1. **Çapraz korpus tutarlılığı.** 200'e yakın yemek hem nefisyemektarifleri
 *     hem yemek.com korpusunda var; malzeme listeleri birbirinden bağımsız
 *     yazılmış. Aynı yemeğin iki ayrı tarifi benzer besin değeri veriyorsa
 *     hesap sağlam demektir. Bu, referans veri gerektirmeyen gerçek bir sınav.
 *  2. **Atwater iç tutarlılığı.** Hesaplanan kalori, hesaplanan makrolarla
 *     uyuşmalı. Uyuşmuyorsa dönüşümün bir yerinde kalori ile makro ayrı
 *     yönlere gitmiş demektir.
 *  3. **Pişmiş yoğunluk.** Tabağın 100 gramında düşen kalori kategorisine
 *     göre makul bir aralıkta olmalı. Çorba 100 gramında 400 kcal olamaz.
 *  4. **Makro payı.** Protein + karbonhidrat + yağ enerjisi toplam kalorinin
 *     tamamını açıklamalı; büyük sapma tabloda delik var demek.
 */

import { BY_SLUG } from '../src/data/catalog/index.ts';
import { macrosQuality } from '../src/data/catalog/besin.ts';
import { ITHAL_TR } from '../src/data/recipes/ithal-tr.ts';
import { ITHAL_YEMEKCOM } from '../src/data/recipes/ithal-yemekcom.ts';
import { buildRecipe, type Recipe } from '../src/data/recipes/types.ts';
import { RECIPES } from '../src/data/recipes/index.ts';
import { nutritionOf } from '../src/lib/recipe-facts.ts';

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

// ── 1. Çapraz korpus tutarlılığı ───────────────────────────────────

console.log('\n════ 1. AYNI YEMEK, İKİ BAĞIMSIZ TARİF');

const tr = new Map(ITHAL_TR.map((r) => [r.s, buildRecipe(r)]));
const yc = new Map(ITHAL_YEMEKCOM.map((r) => [r.s, buildRecipe(r)]));

interface Pair {
  slug: string;
  title: string;
  a: number;
  b: number;
  drift: number;
}
const pairs: Pair[] = [];
for (const [slug, r1] of yc) {
  const r2 = tr.get(slug);
  if (!r2) continue;
  const n1 = nutritionOf(r1).kcal;
  const n2 = nutritionOf(r2).kcal;
  if (n1 < 20 || n2 < 20) continue;
  pairs.push({
    slug,
    title: r1.title,
    a: n1,
    b: n2,
    drift: (Math.abs(n1 - n2) / Math.max(n1, n2)) * 100,
  });
}

console.log(`  iki korpusta da bulunan yemek: ${pairs.length}`);
if (pairs.length) {
  const drifts = pairs.map((p) => p.drift);
  const med = median(drifts);
  console.log(`  medyan sapma:  %${med.toFixed(1)}`);
  console.log(`  %75'lik dilim: %${pct(drifts, 0.75).toFixed(1)}`);
  console.log(`  %90'lık dilim: %${pct(drifts, 0.9).toFixed(1)}`);

  /**
   * Beklenti neden %35 gibi geniş bir sayı: iki tarif AYNI YEMEK ama aynı
   * tarif değil. Birinin köftesi 500 g kıymayla, diğerininki 350 g ile
   * yapılıyor olabilir; ikisi de doğru. Ölçtüğümüz şey hesabın tutarlılığı,
   * tariflerin aynılığı değil. Bu sayının çok büyümesi ise hesabın malzeme
   * listesindeki küçük farklara aşırı tepki verdiğini gösterir.
   */
  check(med < 35, `medyan sapma %35'in altında (%${med.toFixed(1)})`);

  console.log('\n  EN ÇOK AYRIŞANLAR:');
  for (const p of [...pairs].sort((x, y) => y.drift - x.drift).slice(0, 6)) {
    console.log(
      `    %${p.drift.toFixed(0).padStart(3)}  ${p.title.slice(0, 30).padEnd(32)} ` +
        `yemek.com ${p.a} kcal · nefis ${p.b} kcal`,
    );
  }
  console.log('\n  EN İYİ ÖRTÜŞENLER:');
  for (const p of [...pairs].sort((x, y) => x.drift - y.drift).slice(0, 5)) {
    console.log(
      `    %${p.drift.toFixed(0).padStart(3)}  ${p.title.slice(0, 30).padEnd(32)} ` +
        `${p.a} kcal · ${p.b} kcal`,
    );
  }
}

// ── 2. Atwater iç tutarlılığı ──────────────────────────────────────

console.log('\n════ 2. KALORİ MAKROLARLA UYUŞUYOR MU');
{
  const drifts: number[] = [];
  const bad: { title: string; kcal: number; atwater: number }[] = [];
  for (const r of RECIPES) {
    const n = nutritionOf(r);
    if (n.kcal < 50) continue;
    const atwater = n.protein * 4 + n.carbs * 4 + n.fat * 9;
    const d = (Math.abs(atwater - n.kcal) / n.kcal) * 100;
    drifts.push(d);
    if (d > 60) bad.push({ title: r.title, kcal: n.kcal, atwater });
  }
  const med = median(drifts);
  console.log(`  medyan sapma: %${med.toFixed(1)}  ·  %90'lık: %${pct(drifts, 0.9).toFixed(1)}`);
  console.log(`  %60'tan fazla sapan: ${bad.length} tarif`);
  for (const b of bad.slice(0, 4)) {
    console.log(`     ${b.title.slice(0, 34).padEnd(36)} ${b.kcal} kcal · makrolardan ${b.atwater.toFixed(0)}`);
  }
  /**
   * Sıfır beklemiyoruz: lif karbonhidrat sayılıyor ama 2 kcal/g veriyor,
   * bu yüzden Atwater sistematik olarak biraz yüksek çıkıyor. Ama sapma
   * büyükse dönüşümde kalori ile makro ayrı yönlere gitmiş demektir.
   */
  check(med < 25, `medyan Atwater sapması %25'in altında (%${med.toFixed(1)})`);
  check(bad.length < RECIPES.length * 0.02, `aşırı sapan tarif %2'nin altında (${bad.length})`);
}

// ── 3. Pişmiş yoğunluk ─────────────────────────────────────────────

console.log('\n════ 3. TABAĞIN 100 GRAMINDA KAÇ KALORİ');
{
  const byCat = new Map<string, number[]>();
  for (const r of RECIPES) {
    const n = nutritionOf(r);
    if (!n.cookedGrams || n.cookedGrams < 30) continue;
    const per100 = (n.kcal / n.cookedGrams) * 100;
    const a = byCat.get(r.categoryId) ?? [];
    a.push(per100);
    byCat.set(r.categoryId, a);
  }
  /** Kategori başına makul üst sınır — tatlı ve hamur işi doğal olarak yoğun. */
  const CEIL: Record<string, number> = {
    corba: 150, 'meze-salata': 300, deniz: 300, 'etli-sulu': 260, zeytinyagli: 250,
    'dolma-sarma': 250, 'pilav-makarna': 320, kahvalti: 400, 'kebap-izgara': 350,
    'hamur-isi': 480, tatli: 500, icecek: 150, 'sos-marine': 600,
  };
  let over = 0;
  for (const [cat, xs] of [...byCat].sort()) {
    const med = median(xs);
    const p90 = pct(xs, 0.9);
    const ceil = CEIL[cat] ?? 400;
    const flag = med > ceil ? '  ← YÜKSEK' : '';
    if (med > ceil) over += 1;
    console.log(
      `  ${cat.padEnd(14)} medyan ${String(Math.round(med)).padStart(4)} · %90 ${String(Math.round(p90)).padStart(4)} kcal/100 g   (sınır ${ceil})${flag}`,
    );
  }
  check(over === 0, 'hiçbir kategorinin medyan yoğunluğu sınırı aşmıyor');
}

// ── 4. Veri kalitesinin hesaba etkisi ──────────────────────────────

console.log('\n════ 4. KATEGORİ ORTALAMASINA DÜŞEN GRAMAJ');
{
  const shares = RECIPES.map((r) => {
    let real = 0;
    let all = 0;
    for (const c of r.components) {
      for (const i of c.ingredients) {
        all += i.grams;
        if (macrosQuality(i.slug) !== 'ortalama') real += i.grams;
      }
    }
    return all > 0 ? real / all : 1;
  });
  const med = median(shares) * 100;
  const weak = shares.filter((s) => s < 0.7).length;
  console.log(`  medyan gerçek-değer payı: %${med.toFixed(1)}`);
  console.log(`  payı %70'in altında olan tarif: ${weak}`);
  check(med > 95, `medyan pay %95'in üstünde (%${med.toFixed(1)})`);
  check(weak < RECIPES.length * 0.05, `zayıf tarif %5'in altında (${weak})`);

  // Hangi malzemeler en çok gramajla ortalamaya düşüyor — sıradaki iş listesi.
  const missing = new Map<string, number>();
  for (const r of RECIPES) {
    for (const c of r.components) {
      for (const i of c.ingredients) {
        if (macrosQuality(i.slug) === 'ortalama') {
          missing.set(i.slug, (missing.get(i.slug) ?? 0) + i.grams);
        }
      }
    }
  }
  const top = [...missing].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\n  DEĞERİ OLMAYAN, EN ÇOK GRAMAJ TAŞIYAN MALZEMELER:');
  for (const [slug, g] of top) {
    console.log(`    ${String(Math.round(g / 1000)).padStart(5)} kg  ${BY_SLUG.get(slug)?.nameTr ?? slug}`);
  }
}

console.log(`\n${fail === 0 ? '✓ TÜM DENETİMLER GEÇTİ' : `✗ ${fail} DENETİM BAŞARISIZ`}\n`);
process.exit(fail === 0 ? 0 : 1);
