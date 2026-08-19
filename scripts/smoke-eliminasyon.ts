/**
 * Eliminasyon denetimi.
 *
 *   npm run smoke:eliminasyon
 *
 * Sağlık gerekçeli süzgeç, tercih süzgecinden farklı bir sorumluluk taşıyor:
 * "patlıcan sevmiyorum" filtresinden bir patlıcan sızarsa can sıkıcı olur,
 * "yumurta beni hasta ediyor" filtresinden bir yumurta sızarsa tehlikeli.
 *
 * Bu yüzden burada tolerans yok: **sıfır sızıntı** aranıyor. Ayrıca her
 * şablonun arkasında kullanılabilir bir korpus kaldığı da ölçülüyor; 30
 * tarif bırakan bir eliminasyon uygulamayı işe yaramaz hâle getirir.
 */

import { INGREDIENTS } from '../src/data/catalog/index.ts';
import { ELIMINATIONS } from '../src/data/catalog/eliminasyon.ts';
import { RECIPES } from '../src/data/recipes/index.ts';
import { isAllowed, type ProfileFilter } from '../src/lib/profile-filter.ts';

const BY = new Map(INGREDIENTS.map((i) => [i.slug, i]));

const BASE: ProfileFilter = { diets: [], dislikedSlugs: [], appliances: ['ocak', 'firin'] };

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail += 1;
};

console.log('\n════ ELİMİNASYON ŞABLONLARI\n');

for (const e of ELIMINATIONS) {
  const filter: ProfileFilter = { ...BASE, eliminations: [e.id] };
  const kalan = RECIPES.filter((r) => isAllowed(r, filter));

  /**
   * Bağımsız doğrulama: kalan tariflerin hiçbirinde yasak malzeme
   * bulunmamalı. Şablonun kendi kuralını değil, malzeme listesini okuyoruz.
   */
  const sizan = kalan.filter((r) =>
    r.allSlugs.some(
      (s) => e.slugs.includes(s) || (e.categories ?? []).includes(BY.get(s)?.category ?? ''),
    ),
  );

  console.log(`  ${e.labelTr}`);
  console.log(`    ${kalan.length} tarif kalıyor (%${((kalan.length / RECIPES.length) * 100).toFixed(0)})`);
  check(sizan.length === 0, `sıfır sızıntı${sizan.length ? ` — ${sizan.slice(0, 3).map((r) => r.title).join(' · ')}` : ''}`);
  check(kalan.length >= 300, `kullanılabilir korpus kalıyor (${kalan.length})`);

  // Her ana kategoride bir şeyler kalmalı, yoksa "akşam ne pişireyim" cevapsız.
  const kategoriler = new Set(kalan.map((r) => r.categoryId));
  check(
    ['etli-sulu', 'meze-salata', 'corba'].every((c) => kategoriler.has(c)),
    `ana yemek, meze ve çorba kategorilerinde tarif var (${kategoriler.size} kategori)`,
  );
  console.log('');
}

// ── Kendi listen ───────────────────────────────────────────────────

console.log('════ KENDİ LİSTEN\n');
const kendi: ProfileFilter = { ...BASE, excludedSlugs: ['yumurta', 'sut', 'findik'] };
const kendiKalan = RECIPES.filter((r) => isAllowed(r, kendi));
const kendiSizan = kendiKalan.filter((r) =>
  ['yumurta', 'sut', 'findik'].some((s) => r.allSlugs.includes(s)),
);
console.log(`  yumurta + süt + fındık çıkarıldı → ${kendiKalan.length} tarif`);
check(kendiSizan.length === 0, 'sıfır sızıntı');

// ── Şablon + kendi liste birlikte ──────────────────────────────────

const birlikte: ProfileFilter = {
  ...BASE,
  eliminations: ['histamin'],
  excludedSlugs: ['nohut'],
};
const bKalan = RECIPES.filter((r) => isAllowed(r, birlikte));
const bSizan = bKalan.filter(
  (r) =>
    r.allSlugs.includes('nohut') ||
    r.allSlugs.some((s) => ELIMINATIONS[1].slugs.includes(s)),
);
console.log('');
console.log(`  histamin şablonu + nohut → ${bKalan.length} tarif`);
check(bSizan.length === 0, 'şablon ve kendi liste birlikte çalışıyor');

console.log(fail ? `\n${fail} denetim başarısız\n` : '\nTüm denetimler geçti\n');
process.exit(fail ? 1 : 0);
