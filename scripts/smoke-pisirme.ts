/**
 * Pişirme dönüşümü ve besin hesabı denetimi.
 *
 *   npm run smoke:pisirme
 *
 * Modelin iki sözü var ve ikisi de burada sınanıyor:
 *
 *  1. **Hiçbir şey atılmadığında hiçbir şeyi değiştirmez.** Su kaybı kaloriyi
 *     düşürmez; fırında pişen tavuğun kalorisi çiğ hâliyle aynıdır. Bunu
 *     kaçıran bir model porsiyon kalorisini yapay olarak oynatır.
 *  2. **Atıldığında düşürür.** Tavada kalan kızartma yağı, ızgarada damlayan
 *     yağ ve dökülen haşlama suyu tabağa gelmez.
 *
 * Ayrıca hesabın tüm korpusta sağlıklı kaldığı denetleniyor: NaN yok, negatif
 * yok, kaynağından değeri gelen tarif hesaplanmıyor.
 */

import { BY_SLUG } from '../src/data/catalog/index.ts';
import { macrosFor, macrosQuality } from '../src/data/catalog/besin.ts';
import { cookComponent, type CookedIngredient } from '../src/data/catalog/pisirme-donusum.ts';
import { RECIPES } from '../src/data/recipes/index.ts';
import { buildRecipe } from '../src/data/recipes/types.ts';
import { nutritionOf } from '../src/lib/recipe-facts.ts';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

const item = (slug: string, grams: number): CookedIngredient => {
  const ing = BY_SLUG.get(slug)!;
  return { slug, category: ing.category, grams, per100: macrosFor(slug, ing.category) };
};
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= Math.max(1, b * tol);

// ── 1. Su kaybı kaloriyi düşürmez ──────────────────────────────────

console.log('\n════ 1. SU KAYBI KALORİYİ DÜŞÜRMEZ');
{
  const plate = [item('tavuk-gogsu', 250), item('domates', 120), item('kuru-sogan', 110)];
  const cig = cookComponent(plate, 'cig');
  const firin = cookComponent(plate, 'firin');
  const sulu = cookComponent(plate, 'sulu');

  console.log(`  çiğ ${cig.kcal.toFixed(0)} · fırın ${firin.kcal.toFixed(0)} · sulu ${sulu.kcal.toFixed(0)} kcal`);
  check(near(sulu.kcal, cig.kcal), 'sulu pişirme kaloriyi değiştirmiyor');
  check(firin.kcal <= cig.kcal, 'fırın kaloriyi artırmıyor');
  check(
    firin.kcal > cig.kcal * 0.9,
    'fırın kaloriyi %10\'dan fazla düşürmüyor (yalnız damlayan yağ)',
  );
  check(near(firin.carbs, cig.carbs), 'karbonhidrat fırında değişmiyor');

  // Ağırlık ayrı bir şey: o gerçekten düşüyor.
  check(
    firin.cookedGrams < cig.cookedGrams * 0.9,
    `pişmiş ağırlık düşüyor (${cig.cookedGrams.toFixed(0)} → ${firin.cookedGrams.toFixed(0)} g)`,
  );
}

// ── 2. Damlayan yağ ────────────────────────────────────────────────

console.log('\n════ 2. DAMLAYAN YAĞ');
{
  const yagliEt = [item('kuzu-pirzola', 500)];
  const cig = cookComponent(yagliEt, 'cig');
  const izgara = cookComponent(yagliEt, 'izgara');
  console.log(`  kuzu pirzola: çiğ ${cig.fat.toFixed(0)} g yağ → ızgara ${izgara.fat.toFixed(0)} g`);
  check(izgara.fat < cig.fat * 0.8, 'ızgarada yağ düşüyor');
  check(near(izgara.protein, cig.protein), 'protein ızgarada değişmiyor');

  const sebze = [item('patlican', 500)];
  check(
    near(cookComponent(sebze, 'izgara').fat, cookComponent(sebze, 'cig').fat),
    'sebzede damlayacak yağ yok',
  );
}

// ── 3. Kızartma yağı ───────────────────────────────────────────────

console.log('\n════ 3. KIZARTMA YAĞI');
{
  const kizartma = [item('patates', 600), item('sivi-yag', 500)];
  const cig = cookComponent(kizartma, 'cig');
  const kiz = cookComponent(kizartma, 'kizartma');
  console.log(`  600 g patates + 500 g yağ: ham ${cig.kcal.toFixed(0)} → kızartma ${kiz.kcal.toFixed(0)} kcal`);
  check(kiz.kcal < cig.kcal * 0.4, 'tavada kalan yağ düşülüyor');
  check(kiz.fatDiscarded > 300, `atılan yağ ${kiz.fatDiscarded.toFixed(0)} g`);
  check(near(kiz.carbs, cig.carbs), 'patatesin karbonhidratı değişmiyor');

  /**
   * Eşik testi: tarif kızartma diye etiketlenmemiş olsa bile, yağ gıdanın
   * dörtte birini geçiyorsa banyo sayılmalı. Korpusta "Fish and Chips"
   * tavada, "Pişi" dinlendirmede görünüyordu.
   */
  const etiketsiz = cookComponent(kizartma, 'dinlendir');
  check(near(etiketsiz.kcal, kiz.kcal, 0.05), 'yağ banyosu yöntem etiketinden bağımsız bulunuyor');

  // Az yağlı tavada model devreye girmemeli.
  const az = [item('patates', 600), item('zeytinyagi', 30)];
  check(
    near(cookComponent(az, 'tava').fat, cookComponent(az, 'cig').fat, 0.02),
    'normal yağ miktarında yağ düşülmüyor',
  );
}

// ── 4. Dökülen haşlama suyu ────────────────────────────────────────

console.log('\n════ 4. HAŞLAMA SUYU');
{
  const makarna = [item('makarna', 400)];
  const cig = cookComponent(makarna, 'cig');
  const has = cookComponent(makarna, 'haslama');
  const sulu = cookComponent(makarna, 'sulu');
  console.log(`  400 g makarna: ham ${cig.carbs.toFixed(0)} g karbonhidrat → haşlama ${has.carbs.toFixed(0)} g`);
  check(has.carbs < cig.carbs, 'haşlama suyuna nişasta gidiyor');
  check(near(sulu.carbs, cig.carbs), 'sulu pişirmede sıvı yeniyor, kayıp yok');
  check(has.cookedGrams > cig.cookedGrams * 2, 'makarna su çekip ağırlaşıyor');
}

// ── 5. Kaynağından gelen değer hesaplanmıyor ───────────────────────

console.log('\n════ 5. NULL OLMAYAN DEĞER KORUNUYOR');
{
  const base = {
    s: 'test-tarif', n: 'Test', c: 'etli-sulu', m: 30, srv: 4,
    sum: 'test', me: 'firin' as const,
    ing: [['tavuk-gogsu', 400] as [string, number], ['zeytinyagi', 30] as [string, number]],
    st: ['pişir'],
  };
  const hesaplanan = nutritionOf(buildRecipe(base));
  const kaynakli = nutritionOf(buildRecipe({ ...base, nut: [999, 55, 11, 22] }));

  console.log(`  hesaplanan ${hesaplanan.kcal} kcal · kaynaklı ${kaynakli.kcal} kcal`);
  check(kaynakli.kcal === 999 && kaynakli.protein === 55, 'kaynağın değeri olduğu gibi geçiyor');
  check(kaynakli.source === 'kaynak' && hesaplanan.source === 'hesap', 'kaynak etiketi doğru');
  check(hesaplanan.kcal !== 999, 'kaynağı olmayan tarif hesaplanıyor');
}

// ── 6. Tüm korpus sağlıklı mı ──────────────────────────────────────

console.log('\n════ 6. KORPUS GENELİ');
{
  const vals = RECIPES.map((r) => nutritionOf(r));
  check(
    vals.every((n) => [n.kcal, n.protein, n.carbs, n.fat].every((v) => Number.isFinite(v) && v >= 0)),
    'hiçbir tarifte NaN ya da negatif değer yok',
  );

  const kcals = vals.map((n) => n.kcal).sort((a, b) => a - b);
  const med = kcals[Math.floor(kcals.length / 2)];
  const p95 = kcals[Math.floor(kcals.length * 0.95)];
  console.log(`  medyan ${med} kcal · %95'lik ${p95} kcal · en yüksek ${kcals[kcals.length - 1]} kcal`);
  check(med > 150 && med < 700, `medyan porsiyon makul (${med} kcal)`);
  check(p95 < 1600, `%95'lik dilim makul (${p95} kcal)`);

  const over = vals.filter((n) => n.kcal > 2000).length;
  console.log(`  2000 kcal üstü porsiyon: ${over}`);
  check(over < 20, `uç değer sayısı sınırlı (${over})`);

  /**
   * Ölçüt gram payı, malzeme sayısı değil: 2 gramlık bir baharatın kategori
   * ortalamasına düşmesi hesabı bozmuyor, 400 gramlık ana malzemenin düşmesi
   * bozuyor. Sayıyla ölçmek ikisini eşitliyordu.
   */
  const gramShare = RECIPES.map((r) => {
    let real = 0;
    let all = 0;
    for (const c of r.components) {
      for (const i of c.ingredients) {
        all += i.grams;
        if (macrosQuality(i.slug) !== 'ortalama') real += i.grams;
      }
    }
    return all > 0 ? real / all : 0;
  });
  const solid = gramShare.filter((x) => x > 0.98).length;
  console.log(`  gramajının tamamı gerçek ölçüme dayanan tarif: ${solid} / ${RECIPES.length}`);
  check(solid > RECIPES.length * 0.8, 'tariflerin çoğu gerçek ölçüme dayanıyor');
}

console.log(`\n${fail === 0 ? '✓ TÜM DENETİMLER GEÇTİ' : `✗ ${fail} DENETİM BAŞARISIZ`}\n`);
process.exit(fail === 0 ? 0 : 1);
