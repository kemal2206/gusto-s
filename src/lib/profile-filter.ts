/**
 * Profile göre tarif eleme ve ölçekleme.
 *
 * Açılış sorularının karşılığı burada. Üç farklı sertlikte kural var ve
 * ayrımı önemli:
 *
 *  - **Diyet** sert filtre. Vegan diyen birine etli tarif göstermek hata.
 *  - **Sevmediği malzeme** sert filtre ama alerjiden farklı: kullanıcı
 *    tercihi, sağlık meselesi değil.
 *  - **Ekipman** yumuşak: fırını yoksa fırın tarifi listenin dibine düşüyor
 *    ama tamamen kaybolmuyor — komşusunun fırınında pişirebilir.
 */

import { BY_SLUG } from '@/data/catalog';
import { ELIMINATION_BY_ID } from '@/data/catalog/eliminasyon';
import { herhangiBiri, kelimeBasi, tamKelime } from '@/data/catalog/tr-kelime';
import type { Recipe } from '@/data/recipes';
import type { Appliance, DietRestriction, Household } from '@/lib/profile-model';
import { eaterCount } from '@/lib/profile-model';

/** Diyet kısıtına takılan malzeme kategorileri ve slug'lar. */
const DIET_BLOCK: Record<DietRestriction, { categories?: string[]; slugs?: string[]; allergens?: string[] }> = {
  vegan: {
    categories: ['protein', 'deniz', 'sarkuteri', 'sut'],
    slugs: ['yumurta', 'bal', 'et-suyu', 'tavuk-suyu', 'balik-sosu', 'mayonez', 'krem-santi'],
  },
  vejetaryen: {
    categories: ['protein', 'deniz', 'sarkuteri'],
    slugs: ['et-suyu', 'tavuk-suyu', 'balik-sosu'],
    // Yumurta ve süt vejetaryene serbest.
  },
  pesketaryen: {
    categories: ['protein', 'sarkuteri'],
    slugs: ['et-suyu', 'tavuk-suyu'],
  },
  laktozsuz: { categories: ['sut'], allergens: ['laktoz'] },
  glutensiz: { allergens: ['gluten'] },
  domuzsuz: { slugs: [] }, // katalogda domuz ürünü yok; kural yine de duruyor
};

/** Yöntemi hangi ekipman gerektiriyor. */
const METHOD_APPLIANCE: Record<string, Appliance[]> = {
  firin: ['firin', 'airfryer'],
  izgara: ['ocak', 'firin'],
  komur: ['ocak'],
  tava: ['ocak'],
  sulu: ['ocak', 'dusuk-tencere'],
  haslama: ['ocak'],
  kizartma: ['ocak', 'fritoz', 'airfryer'],
  buhar: ['ocak'],
  wok: ['ocak'],
  karistir: ['blender'],
  cig: [],
  dinlendir: [],
};

export interface ProfileFilter {
  diets: DietRestriction[];
  dislikedSlugs: string[];
  appliances: Appliance[];
  /** Sağlık gerekçeli eliminasyon şablonları — `eliminasyon.ts` kimlikleri. */
  eliminations?: string[];
  /** Kullanıcının kendi çıkardığı malzemeler. */
  excludedSlugs?: string[];
}

/**
 * Ad üzerinden ikinci güvenlik ağı.
 *
 * Malzeme listesi her zaman dürüst değil: içe aktarılan korpusta adı "Tavuklu
 * Salata" olup malzemesinde tavuk görünmeyen tarifler çıkıyor (ölçü satırı
 * eşleşmemiş). Vejetaryen birine et göstermek, bir tarifi fazladan elemekten
 * çok daha kötü — bu yüzden ada da bakıyoruz.
 */
/**
 * Kelime sınırları `tr-kelime.ts`'ten geliyor ve şart. Kalıplar önceden düz
 * içerme kontrolüydü: "lezzetli" diyen her sebze yemeği vejetaryen
 * süzgecinden eleniyordu (`etli`), "kavun" da glutensizden (`un`).
 *
 * Vegan satırında ayrıca bozuk bir kaçış vardı — `\b` yerine dosyaya gerçek
 * backspace karakteri yazılmış, o yüzden "et" kalıbı hiçbir şeyle
 * eşleşmiyordu ve sessizce ölüydü.
 *
 * İki istisna elle yazılı:
 *   hindi   "Hindistan cevizi" hayvansal değil
 *   kuzu    "kuzugöbeği" bir mantar
 */
const ET = ['tavuk', 'piliç', 'hindi(?!stan)', 'kuzu(?!göbeği)', 'dana', 'sucuk',
  'pastırma', 'kıyma', 'köfte', 'kebap', 'ciğer'];
const DENIZ = ['balık', 'karides', 'midye', 'kalamar', 'hamsi', 'somon', 'uskumru', 'palamut'];
const SUT = ['peynir', 'yoğurt', 'sütlü', 'sütlaç', 'kaymak', 'tereyağ', 'krema',
  'muhallebi', 'beşamel'];
const HAMUR = ['börek', 'pide', 'makarna', 'erişte', 'mantı', 'ekmek', 'poğaça', 'açma',
  'çörek', 'baklava', 'kadayıf', 'lahmacun'];

const NAME_BLOCK: Partial<Record<DietRestriction, RegExp[]>> = {
  vegan: [kelimeBasi(...ET, ...DENIZ, ...SUT, 'etli', 'yumurta', 'süt'), tamKelime('et', 'bal')],
  vejetaryen: [kelimeBasi(...ET, ...DENIZ, 'etli'), tamKelime('et')],
  pesketaryen: [kelimeBasi(...ET, 'etli'), tamKelime('et')],
  laktozsuz: [kelimeBasi(...SUT)],
  glutensiz: [kelimeBasi(...HAMUR), tamKelime('un')],
};

/** Tarif diyet kısıtlarına, eliminasyonlara ve sevilmeyenlere uyuyor mu? */
export function isAllowed(recipe: Recipe, p: ProfileFilter): boolean {
  if (p.dislikedSlugs.some((s) => recipe.allSlugs.includes(s))) return false;
  if (p.excludedSlugs?.some((s) => recipe.allSlugs.includes(s))) return false;

  /**
   * Eliminasyon şablonları sağlık gerekçeli, o yüzden diyet kısıtlarından
   * daha katı davranıyoruz: malzeme listesine de tarif adına da bakılıyor.
   * İçe aktarılan korpusta adı "Sütlü Tatlı" olup sütü eşleşmemiş tarifler
   * var; tercih filtresinde bu küçük bir hata, burada değil.
   */
  for (const id of p.eliminations ?? []) {
    const rule = ELIMINATION_BY_ID.get(id as never);
    if (!rule) continue;

    if (rule.nameBlock.test(recipe.title) || rule.nameBlock.test(recipe.summary)) return false;
    if (rule.slugs.some((s) => recipe.allSlugs.includes(s))) return false;
    if (
      rule.categories?.some((c) => recipe.allSlugs.some((s) => BY_SLUG.get(s)?.category === c))
    ) {
      return false;
    }
  }

  for (const diet of p.diets) {
    const nameRes = NAME_BLOCK[diet];
    if (nameRes && herhangiBiri(nameRes, recipe.title, recipe.summary)) return false;

    const rule = DIET_BLOCK[diet];
    if (!rule) continue;

    for (const slug of recipe.allSlugs) {
      const ing = BY_SLUG.get(slug);
      if (!ing) continue;
      if (rule.slugs?.includes(slug)) return false;
      if (rule.categories?.includes(ing.category)) return false;
      if (rule.allergens?.some((a) => ing.allergenTags.includes(a))) return false;
    }
  }
  return true;
}

/** Ekipman uyumu 0–1. Sert filtre değil, sıralama sinyali. */
export function applianceFit(recipe: Recipe, appliances: Appliance[]): number {
  const methods = recipe.components.map((c) => c.method);
  if (!methods.length) return 1;

  const ok = methods.filter((m) => {
    const needed = METHOD_APPLIANCE[m] ?? [];
    return needed.length === 0 || needed.some((a) => appliances.includes(a));
  }).length;

  return ok / methods.length;
}

/**
 * Profile göre süz ve sırala.
 *
 * Elemeyi geçenler arasında ekipmanı tutan tarifler öne alınıyor; sıra
 * bozulmasın diye orijinal sıralama ikincil anahtar olarak korunuyor.
 */
export function applyProfile(recipes: Recipe[], p: ProfileFilter): Recipe[] {
  return recipes
    .filter((r) => isAllowed(r, p))
    .map((r, i) => ({ r, i, fit: applianceFit(r, p.appliances) }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map((x) => x.r);
}

// ── Porsiyon ölçekleme ─────────────────────────────────────────────

export interface ScaledIngredient {
  slug: string;
  grams: number;
  note?: string;
}

/**
 * Tarifi hanenin kişi sayısına göre ölçekler.
 *
 * Baharat doğrusal ölçeklenmiyor: 4 kişilik tarifi 12 kişiye çıkarırken
 * karabiberi üçe katlamak yemeği acıtır. Ama bu kural iki yerde yanlış
 * uygulanıyordu ve tadı gerçekten bozuyordu — ikisi de düzeltildi, gerekçesi
 * `scaleGrams` içinde.
 */
export function scaleFactor(recipe: Recipe, household: Household): number {
  return scaleFactorFor(recipe, eaterCount(household));
}

/**
 * Haneden bağımsız, verilen kişi sayısına ölçek.
 *
 * Tarif sayfasındaki "kişilik" butonu bunu kullanıyor: misafir geldiğinde
 * hane ayarını değiştirmeden o tarifi altı kişiye çıkarabilmek gerekiyor.
 */
export function scaleFactorFor(recipe: Recipe, people: number): number {
  return Math.max(1, people) / Math.max(1, recipe.servings);
}

export function scaleGrams(slug: string, grams: number, factor: number): number {
  const ing = BY_SLUG.get(slug);
  const potency = ing?.potency ?? 1;

  /**
   * Sönümleme yalnızca BÜYÜTMEDE ve malzemenin gücüyle orantılı.
   *
   * Eski hâli iki yerden hatalıydı ve ikisi de ölçüldü:
   *
   *  **1. Küçültmede de sönümlüyordu.** Karekök simetrik çalışıyor: 4 kişilik
   *  tarifi 2 kişiye indirince baharat yarıya değil %71'e iniyordu, yani
   *  kişi başına baharat %50 ARTIYORDU. 1 kişide iki katına çıkıyordu.
   *  Varsayılan hane 2 kişi ve tarifler 4 kişilik yazılıyor — yani bu, çoğu
   *  kullanıcının gördüğü hâldi. Mutfaktaki "baharatı doğrusal artırma"
   *  kuralı büyük partiler içindir; tersi diye bir şey yok. Küçültmede
   *  ölçek artık birebir.
   *
   *  **2. Kategoriye bakıyordu, güce değil.** "Baharat" kategorisindeki her
   *  şeye aynı karekök uygulanıyordu; oysa safran ile kimyon aynı şey değil.
   *  Katalog zaten `potency` tutuyor (patates 1, sarımsak 4, karabiber 8,
   *  safran 10) — sönümleme artık ondan geliyor. Gücü 2'nin altındaki
   *  malzeme doğrusal ölçekleniyor.
   *
   * Karekök (üs 0.5) ayrıca fazla sertti: 12 kişide baharat derişimi %58'e
   * düşüyordu. Yeni üs karabiberde 0.7, safranda 0.65 — 12 kişide %72.
   */
  const damping = Math.min(0.35, Math.max(0, (potency - 2) / 20));
  const exponent = factor <= 1 ? 1 : 1 - damping;
  const out = grams * Math.pow(factor, exponent);
  return out < 5 ? Math.round(out * 2) / 2 : Math.round(out);
}
