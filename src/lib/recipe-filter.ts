/**
 * "Canım ne istiyor?" sihirbazının cevaplarını tarif filtresine çevirir.
 *
 * Her adım bir eleme değil bir **puan** veriyor. Sert filtre kullanınca dört
 * cevabın kesişimi çoğu zaman boş çıkıyordu; puanlama ile liste hiç boş
 * kalmıyor, en uygunlar başa geliyor.
 */

import { BY_SLUG, INGREDIENTS } from '@/data/catalog';
import { RECIPES, type Recipe } from '@/data/recipes';
import { nutritionOf } from '@/lib/recipe-facts';
import { dishTaste, heatLevel, ingredientCount, isOnePot } from '@/lib/recipe-taste';
import { COLLECTION_BY_ID, hasAnimalProduct, plantShare } from '@/lib/koleksiyon';

/** Ana malzeme seçimi → hangi malzemeler / kategoriler sayılıyor. */
interface MainRule {
  slugs?: string[];
  categories?: string[];
  recipeCat?: string;
  /**
   * Bu kategorilerden biri tabakta ağırlık tutuyorsa tarif elenir.
   * "Sebze yemeği" isteyene salamlı ekmek göstermemek için.
   */
  excludeCategories?: string[];
  /** Birden çok tarif kategorisi — "makarna ve pilav" gibi. */
  recipeCats?: string[];
  /** Bu malzeme grubunun tabakta en az bu kadar payı olmalı. */
  minShare?: number;
  /** Bu tarif kategorileri bu kutuya hiç girmiyor. */
  excludeRecipeCats?: string[];
}

const MAIN_MATCH: Record<string, MainRule> = {
  tavuk: { slugs: ['tavuk-but', 'tavuk-gogsu', 'hindi', 'bildircin'] },
  'kirmizi-et': {
    slugs: ['kuzu-but', 'kuzu-pirzola', 'kuzu-incik', 'kuzu-kiyma', 'dana-antrikot',
            'dana-kusbasi', 'dana-kiyma', 'dana-kaburga', 'kuzu-cigeri', 'kavurma'],
  },
  balik: { categories: ['deniz'] },
  sebze: {
    categories: ['sebze', 'mantar', 'baklagil'],
    // Bir dilim sucuk bile "sebze yemeği" olmaktan çıkarıyor.
    excludeCategories: ['protein', 'deniz', 'sarkuteri'],
    // Tabağın dörtte biri sebze değilse bu sebze yemeği değil.
    minShare: 0.25,
  },
  /**
   * Kasten yalnızca makarna slug'ları.
   *
   * Önce `categories: ['tahil']` yazıyordu ve tahıl kategorisi una, ekmeğe,
   * bulgura kadar her şeyi kapsadığı için "makarna istiyorum" diyene pizza,
   * tost ve şehriyeli çorba geliyordu. Kategori yerine malzemenin kendisi
   * aranıyor; %15 pay kuralı da bir tutam şehriyeli çorbayı eliyor.
   */
  hamur: {
    slugs: ['makarna', 'eriste', 'sehriye', 'arpa-sehriye', 'ramen-eristesi', 'pirinc-eristesi', 'kuskus'],
    /**
     * Yalnızca "Pilav ve makarna" kategorisi. `hamur-isi` de eklenmişti ve
     * pizza, ekmek dilimi, poğaça bu kutuya doluyordu — kutunun adı makarna
     * ve pilav diyorsa börek oraya girmemeli. Börek ana sayfadaki "Hamur işi"
     * kategorisinden erişiliyor.
     */
    recipeCats: ['pilav-makarna'],
    /**
     * Çorba bu kutuya girmiyor: şehriyeli tarhana çorbasında arpa şehriyenin
     * payı eşiği geçebiliyor ama o bir çorba, makarna değil. Çorbanın kendi
     * kutusu var.
     */
    excludeRecipeCats: ['corba'],
  },
  corba: { recipeCat: 'corba' },
};

/**
 * Tat seçimi → tabağın gerçek tat profiline bakan puanlama.
 *
 * Eskiden malzeme adına bakıyordu: "tarifte pul biber var mı?" Bir tutam
 * pul biberli mercimek çorbası da baharatlı sayılıyordu. Artık motorun
 * hesapladığı tat vektörüne bakıyor — miktar ve etki gücü dâhil.
 *
 * Eşikler korpusun kendi dağılımından (3.119 tarif, eksenler 0–10):
 *   tatlı  medyan 1,86 · %75 3,16 · %90 4,88
 *   umami  medyan 2,33 · %75 3,58
 *   yağ    medyan 2,02 · %75 3,05
 *   ekşi   medyan 0,52 · %75 1,22
 *   kalori medyan 381 · %75 632
 */
type TasteScorer = (recipe: Recipe) => { score: number; matched: boolean };

const TASTE_SCORERS: Record<string, TasteScorer> = {
  hafif: (r) => {
    const t = dishTaste(r);
    const kcal = nutritionOf(r).kcal;
    let s = 0;
    if (kcal > 0 && kcal <= 380) s += 3;
    if (t.fat <= 1.5) s += 2;
    if (t.sour >= 1.2) s += 1.5;
    if (kcal >= 700) s -= 3;
    if (t.fat >= 3.5) s -= 2;
    return { score: s, matched: s >= 3 };
  },

  doyurucu: (r) => {
    const t = dishTaste(r);
    const kcal = nutritionOf(r).kcal;
    let s = 0;
    if (kcal >= 600) s += 3;
    if (t.umami >= 3.5) s += 2;
    if (t.fat >= 3) s += 1.5;
    if (kcal > 0 && kcal <= 250) s -= 3;
    return { score: s, matched: s >= 3 };
  },

  baharatli: (r) => {
    const level = heatLevel(r);
    if (level === 'cok-acili') return { score: 6, matched: true };
    if (level === 'acili') return { score: 4.5, matched: true };
    if (level === 'az-aci') return { score: 1, matched: false };
    // Acısız tarif "baharatlı" isteğinin cevabı değil.
    return { score: -4, matched: false };
  },

  tatli: (r) => {
    const t = dishTaste(r);
    if (r.categoryId === 'tatli') return { score: 5, matched: true };
    if (t.sweet >= 4) return { score: 3, matched: true };
    if (t.sweet <= 1.5) return { score: -3, matched: false };
    return { score: 0.5, matched: false };
  },
};

/**
 * Beslenme hedefi.
 *
 * Eşikler yine korpusun dağılımından: porsiyon başına kalori medyanı 381,
 * %75 dilimi 632. Protein için 25 g eşiğini 555 tarif karşılıyor — liste
 * boşaltmayacak kadar geniş, ayırt edici olacak kadar dar.
 *
 * "Kalori" hesabı malzeme gramajlarından türetilen bir **tahmin**; etiket
 * değeri değil. Bu yüzden eşikler kaba tutuldu, hassas bir diyet aracı gibi
 * davranmıyoruz.
 */
const GOAL_SCORERS: Record<string, TasteScorer> = {
  hafif: (r) => {
    const n = nutritionOf(r);
    if (!n.kcal) return { score: 0, matched: false };
    if (n.kcal <= 300) return { score: 4, matched: true };
    if (n.kcal <= 450) return { score: 2.5, matched: true };
    if (n.kcal >= 800) return { score: -3, matched: false };
    return { score: 0, matched: false };
  },

  'yuksek-protein': (r) => {
    const n = nutritionOf(r);
    if (n.protein >= 35) return { score: 4, matched: true };
    if (n.protein >= 25) return { score: 3, matched: true };
    if (n.protein <= 10) return { score: -3, matched: false };
    return { score: 0, matched: false };
  },

  'dusuk-karbonhidrat': (r) => {
    const n = nutritionOf(r);
    const total = n.protein + n.carbs + n.fat;
    if (total <= 0) return { score: 0, matched: false };
    const pay = n.carbs / total;
    if (pay <= 0.25) return { score: 4, matched: true };
    if (pay <= 0.4) return { score: 2, matched: true };
    if (pay >= 0.65) return { score: -3, matched: false };
    return { score: 0, matched: false };
  },
};

/**
 * Ayrıntı seçeneklerinin karşılığı.
 *
 * Hem ana malzemeye özel sorular ("tavuğun hangi parçası") hem seçkiye özel
 * sorular ("sağlıklıdan ne anlıyorsun") aynı mekanizmayı kullanıyor: seçilen
 * değer burada bir malzeme/kategori kümesine ya da bir ölçüte bağlanıyor.
 * Tek bir adım kimliğiyle onlarca soru sorulabiliyor.
 */
const DETAIL_RULES: Record<
  string,
  { slugs?: string[]; categories?: string[]; recipeCat?: string; test?: (r: Recipe) => boolean }
> = {
  // Tavuk
  'tavuk-gogus': { slugs: ['tavuk-gogsu'] },
  'tavuk-but': { slugs: ['tavuk-but'] },

  // Kırmızı et
  'et-kiyma': { slugs: ['dana-kiyma', 'kuzu-kiyma'] },
  'et-parca': {
    slugs: ['dana-kusbasi', 'kuzu-but', 'dana-antrikot', 'kuzu-pirzola', 'kuzu-incik', 'dana-kaburga'],
  },

  // Balık
  'balik-kucuk': { slugs: ['hamsi', 'uskumru', 'palamut'] },
  'balik-beyaz': { slugs: ['levrek', 'cipura', 'alabalik'] },
  'deniz-kabuklu': { slugs: ['karides', 'midye', 'kalamar'] },

  // Sebze
  'sebze-patlican': { slugs: ['patlican'] },
  'sebze-yesil': { slugs: ['ispanak', 'pazi', 'semizotu', 'taze-fasulye', 'bezelye', 'bakla'] },
  'sebze-kok': { slugs: ['patates', 'havuc', 'kereviz', 'pancar', 'yer-elmasi'] },
  'sebze-mantar': { categories: ['mantar'] },

  // Çorba
  'corba-mercimek': { slugs: ['kirmizi-mercimek', 'yesil-mercimek'] },
  'corba-yogurtlu': { slugs: ['yogurt', 'suzme-yogurt', 'tarhana'] },
  'corba-etli': { categories: ['protein'] },
  'corba-sebze': { categories: ['sebze'] },

  // Hamur ve tahıl
  // Kategori değil malzeme: "Perde Pilavı" da pilav-makarna kategorisinde.
  'hamur-makarna': { slugs: ['makarna', 'eriste', 'sehriye', 'arpa-sehriye', 'kuskus'] },
  'hamur-pilav': { slugs: ['pirinc', 'bulgur', 'ince-bulgur'] },
  'hamur-borek': { recipeCat: 'hamur-isi' },

};

function detailScore(recipe: Recipe, value: string): { score: number; matched: boolean } {
  const rule = DETAIL_RULES[value];
  if (!rule) return { score: 0, matched: false };

  if (rule.test) {
    return rule.test(recipe) ? { score: 3.5, matched: true } : { score: -1.5, matched: false };
  }

  const bySlug = rule.slugs?.some((s) => recipe.allSlugs.includes(s)) ?? false;
  const byCat =
    rule.categories?.some((c) => recipe.allSlugs.some((s) => BY_SLUG.get(s)?.category === c)) ?? false;
  const byRecipeCat = rule.recipeCat === recipe.categoryId;

  if (bySlug || byRecipeCat) return { score: 3.5, matched: true };
  if (byCat) return { score: 2, matched: true };
  return { score: -1.5, matched: false };
}

/** Acılık kademesi sorusu — "baharatlı" seçildiğinde soruluyor. */
const HEAT_WANT: Record<string, { levels: string[]; bonus: number }> = {
  'az-aci': { levels: ['az-aci', 'acili'], bonus: 4 },
  'cok-acili': { levels: ['acili', 'cok-acili'], bonus: 4 },
};

/**
 * Emek seçimi.
 *
 * "Tek tencere" 1.802 tarifi, "az malzeme" 641 tarifi karşılıyor; ikisi de
 * liste boşaltacak kadar dar değil.
 */
const EFFORT_SCORERS: Record<string, TasteScorer> = {
  'az-malzeme': (r) => {
    const n = ingredientCount(r);
    if (n <= 6) return { score: 4, matched: true };
    if (n <= 8) return { score: 2, matched: true };
    if (n >= 14) return { score: -2, matched: false };
    return { score: 0, matched: false };
  },

  'az-adim': (r) => {
    const steps = r.components.reduce((n, c) => n + c.steps.length, 0);
    if (steps <= 5) return { score: 4, matched: true };
    if (steps <= 7) return { score: 2, matched: true };
    if (steps >= 12) return { score: -2, matched: false };
    return { score: 0, matched: false };
  },

  'uzun-tarif': (r) => {
    const steps = r.components.reduce((n, c) => n + c.steps.length, 0);
    if (steps >= 8 || r.difficulty === 3) return { score: 3, matched: true };
    if (steps <= 4) return { score: -2, matched: false };
    return { score: 0, matched: false };
  },
};

const METHOD_MATCH: Record<string, string[]> = {
  firin: ['firin'],
  ocak: ['tava', 'sulu', 'haslama', 'kizartma', 'wok', 'karistir'],
  izgara: ['izgara', 'komur'],
};

export interface FilterAnswers {
  /** Özel seçki — seçilirse sert süzgeç olarak uygulanıyor. */
  koleksiyon?: string;
  'ana-malzeme'?: string;
  /** Ana malzemeye özel ayrıntı: hangi parça, hangi balık, nasıl bir çorba. */
  detay?: string;
  tat?: string;
  acilik?: string;
  hedef?: string;
  emek?: string;
  sure?: string;
  yontem?: string;
}

/**
 * Aynı cevaplara her seferinde aynı listeyi vermemek için.
 *
 * `seed` her turda değişiyor, `shown` daha önce gösterilenleri sayıyor.
 * İkisi de isteğe bağlı — verilmezse filtre eskisi gibi deterministik.
 */
export interface VarietyOptions {
  seed: number;
  shown: Record<string, number>;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  /** Hangi cevaplara uyduğu — kullanıcıya gerekçe göstermek için. */
  matched: string[];
}

/**
 * Ana malzemenin tabaktaki gram payı.
 *
 * "Tarifte tavuk geçiyor mu" sorusu yetmiyordu: jambonlu sandviçte bir dilim
 * hindi, kıymalı poğaçada bir avuç kıyma var ve ikisi de tavuk/et yemeği
 * olarak listeye giriyordu. Pay hesabı bunu ayırıyor.
 *
 * Su paydadan çıkarılıyor: çorbanın 1 kg suyu her malzemenin payını sahte
 * biçimde küçültüyor.
 */
function mainShare(recipe: Recipe, rule: MainRule): number {
  let matchedGrams = 0;
  let totalGrams = 0;

  for (const c of recipe.components) {
    for (const ri of c.ingredients) {
      if (ri.slug === 'su' || ri.slug === 'et-suyu' || ri.slug === 'tavuk-suyu') continue;
      totalGrams += ri.grams;

      const hit =
        (rule.slugs?.includes(ri.slug) ?? false) ||
        (rule.categories?.includes(BY_SLUG.get(ri.slug)?.category ?? '') ?? false);
      if (hit) matchedGrams += ri.grams;
    }
  }

  return totalGrams > 0 ? matchedGrams / totalGrams : 0;
}

/**
 * Slug ve tohumdan üretilen küçük, tekrarlanabilir sarsıntı.
 *
 * Amaç sıralamayı bozmak değil, **eşitliği bozmak**: puanlar tam sayı
 * adımlarla ilerlediği için onlarca tarif aynı puanda toplanıyor ve hep
 * aynı sırada çıkıyordu. ±0,45'lik sarsıntı bir puanlık farkı asla
 * aşmıyor, yani daha kötü bir tarif daha iyisinin önüne geçemiyor.
 */
function jitter(slug: string, seed: number): number {
  let h = seed * 2654435761;
  for (let i = 0; i < slug.length; i += 1) h = (Math.imul(h ^ slug.charCodeAt(i), 16777619) >>> 0);
  return ((h % 1000) / 1000 - 0.5) * 0.9;
}

export function filterRecipes(
  answers: FilterAnswers,
  limit = 40,
  variety?: VarietyOptions,
): ScoredRecipe[] {
  const out: ScoredRecipe[] = [];

  // Seçki sert süzgeç: "15 dakikadan az" listesinde 40 dakikalık tarif olmaz.
  const collection = answers.koleksiyon ? COLLECTION_BY_ID.get(answers.koleksiyon) : undefined;

  for (const recipe of RECIPES) {
    if (collection && !collection.match(recipe)) continue;

    let score = collection ? 3 : 0;
    const matched: string[] = collection ? ['seçki'] : [];

    // ── Ana malzeme ────────────────────────────────────────────
    const main = answers['ana-malzeme'] ? MAIN_MATCH[answers['ana-malzeme']] : undefined;
    if (main) {
      const byRecipeCat =
        main.recipeCat === recipe.categoryId ||
        (main.recipeCats?.includes(recipe.categoryId) ?? false);

      if (main.excludeRecipeCats?.includes(recipe.categoryId)) continue;

      // Sebze yemeği isteyene, içinde et olan tarif hiç gitmesin.
      if (main.excludeCategories) {
        const meat = mainShare(recipe, { categories: main.excludeCategories });
        if (meat > 0) continue;
      }

      const share = mainShare(recipe, main);
      if (main.minShare && share < main.minShare) continue;

      if (byRecipeCat) {
        score += 6;
        matched.push('malzeme');
      } else if (share >= 0.15) {
        // Tabağın altıda birinden fazlası bu malzemeyse aranan yemek bu.
        score += 6;
        matched.push('malzeme');
      } else if (share >= 0.05) {
        score += 2;
      } else {
        // Ana malzeme yok ya da yanında bir dilim olarak duruyor:
        // "jambonlu sandviç" tavuk yemeği, "kıymalı poğaça" et yemeği değil.
        continue;
      }
    }

    // ── Tat ────────────────────────────────────────────────────
    const scorer = answers.tat ? TASTE_SCORERS[answers.tat] : undefined;
    if (scorer) {
      const res = scorer(recipe);
      score += res.score;
      if (res.matched) matched.push('tat');
    }

    // ── Acılık kademesi ────────────────────────────────────────
    const heat = answers.acilik ? HEAT_WANT[answers.acilik] : undefined;
    if (heat) {
      if (heat.levels.includes(heatLevel(recipe))) {
        score += heat.bonus;
        matched.push('acılık');
      } else {
        score -= 2;
      }
    }

    /**
     * ── Ayrıntı soruları ───────────────────────────────────────
     *
     * Sert süzgeç. "Beyaz balık" diyene hamsi, "börek" diyene şehriye
     * çorbası göstermek cevabı yok saymak demek; puan düşürmek yetmiyordu,
     * tutmayan tarifler yine ilk sıralarda kalıyordu.
     */
    if (answers.detay) {
      const res = detailScore(recipe, answers.detay);
      if (!res.matched) continue;
      score += res.score;
      matched.push('ayrıntı');
    }

    // ── Beslenme hedefi ────────────────────────────────────────
    const goal = answers.hedef ? GOAL_SCORERS[answers.hedef] : undefined;
    if (goal) {
      const res = goal(recipe);
      score += res.score;
      if (res.matched) matched.push('hedef');
    }

    // ── Emek ───────────────────────────────────────────────────
    const effort = answers.emek ? EFFORT_SCORERS[answers.emek] : undefined;
    if (effort) {
      const res = effort(recipe);
      score += res.score;
      if (res.matched) matched.push('emek');
    }

    // ── Süre ───────────────────────────────────────────────────
    if (answers.sure) {
      const limitMin = Number(answers.sure);
      if (recipe.totalMinutes <= limitMin) {
        score += limitMin >= 999 ? 0.5 : 3;
        matched.push('süre');
      } else if (limitMin < 999) {
        // Süreyi aşan tarif tamamen elenmiyor ama geriye düşüyor.
        score -= 2;
      }
    }

    // ── Yöntem ─────────────────────────────────────────────────
    if (answers.yontem === 'tek-tencere') {
      /**
       * "Tek tencerede" bir pişirme yöntemi değil bir **kurulum**: tek
       * bileşen, tek kap, ayrı sos yok. Emek sorusundan buraya taşındı,
       * çünkü orada dururken bir sonraki adım "fırında mı ızgarada mı"
       * diye sorup kendisiyle çelişiyordu.
       */
      if (isOnePot(recipe)) {
        score += 3;
        matched.push('yöntem');
      } else {
        score -= 2;
      }
    } else if (answers.yontem) {
      const wanted = METHOD_MATCH[answers.yontem] ?? [];
      if (recipe.components.some((c) => wanted.includes(c.method))) {
        score += 2.5;
        matched.push('yöntem');
      }
    }

    if (score <= 0) continue;

    if (variety) {
      /**
       * Daha önce gösterilen tarif bir basamak geri çekiliyor.
       *
       * Ceza büyüklüğü keyfi değil, **puan basamağına göre**: puanlar
       * öbekleniyor (tipik bir sorguda 15,50 → 14,00 → 12,00) ve bantlar
       * arası fark 1,5–2 puan. Daha küçük bir ceza hiçbir şeyi değiştirmiyor,
       * çok büyüğü alakasız tarifi öne atıyor. 2 puan tam bir bant demek:
       * gördüğün tarif bir alt bandın arkasına geçiyor, listeden düşmüyor.
       *
       * Tavan 4 puan — iki bant. Üç kez görülen tarif bile hâlâ listede.
       */
      const seen = variety.shown[recipe.slug] ?? 0;
      score -= Math.min(4, seen * 2);
      score += jitter(recipe.slug, variety.seed);
    }

    out.push({ recipe, score, matched });
  }

  return out
    .sort((a, b) => b.score - a.score || a.recipe.totalMinutes - b.recipe.totalMinutes)
    .slice(0, limit);
}

// ── Lab: seçilen malzemelere göre tarif ────────────────────────────

export interface PickMatch {
  recipe: Recipe;
  /** Seçilenlerden kaçı bu tarifte var. */
  shared: number;
  sharedSlugs: string[];
  /**
   * Hangi kademeden geldi. Arayüz bunu söylemek zorunda: "kuzu incik tarifi
   * yok, kuzu but tarifleri gösteriliyor" demek, sessizce başka bir şey
   * göstermekten dürüst.
   */
  level: 'tam' | 'akraba' | 'kategori';
}

/**
 * Lab'de o ana kadar seçilen malzemeleri içeren tarifler.
 *
 * Amaç kullanıcıya "kurduğun şeyin gerçek dünyada karşılığı bu" demek:
 * kuzu + soğan + salça seçtiyse ona etli sulu yemek tarifleri görünüyor.
 * Ana malzeme (ilk seçim) zorunlu, kalanlar puan ekliyor.
 */
export function recipesForPicks(slugs: string[], limit = 8): PickMatch[] {
  if (!slugs.length) return [];
  const [main] = slugs;

  const collect = (accept: (r: Recipe) => boolean, level: PickMatch['level']): PickMatch[] => {
    const out: PickMatch[] = [];
    for (const recipe of RECIPES) {
      if (!accept(recipe)) continue;
      const sharedSlugs = slugs.filter((s) => recipe.allSlugs.includes(s));
      out.push({ recipe, shared: sharedSlugs.length, sharedSlugs, level });
    }
    return out.sort(
      (a, b) =>
        b.shared - a.shared ||
        // Eşitlikte daha az malzemeli tarif önce: kurduğuna daha yakın.
        a.recipe.allSlugs.length - b.recipe.allSlugs.length,
    );
  };

  // 1. Tam eşleşme — ana malzemenin kendisi tarifte var.
  const exact = collect((r) => r.allSlugs.includes(main), 'tam');
  if (exact.length) return exact.slice(0, limit);

  /**
   * 2. Akrabalık düşüşü.
   *
   * Katalogdaki `kin` alanı aynı şeyin farklı hâllerini bağlıyor (kuzu but /
   * kuzu incik, taze nane / kuru nane). Kuzu incikte tarif yoksa kuzu but
   * tarifleri kullanıcının kurduğu şeye hâlâ en yakın cevap.
   */
  const mainIng = BY_SLUG.get(main);
  if (mainIng?.kin) {
    const kinSlugs = INGREDIENTS.filter((i) => i.kin === mainIng.kin).map((i) => i.slug);
    const kin = collect((r) => kinSlugs.some((k) => r.allSlugs.includes(k)), 'akraba');
    if (kin.length) return kin.slice(0, limit);
  }

  /**
   * 3. Kategori düşüşü.
   *
   * Akrabası da yoksa aynı malzeme kategorisinden tarifler: bıldırcın için
   * kümes hayvanı tarifleri. "Aynı yemek" değil ama "aynı teknik" — ve boş
   * ekrandan iyi.
   */
  if (mainIng) {
    const sameCat = new Set(
      INGREDIENTS.filter((i) => i.category === mainIng.category).map((i) => i.slug),
    );

    /**
     * Kategori kademesinde "içinde geçiyor" yetmiyor. İlk hâli lakerda için
     * "Sucuklu Yumurta" döndürüyordu: yumurta da protein kategorisinde ve
     * tarifte geçiyor. Oysa aranan şey aynı kategorinin **başrolde olduğu**
     * bir tarif. O yüzden ölçüt, o kategorinin tabaktaki gram payı.
     */
    const share = (r: Recipe): number => {
      let mine = 0;
      let all = 0;
      for (const c of r.components) {
        for (const i of c.ingredients) {
          all += i.grams;
          if (sameCat.has(i.slug)) mine += i.grams;
        }
      }
      return all > 0 ? mine / all : 0;
    };

    const cat = collect((r) => share(r) >= 0.25, 'kategori').sort(
      (a, b) => b.shared - a.shared || share(b.recipe) - share(a.recipe),
    );
    if (cat.length) return cat.slice(0, limit);
  }

  return [];
}

/** Ana malzemenin korpusta kaç tarifi var — Lab'de "hazır tarifi yok" uyarısı için. */
export function recipeCountFor(slug: string): number {
  let n = 0;
  for (const r of RECIPES) if (r.allSlugs.includes(slug)) n += 1;
  return n;
}

// ── Aramadan tavsiye ───────────────────────────────────────────────

/**
 * Bir arama terimine karşılık gelen tarifler.
 *
 * Ana sayfadaki "en çok aradıkların" rayı bunu kullanıyor: kişi sürekli
 * "karnabahar" arıyorsa aramaya girmeden karşısına karnabaharlı tarifler
 * çıkıyor. Arama ekranıyla aynı kuralları uyguluyor ki sonuçlar tutarlı olsun.
 */
export function recipesForTerm(term: string, limit = 10): Recipe[] {
  const q = term.trim().toLocaleLowerCase('tr-TR');
  if (q.length < 3) return [];

  const out: { recipe: Recipe; score: number }[] = [];

  for (const recipe of RECIPES) {
    let score = 0;
    if (recipe.title.toLocaleLowerCase('tr-TR').includes(q)) score += 5;
    else if (recipe.summary.toLocaleLowerCase('tr-TR').includes(q)) score += 2;
    else if (
      recipe.allSlugs.some((s) => BY_SLUG.get(s)?.nameTr.toLocaleLowerCase('tr-TR').includes(q))
    ) {
      score += 3;
    }
    if (score > 0) out.push({ recipe, score });
  }

  return out
    .sort((a, b) => b.score - a.score || a.recipe.totalMinutes - b.recipe.totalMinutes)
    .slice(0, limit)
    .map((x) => x.recipe);
}
