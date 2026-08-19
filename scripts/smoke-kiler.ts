/**
 * "Elimde ne var" eşleştirme denetimi.
 *
 *   npm run smoke:kiler
 *
 * Asıl derdi tek bir hata: kullanıcı et seçtiğinde listenin başına Türk
 * kahvesi gelmesi. Kahvenin malzemesi kahve + su + şeker; ikisi serbest
 * sayıldığı için geriye tek malzeme kalıyordu ve "1 eksik" diye en üste
 * çıkıyordu — elindekilerin hiçbirini kullanmadığı hâlde.
 */

import { BY_SLUG } from '../src/data/catalog/index.ts';
import { matchPantry } from '../src/data/recipes/index.ts';

function show(title: string, slugs: string[]) {
  const pantry = new Set(slugs);
  const matches = matchPantry(pantry);
  const names = slugs.map((s) => BY_SLUG.get(s)?.nameTr ?? s).join(' + ');

  console.log(`\n════ ${title}`);
  console.log(`  kiler: ${names}`);
  console.log(`  sonuç: ${matches.length} tarif`);

  for (const m of matches.slice(0, 8)) {
    const kullanilan = m.matched.map((s) => BY_SLUG.get(s)?.nameTr ?? s).join(', ');
    console.log(
      `  ${m.score.toFixed(2)}  ${m.recipe.title.padEnd(34)} ` +
        `${m.have}/${m.needed} · kullanılan: ${kullanilan}`,
    );
  }
  return matches;
}

const etler = show('Birkaç et çeşidi', ['dana-kusbasi', 'kuzu-but', 'dana-kiyma']);
const karisik = show('Karışık kiler', [
  'kuru-sogan', 'domates', 'patates', 'havuc', 'tavuk-but', 'pirinc', 'yogurt', 'sarimsak',
]);
const tekil = show('Tek malzeme', ['patlican']);

// ── Denetimler ─────────────────────────────────────────────────────

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

console.log('\n════ DENETİM');

const kahve = etler.findIndex((m) => m.recipe.slug === 'turk-kahvesi');
check(kahve === -1, `et kilerinde Türk kahvesi yok${kahve >= 0 ? ` (sıra ${kahve + 1})` : ''}`);

check(
  etler.every((m) => m.matched.length > 0),
  'her sonuç kilerden en az bir malzeme kullanıyor',
);

check(
  etler.every((m) => m.needed >= 3),
  'tek/iki malzemeli sözde tarifler listeye girmiyor',
);

check(
  etler.slice(0, 5).every((m) =>
    ['dana-kusbasi', 'kuzu-but', 'dana-kiyma'].some((s) => m.recipe.allSlugs.includes(s)),
  ),
  'ilk beş sonuç seçilen ana malzemeyi içeriyor',
);

const sirali = karisik.every((m, i) => i === 0 || karisik[i - 1].score >= m.score);
check(sirali, 'sonuçlar puana göre azalan sırada');

check(karisik.length > 0 && karisik[0].have >= 3, 'zengin kilerde ilk sonuç en az 3 malzeme kullanıyor');
check(tekil.length > 0, 'tek malzemeyle de sonuç çıkıyor');

console.log(fail ? `\n${fail} denetim başarısız\n` : '\nTüm denetimler geçti\n');
process.exit(fail ? 1 : 0);
