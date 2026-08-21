/**
 * Lab'de kurulan tabağın yapılışı üretilebiliyor mu?
 *
 *   npm run smoke:lab
 *
 * Üretilen şey gerçek bir `Recipe` olmak zorunda: besin hesabı, porsiyon
 * ölçekleme ve alerjen uyarısı hepsi aynı yoldan geçiyor. Ayrıca kullanıcının
 * sorduğu asıl durum sınanıyor — "tatlı ekşi" seçilip antrikot kurulduğunda
 * sistem bir sos gerektiğini söylüyor mu.
 */
import { BY_SLUG, INGREDIENTS, LOOKUP } from '../src/data/catalog/index.ts';
import { AHN_INGREDIENT_ID } from '../src/data/catalog/ahn-eslesme.ts';
import { uyumFor } from '../src/data/catalog/uyum.ts';
import { suggestAdditions } from '../src/engine/index.ts';
import { buildLabRecipe, findGap, type LabComponentLite } from '../src/lib/lab-tarif.ts';
import { nutritionOf } from '../src/lib/recipe-facts.ts';

let fail = 0;
const check = (ok: boolean, m: string) => { console.log(`  ${ok ? '✓' : '✗'} ${m}`); if (!ok) fail++; };
const pick = (slug: string, grams: number, role: any) => ({ ingredient: BY_SLUG.get(slug)!, grams, role });

console.log('\n════ 1. IZGARA ANTRİKOT');
const izgara: LabComponentLite = { kind: 'ana', method: 'izgara', archetypeId: 'dumanli-izgara',
  picks: [pick('dana-antrikot', 400, 'ana'), pick('zeytinyagi', 20, 'yag'),
          pick('biberiye', 4, 'baharat'), pick('karabiber', 2, 'baharat'), pick('maydanoz', 10, 'bitirici')] };
const a = buildLabRecipe([izgara], 2)!;
console.log(`  "${a.recipe.title}"  ·  ${a.recipe.totalMinutes} dk  ·  ${nutritionOf(a.recipe).kcal} kcal/porsiyon`);
a.recipe.components[0].steps.forEach((s, i) => console.log(`    ${i+1}. ${s}`));
check(a.recipe.components[0].steps.length >= 4, 'en az 4 adım üretildi');
check(a.recipe.components[0].steps.some(s => /dinlendirin/.test(s)), 'ızgarada marine adımı var');
check(a.recipe.components[0].steps.some(s => /maydanoz/i.test(s) && /Ocaktan/.test(s)), 'bitirici en sonda');
check(nutritionOf(a.recipe).kcal > 100, 'besin değeri hesaplanıyor');

console.log('\n════ 2. HEDEF AÇIĞI — kullanıcının anlattığı durum');
const tatliEksi: LabComponentLite = { ...izgara, archetypeId: 'tatli-eksi-sos' };
const b = buildLabRecipe([tatliEksi], 2)!;
const gap = findGap(b.profile, 'tatli-eksi-sos', false);
console.log(`  tabağın profili: ekşi ${b.profile.sour.toFixed(1)} · tatlı ${b.profile.sweet.toFixed(1)}`);
console.log(`  ${gap ? gap.messageTr : 'açık yok'}`);
check(gap !== null, 'hedefe ulaşılamadığı tespit ediliyor');
check(gap?.suggestKind === 'sos', 'çözüm olarak SOS öneriliyor');

console.log('\n════ 3. ANA + SOS BİRLİKTE');
const sos: LabComponentLite = { kind: 'sos', method: 'sulu', archetypeId: 'tatli-eksi-sos',
  picks: [pick('nar-eksisi', 40, 'asit'), pick('bal', 20, 'tatlandirici'),
          pick('tereyagi', 15, 'yag'), pick('kuru-sogan', 60, 'aromatik')] };
const c = buildLabRecipe([izgara, sos], 2)!;
console.log(`  "${c.recipe.title}"  ·  ${c.recipe.components.length} bileşen  ·  ${c.recipe.totalMinutes} dk`);
for (const comp of c.recipe.components) console.log(`    [${comp.kind}] ${comp.title} — ${comp.steps.length} adım, ${comp.minutes} dk`);
console.log('    SOS ADIMLARI:');
c.recipe.components[1].steps.forEach((s, i) => console.log(`      ${i+1}. ${s}`));
check(c.recipe.components.length === 2, 'iki bileşen üretildi');
check(c.recipe.totalMinutes < c.recipe.components.reduce((n, x) => n + x.minutes, 0), 'sos ana yemekle paralel sayılıyor');
check(findGap(c.profile, 'tatli-eksi-sos', true)?.suggestKind === undefined, 'sos eklenince tekrar sos önerilmiyor');

console.log(`
════ 4. MALZEME UYUMU`);
{
  const main = 'dana-antrikot';
  const u = uyumFor('tr', main)!;
  const id = AHN_INGREDIENT_ID[main];
  const sib = INGREDIENTS.filter((i) => i.slug !== main && AHN_INGREDIENT_ID[i.slug] === id).map((i) => i.id);
  const veto = [...sib, ...u.v.flatMap((x) => { const i = BY_SLUG.get(x); return i ? [i.id] : []; })];
  const dem = u.d.flatMap((x) => { const i = BY_SLUG.get(x); return i ? [i.id] : []; });
  const dish: any = {
    components: [
      { ingredient: BY_SLUG.get(main)!, grams: 250, role: 'ana' },
      { ingredient: BY_SLUG.get('tereyagi')!, grams: 10, role: 'yag' },
    ],
    archetypeId: 'dumanli-izgara',
  };
  const out = suggestAdditions(dish, INGREDIENTS, LOOKUP, {
    limit: 12,
    excludeIngredientIds: veto,
    demoteIngredientIds: dem,
  });
  console.log(`  ${u.v.length} veto · ${u.d.length} geri plan`);
  console.log(`  ilk 8: ${out.slice(0, 8).map((o) => o.ingredient.nameTr).join(', ')}`);

  /**
   * Kullanıcının bildirdiği somut hata: antrikot + tereyağı sonrası tarhana
   * öneriliyordu. Tarhana bir çorba tabanı, etin üzerine konmaz.
   */
  check(!out.some((o) => o.ingredient.slug === 'tarhana'), 'tarhana antrikota önerilmiyor');
  check(!out.some((o) => o.ingredient.slug === 'kadayif'), 'kadayıf önerilmiyor');
  check(!out.some((o) => AHN_INGREDIENT_ID[o.ingredient.slug] === id), 'aynı gıdanın başka parçası yok');
  check(out.length >= 6, `liste boşalmadı (${out.length} aday)`);
  check(!u.v.includes('biberiye'), 'biberiye veto yemiyor (nadir ama doğru eşleşme)');
}

console.log(`
════ 5. ZAYIF KORPUSLU ANA MALZEME`);
{
  /**
   * Levrek korpusta yalnızca 6 tarifte geçiyor. Kanıt eşiği yüzünden uyum
   * tablosunda hiç kaydı yoktu ve Lab ona **elma, şeftali, bitter çikolata**
   * öneriyordu — üçü de tereyağıyla eşleştiği için, 62 deniz tarifinin
   * hiçbirinde geçmemesine rağmen.
   *
   * Kanıt artık kategori düzeyini de sayıyor. Bu test o gerilemeyi yakalar.
   */
  const u = uyumFor('tr', 'levrek');
  check(Boolean(u), 'levrek için uyum kaydı var');
  for (const s of ['elma', 'seftali', 'bitter-cikolata', 'domates-salcasi', 'gochujang']) {
    check(Boolean(u?.v.includes(s)), `${BY_SLUG.get(s)?.nameTr ?? s} levreğe önerilmiyor`);
  }
  // İyi eşleşmeler ayakta kalmalı; veto her şeyi silmemeli.
  for (const s of ['limon', 'maydanoz', 'zeytinyagi', 'biberiye']) {
    check(!u?.v.includes(s), `${BY_SLUG.get(s)?.nameTr ?? s} veto yemiyor`);
  }
  console.log(`  ${u?.v.length} veto · ${u?.d.length} geri plan`);
}


console.log('\n════ 6. BOŞ GİRDİ');
check(buildLabRecipe([], 2) === null, 'boş tabakta null dönüyor');
console.log(`\n${fail === 0 ? '✓ TÜM DENETİMLER GEÇTİ' : `✗ ${fail} DENETİM BAŞARISIZ`}\n`);
process.exit(fail === 0 ? 0 : 1);
