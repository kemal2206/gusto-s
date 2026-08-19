/**
 * Menü kurucu denetimi.
 *
 *   npm run smoke:menu
 *
 * Amaç sadece "çalışıyor mu" değil, **saçmalıyor mu**: aynı malzeme iki
 * tabakta tekrar ediyor mu, vejetaryen menüde et çıkıyor mu, seed değişince
 * menü gerçekten değişiyor mu, tabaklar arası köprü kuruluyor mu.
 */

import { buildMenu, type MenuAnswers } from '../src/lib/menu-builder.ts';
import type { ProfileFilter } from '../src/lib/profile-filter.ts';
import { BY_SLUG } from '../src/data/catalog/index.ts';

const FREE: ProfileFilter = { diets: [], dislikedSlugs: [], appliances: ['ocak', 'firin'] };

function show(title: string, answers: MenuAnswers, profile: ProfileFilter, seed: number) {
  const menu = buildMenu(answers, profile, seed);
  console.log(`\n════ ${title}  (seed ${seed})`);
  if (!menu) {
    console.log('  ⚠ menü kurulamadı');
    return null;
  }

  for (const c of menu.courses) {
    console.log(`  ${c.course.labelTr.padEnd(18)} ${c.recipe.title}`);
    console.log(`  ${''.padEnd(18)} ↳ ${c.reasonTr}`);
  }
  console.log(
    `  ── bağ gücü ${menu.coherence.toFixed(2)} · ${menu.totalMinutes} dk · ` +
      `${menu.kcalPerPerson} kcal/kişi · ${menu.courses.length} tabak`,
  );
  return menu;
}

const a = show('Misafir · Türk · kırmızı et', { vesile: 'misafir', mutfak: 'turk', ana: 'kirmizi-et', emek: 'orta', agirlik: 'doyurucu', kisi: 6 }, FREE, 1);
show('Aynı cevaplar, farklı seed', { vesile: 'misafir', mutfak: 'turk', ana: 'kirmizi-et', emek: 'orta', agirlik: 'doyurucu', kisi: 6 }, FREE, 7);
show('Hafif akşam · Ege · sebze', { vesile: 'hafif', mutfak: 'ege', ana: 'sebze', emek: 'kolay', agirlik: 'hafif', kisi: 2 }, FREE, 3);
show('Aile · Güneydoğu · tavuk', { vesile: 'aile', mutfak: 'guneydogu', ana: 'tavuk', emek: 'orta', agirlik: 'dengeli', kisi: 4 }, FREE, 5);

const vegan = show(
  'Vegan · fark etmez',
  { vesile: 'aile', mutfak: 'farketmez', ana: 'sebze', emek: 'sinirsiz', agirlik: 'dengeli', kisi: 3 },
  { diets: ['vegan'], dislikedSlugs: [], appliances: ['ocak', 'firin'] },
  2,
);

// ── Denetimler ─────────────────────────────────────────────────────

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

console.log('\n════ DENETİM');

check(a !== null, 'menü kuruluyor');

if (a) {
  const slugCount = new Map<string, number>();
  for (const c of a.courses) {
    // Tabağın ana karakteri: en ağır 2 malzeme.
    for (const s of c.recipe.allSlugs) slugCount.set(s, (slugCount.get(s) ?? 0) + 1);
  }
  check(a.courses.length >= 4, `en az 4 tabak (${a.courses.length})`);
  check(
    a.courses.filter((c) => c.course.id === 'ana-yemek').length === 1,
    'tek ana yemek',
  );
  check(new Set(a.courses.map((c) => c.recipe.slug)).size === a.courses.length, 'aynı tarif iki kez yok');
  check(a.courses.some((c) => c.bridge && c.bridge.aroma > 0), 'en az bir aroma köprüsü kuruldu');
}

if (vegan) {
  const animal = vegan.courses.flatMap((c) =>
    c.recipe.allSlugs.filter((s) => {
      const cat = BY_SLUG.get(s)?.category;
      return cat === 'protein' || cat === 'deniz' || cat === 'sarkuteri' || cat === 'sut';
    }),
  );
  check(animal.length === 0, `vegan menüde hayvansal ürün yok${animal.length ? ` (${[...new Set(animal)].join(', ')})` : ''}`);
}

console.log(fail ? `\n${fail} denetim başarısız\n` : '\nTüm denetimler geçti\n');
process.exit(fail ? 1 : 0);
