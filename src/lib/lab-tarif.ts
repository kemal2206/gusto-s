/**
 * Lab'de kurulan tabağın **yapılışını üretir**.
 *
 * ── Neden gerekiyor ────────────────────────────────────────────────
 *
 * Lab'ın işi hazır tarif bulmak değil. "Elimde şunlar var, ne yapabilirim"
 * sorusunun cevabı zaten kilerde (`matchPantry`). Lab bunun tersini yapıyor:
 * kimyasal olarak birbirine bağlı malzemeleri seçtirip **daha önce olmayan
 * bir yemek kurduruyor**.
 *
 * Bunun doğal sonucu şu: kurulan tabağın tarifi hiçbir yerde yok, çünkü o
 * yemeği kullanıcı az önce icat etti. Malzemeleri ve gramajları elimizde
 * ama "peki bunu nasıl pişireceğim" sorusu cevapsız kalıyordu.
 *
 * ── Nasıl üretiliyor ───────────────────────────────────────────────
 *
 * Uydurmuyor, **veriden çıkarıyor**. Lab zaten her seçim için üç şeyi
 * biliyor ve pişirme sırası bu üçünden çıkıyor:
 *
 *   rol       malzemenin tabaktaki işlevi (`yag`, `aromatik`, `ana`,
 *             `baharat`, `zemin`, `asit`, `tatlandirici`, `bitirici`)
 *   yöntem    bileşenin pişirme biçimi (`tava`, `firin`, `izgara`, `sulu`…)
 *   gramaj    motorun hedefe göre optimize ettiği miktar
 *
 * Türk mutfağında pişirme sırası rolden neredeyse birebir çıkıyor: yağ
 * ısınır, aromatik kavrulur, ana malzeme mühürlenir, baharat yağda açılır,
 * sıvı eklenir, ekşilik sona doğru girer, bitirici ocaktan indikten sonra.
 * Aşağıdaki `ROLE_ORDER` bu sıra; yöntem ise cümleleri değiştiriyor —
 * ızgarada "kavurma" adımı yok, marine etme adımı var.
 *
 * Yani üretilen metin bir şablon doldurması değil, tabağın kendi yapısının
 * okunması. Aynı malzemeler farklı rollerle seçilseydi farklı bir yapılış
 * çıkardı.
 */

import type { ArchetypeId, Ingredient, IngredientRole, TasteVector } from '@/engine';
import { ARCHETYPES, dishProfile } from '@/engine';
import type {
  ComponentKind,
  CookMethod,
  Recipe,
  RecipeComponent,
  RecipeIngredient,
} from '@/data/recipes';
import { guessCategory } from '@/data/recipes/ad-kurallari';
import { formatGrams } from '@/data/catalog/ev-olcusu';

// ── Girdi ──────────────────────────────────────────────────────────

export interface LabPickLite {
  ingredient: Ingredient;
  grams: number;
  role: IngredientRole;
}

export interface LabComponentLite {
  kind: ComponentKind;
  method: CookMethod;
  archetypeId: ArchetypeId;
  picks: LabPickLite[];
}

// ── Pişirme sırası ─────────────────────────────────────────────────

/**
 * Rolün tencereye giriş sırası. Sayı küçükse önce giriyor.
 *
 * `bitirici` kasten en sonda ve pişirmenin dışında: maydanozun kokusu
 * kaynarken uçar, o yüzden ocaktan indikten sonra ekleniyor.
 */
const ROLE_ORDER: Record<IngredientRole, number> = {
  yag: 1,
  aromatik: 2,
  ana: 3,
  baharat: 4,
  baglayici: 5,
  zemin: 6,
  asit: 7,
  tatlandirici: 8,
  bitirici: 9,
};

const sortByRole = (picks: LabPickLite[]) =>
  [...picks].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

const byRole = (picks: LabPickLite[], ...roles: IngredientRole[]) =>
  sortByRole(picks.filter((p) => roles.includes(p.role)));

/** "200 g kuzu but" — ev ölçüsü varsa o, yoksa gram. */
const amountOf = (p: LabPickLite) => `${formatGrams(p.grams)} ${p.ingredient.nameTr.toLocaleLowerCase('tr-TR')}`;

/** "soğan, sarımsak ve maydanoz" — Türkçe liste. */
function joinTr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`;
}

const names = (picks: LabPickLite[]) =>
  joinTr(picks.map((p) => p.ingredient.nameTr.toLocaleLowerCase('tr-TR')));

const amounts = (picks: LabPickLite[]) => joinTr(picks.map(amountOf));

// ── Yönteme göre pişirme cümlesi ───────────────────────────────────

interface MethodVoice {
  /** Yağın ısıtılma cümlesi. */
  heat: (fat: string) => string;
  /** Ana malzemenin girişi. */
  main: (main: string) => string;
  /** Asıl pişirme adımı. */
  cook: (minutes: number) => string;
  /** Sıvı ekleme cümlesi — yoksa adım atlanıyor. */
  liquid?: (what: string) => string;
  /** Marine gerekiyor mu (ızgara ve kömür için). */
  marinate?: boolean;
}

const VOICE: Record<CookMethod, MethodVoice> = {
  tava: {
    heat: (f) => `Geniş bir tavayı orta ateşe alın, ${f} koyup ısıtın.`,
    main: (m) => `${m} ekleyin ve her yüzü renk alana kadar yüksek ateşte mühürleyin.`,
    cook: (m) => `Ateşi kısın, ara ara karıştırarak ${m} dakika pişirin.`,
    liquid: (w) => `${w} ekleyip karıştırın.`,
  },
  sulu: {
    heat: (f) => `Tencereyi ocağa alın, ${f} koyup ısıtın.`,
    main: (m) => `${m} ekleyip suyunu salıp çekene kadar kavurun.`,
    cook: (m) => `Kapağını kapatın ve kısık ateşte ${m} dakika, malzemeler yumuşayana kadar pişirin.`,
    liquid: (w) => `${w} ekleyin; malzemelerin üzerini geçecek kadar sıcak su ilave edin.`,
  },
  firin: {
    heat: (f) => `Fırını 190 dereceye ayarlayıp ısıtmaya başlayın. Fırın kabına ${f} sürün.`,
    main: (m) => `${m} fırın kabına tek sıra hâlinde yerleştirin.`,
    cook: (m) => `Isınmış fırında ${m} dakika, üzeri kızarana kadar pişirin.`,
    liquid: (w) => `${w} kabın kenarından dökün.`,
  },
  izgara: {
    heat: () => `Izgarayı ya da döküm tavayı iyice kızdırın.`,
    main: (m) => `${m} ızgaraya dizin; ilk yüzü mühürlenmeden çevirmeyin.`,
    cook: (m) => `Toplam ${m} dakika, iki yüzü de renk alacak şekilde pişirin.`,
    marinate: true,
  },
  komur: {
    heat: () => `Kömürü yakın, alevi geçip korlaşmasını bekleyin.`,
    main: (m) => `${m} şişe dizin ya da tel ızgaraya yerleştirin.`,
    cook: (m) => `Kordan bir karış yükseklikte, çevirerek ${m} dakika pişirin.`,
    marinate: true,
  },
  haslama: {
    heat: () => `Geniş bir tencereye bol su koyup kaynatın, tuzunu atın.`,
    main: (m) => `${m} kaynayan suya alın.`,
    cook: (m) => `${m} dakika haşlayın, sonra süzün.`,
  },
  kizartma: {
    heat: (f) => `Derin bir tavaya ${f} koyup iyice kızdırın.`,
    main: (m) => `${m} birkaç parti hâlinde yağa atın; tavayı kalabalık etmeyin.`,
    cook: (m) => `${m} dakika, her yüzü altın rengi olana kadar kızartın. Havlu kâğıda alıp fazla yağını süzdürün.`,
  },
  buhar: {
    heat: () => `Buharlı pişiricinin altına su koyup kaynatın.`,
    main: (m) => `${m} buhar sepetine yerleştirin.`,
    cook: (m) => `Kapağı kapalı, ${m} dakika buharda pişirin.`,
  },
  wok: {
    heat: (f) => `Woku dumanı çıkana kadar kızdırın, ${f} gezdirin.`,
    main: (m) => `${m} ekleyip sürekli karıştırarak yüksek ateşte soteleyin.`,
    cook: (m) => `${m} dakika, sebzeler dirinliğini kaybetmeden pişirin.`,
    liquid: (w) => `${w} ekleyip bir taşım kaynatın.`,
  },
  cig: {
    heat: () => `Geniş bir kaseye alın.`,
    main: (m) => `${m} ince ince doğrayıp kaseye koyun.`,
    cook: () => `Karıştırın ve servis edene kadar buzdolabında bekletin.`,
  },
  karistir: {
    heat: () => `Derin bir kap hazırlayın.`,
    main: (m) => `${m} kaba alın.`,
    cook: (m) => `${m} dakika, pürüzsüz bir kıvam alana kadar çırpın.`,
  },
  dinlendir: {
    heat: () => `Geniş bir kap hazırlayın.`,
    main: (m) => `${m} kaba alın.`,
    cook: (m) => `Üzerini örtüp ${m} dakika dinlendirin.`,
  },
};

// ── Süre ───────────────────────────────────────────────────────────

/**
 * Süre gramajdan ve yöntemden çıkıyor.
 *
 * Taban süre yöntemin kendisi (ızgara kısa, sulu pişirme uzun); üzerine
 * ana malzemenin ağırlığıyla orantılı bir pay ekleniyor. 200 g tavuk ile
 * 1 kg kuzu incik aynı sürede pişmiyor.
 */
const BASE_MIN: Record<CookMethod, number> = {
  izgara: 10, komur: 12, tava: 12, wok: 8, kizartma: 8, buhar: 12,
  haslama: 15, firin: 30, sulu: 35, cig: 10, karistir: 5, dinlendir: 30,
};
const PER_KG: Record<CookMethod, number> = {
  izgara: 10, komur: 10, tava: 14, wok: 6, kizartma: 6, buhar: 14,
  haslama: 18, firin: 30, sulu: 40, cig: 0, karistir: 0, dinlendir: 0,
};

function minutesFor(method: CookMethod, picks: LabPickLite[]): number {
  const mainMass = picks
    .filter((p) => p.role === 'ana' || p.role === 'zemin')
    .reduce((a, p) => a + p.grams, 0);
  const raw = BASE_MIN[method] + (PER_KG[method] * mainMass) / 1000;
  return Math.max(5, Math.round(raw / 5) * 5);
}

// ── Adım üretimi ───────────────────────────────────────────────────

function stepsFor(comp: LabComponentLite, minutes: number): string[] {
  const v = VOICE[comp.method];
  const steps: string[] = [];

  const fat = byRole(comp.picks, 'yag');
  const aromatic = byRole(comp.picks, 'aromatik');
  const main = byRole(comp.picks, 'ana');
  const spice = byRole(comp.picks, 'baharat');
  const binder = byRole(comp.picks, 'baglayici', 'zemin');
  const acid = byRole(comp.picks, 'asit', 'tatlandirici');
  const finish = byRole(comp.picks, 'bitirici');

  /**
   * Izgara ve kömürde sıra değişiyor: yağ tavaya değil ete gidiyor ve
   * baharat pişerken değil önceden sürülüyor. Marine adımı bu yüzden
   * en başta ve ısıtma adımından önce.
   */
  if (v.marinate && main.length) {
    const rub = [...fat, ...spice, ...acid];
    if (rub.length) {
      steps.push(
        `${amounts(main)} geniş bir kaseye alın. Üzerine ${amounts(rub)} ekleyip elinizle güzelce yedirin.`,
      );
      steps.push('Kabın üzerini örtüp buzdolabında en az 30 dakika dinlendirin.');
    }
  }

  steps.push(v.heat(fat.length && !v.marinate ? amounts(fat) : 'yağını'));

  if (aromatic.length && !v.marinate) {
    steps.push(
      `${amounts(aromatic)} ekleyin; ${aromatic.length > 1 ? 'renkleri dönene' : 'rengi dönene'} kadar kavurun.`,
    );
  }

  if (main.length) steps.push(v.main(v.marinate ? `Dinlenen ${names(main)}` : amounts(main)));

  if (spice.length && !v.marinate) {
    steps.push(
      `${amounts(spice)} ekleyip yarım dakika karıştırın — baharat yağda açılınca kokusunu veriyor.`,
    );
  }

  if (binder.length && v.liquid) steps.push(v.liquid(amounts(binder)));
  else if (binder.length) steps.push(`${amounts(binder)} ekleyip karıştırın.`);

  if (acid.length && !v.marinate) {
    steps.push(
      `${amounts(acid)} ekleyin. Ekşiliği sona bırakmak tadın canlı kalmasını sağlıyor.`,
    );
  }

  steps.push(v.cook(minutes));

  if (finish.length) {
    steps.push(
      `Ocaktan alın ve ${amounts(finish)} serpin. Bunlar pişerken değil, sıcak tabağın üzerinde kokusunu veriyor.`,
    );
  }

  return steps;
}

// ── Ad ve özet ─────────────────────────────────────────────────────

/**
 * Ad, tabağın kendi yapısından: en ayırt edici yan malzeme + ana malzeme.
 * "Biberiyeli antrikot", "Nar ekşili kuzu but".
 */
/**
 * Adı belirleyemeyecek kadar her yerde olan malzemeler.
 *
 * İlk hâli yalnızca `potency`ye bakıyordu ve karabiberi (güç 8) biberiyenin
 * (güç 6) önüne koyup "Karabiberli antrikot" üretiyordu. Karabiber her
 * tarifte var, hiçbir yemeğe adını vermez; ayırt edicilik güç değil,
 * **seyreklik**.
 */
/**
 * Malzeme adını sıfata çevir: "biberiye" → "Biberiyeli".
 *
 * İyelik eki önce atılıyor. "Nar ekşisi" doğrudan ek alınca "nar ekşisili"
 * oluyordu; Türkçesi "nar ekşili". Aynı tuzak "domates salçası" → "domates
 * salçalı" için de geçerli.
 */
function adjectiveOf(nameTr: string): string {
  let n = nameTr.toLocaleLowerCase('tr-TR').trim();
  if (n.includes(' ')) n = n.replace(/(sı|si|su|sü)$/, '');
  const sfx = /[aıou][^aeıioöuü]*$/.test(n) ? 'lı' : 'li';
  const out = `${n}${sfx}`;
  return out.charAt(0).toLocaleUpperCase('tr-TR') + out.slice(1);
}

const TOO_COMMON = new Set([
  'tuz', 'karabiber', 'su', 'seker', 'un', 'sivi-yag', 'zeytinyagi',
  'tereyagi', 'kuru-sogan', 'sarimsak', 'domates-salcasi',
]);

function titleFor(comp: LabComponentLite): string {
  const main = comp.picks.find((p) => p.role === 'ana' || p.role === 'zemin');

  /**
   * Sosun ve garnitürün "ana malzemesi" yok; onları tanımlayan şey tabanı
   * (asit ya da tatlandırıcı). "Nar ekşili sos", "Bal sosu".
   */
  if (!main) {
    const base = [...comp.picks]
      .filter((p) => !TOO_COMMON.has(p.ingredient.slug))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
      .find((p) => p.role === 'asit' || p.role === 'tatlandirici' || p.role === 'baglayici');
    const kindLabel = comp.kind === 'sos' ? 'sos' : comp.kind === 'garnitur' ? 'salata' : 'hazırlık';
    if (!base) return kindLabel.charAt(0).toLocaleUpperCase('tr-TR') + kindLabel.slice(1);
    return `${adjectiveOf(base.ingredient.nameTr)} ${kindLabel}`;
  }

  /** Ayırt edicilik: yaygın olmayanlar arasında en güçlüsü. */
  const marker = [...comp.picks]
    .filter(
      (p) => p !== main && p.role !== 'yag' && !TOO_COMMON.has(p.ingredient.slug) && p.ingredient.potency >= 3,
    )
    .sort((a, b) => b.ingredient.potency - a.ingredient.potency)[0];

  const base = main.ingredient.nameTr;
  if (!marker) return base;

  return `${adjectiveOf(marker.ingredient.nameTr)} ${base.toLocaleLowerCase('tr-TR')}`;
}

// ── Ana giriş ──────────────────────────────────────────────────────

export interface LabRecipeResult {
  recipe: Recipe;
  /** Tabağın ölçülen tat profili — hedefle karşılaştırmak için. */
  profile: TasteVector;
}

/**
 * Lab'de kurulan bileşenlerden tam bir tarif üretir.
 *
 * Çıkan nesne gerçek bir `Recipe`: besin hesabı, porsiyon ölçekleme,
 * alışveriş listesi ve alerjen uyarısı hepsi aynı yoldan geçiyor.
 */
export function buildLabRecipe(
  components: LabComponentLite[],
  servings = 2,
): LabRecipeResult | null {
  const usable = components.filter((c) => c.picks.length > 0);
  if (!usable.length) return null;

  const built: RecipeComponent[] = usable.map((c) => {
    const minutes = minutesFor(c.method, c.picks);
    const ingredients: RecipeIngredient[] = sortByRole(c.picks).map((p) => ({
      slug: p.ingredient.slug,
      grams: p.grams,
      role: p.role,
    }));
    return {
      kind: c.kind,
      title: titleFor(c),
      method: c.method,
      minutes,
      ingredients,
      steps: stepsFor(c, minutes),
      archetypeId: c.archetypeId,
    };
  });

  const mainComp = usable.find((c) => c.kind === 'ana') ?? usable[0];
  const title = titleFor(mainComp);
  const allSlugs = [...new Set(built.flatMap((c) => c.ingredients.map((i) => i.slug)))];

  /**
   * Toplam süre bileşenlerin toplamı değil: sos ana yemek pişerken yapılıyor.
   * En uzun bileşen belirleyici, kalanlar yarım ağırlıkla ekleniyor.
   */
  const mins = built.map((c) => c.minutes).sort((a, b) => b - a);
  const totalMinutes = Math.round(mins[0] + mins.slice(1).reduce((a, m) => a + m * 0.5, 0));

  const archetype = ARCHETYPES[mainComp.archetypeId];
  const summary =
    `Lezzet Lab'de kurduğun tabak: ${archetype.labelTr.toLocaleLowerCase('tr-TR')}. ` +
    `${built.length > 1 ? built.map((c) => c.title).join(' + ') : names(mainComp.picks.filter((p) => p.role === 'ana'))} üzerine kurulu.`;

  const profile = dishProfile({
    components: usable.flatMap((c) =>
      c.picks.map((p) => ({ ingredient: p.ingredient, grams: p.grams, role: p.role })),
    ),
  });

  const recipe: Recipe = {
    slug: `lab-${Date.now().toString(36)}`,
    title,
    summary,
    cuisine: 'tr',
    categoryId: guessCategory(title) ?? (built.length > 1 ? 'etli-sulu' : 'kebap-izgara'),
    servings,
    totalMinutes,
    difficulty: built.length > 1 ? 2 : 1,
    components: built,
    tags: ['lab'],
    allSlugs,
  };

  return { recipe, profile };
}

// ── Hedefe ulaşıldı mı ─────────────────────────────────────────────

export interface GapReport {
  /** Hedeften en çok sapan eksen. */
  axis: keyof TasteVector;
  /** Hedef değere göre eksik mi fazla mı. */
  direction: 'eksik' | 'fazla';
  /** Kullanıcıya gösterilecek cümle. */
  messageTr: string;
  /** Bu açığı kapatacak bileşen — varsa. */
  suggestKind?: ComponentKind;
}

const AXIS_TR: Record<keyof TasteVector, string> = {
  sweet: 'tatlılık',
  sour: 'ekşilik',
  salty: 'tuzluluk',
  bitter: 'kekremsilik',
  umami: 'doyuruculuk',
  fat: 'yağlılık',
  heat: 'acılık',
};

/**
 * Kurulan tabak seçilen karaktere ulaşıyor mu?
 *
 * Kullanıcının sorusu tam olarak buydu: "tatlı ekşi" seçtiysem ve antrikot
 * kurduysam, antrikotun tek başına tatlı ekşi olması mümkün değil — sistemin
 * bana bir sos gerektiğini söylemesi lazım.
 *
 * Motor zaten tabağın tat profilini ve arketipin hedefini biliyor; aradaki
 * en büyük açık hangi eksende olduğunu söylüyor. Ekşilik ya da tatlılık
 * eksikse bunu ana yemeğin içine katmak çözüm değil — o iş **ayrı bir
 * bileşenin**, yani sosun.
 */
export function findGap(
  profile: TasteVector,
  archetypeId: ArchetypeId,
  hasSauce: boolean,
): GapReport | null {
  const target = ARCHETYPES[archetypeId].target;
  const tolerance = ARCHETYPES[archetypeId].tolerance;

  let worst: { axis: keyof TasteVector; diff: number } | null = null;
  for (const axis of Object.keys(target) as (keyof TasteVector)[]) {
    const diff = target[axis] - profile[axis];
    if (Math.abs(diff) <= tolerance) continue;
    if (!worst || Math.abs(diff) > Math.abs(worst.diff)) worst = { axis, diff };
  }
  if (!worst) return null;

  const direction = worst.diff > 0 ? 'eksik' : 'fazla';
  const label = AXIS_TR[worst.axis];

  /**
   * Sos önerisi yalnızca eksik yönde ve yalnızca sosun gerçekten
   * çözebileceği eksenlerde. Fazla tuzu sos düzeltmez, az ekşiliği düzeltir.
   */
  const SAUCE_FIXES: (keyof TasteVector)[] = ['sour', 'sweet', 'fat', 'umami'];
  const suggestKind =
    direction === 'eksik' && !hasSauce && SAUCE_FIXES.includes(worst.axis) ? 'sos' : undefined;

  const messageTr = suggestKind
    ? `Seçtiğin karaktere göre tabağın ${label} tarafı zayıf kalıyor. ` +
      `Bunu ana yemeğin içine katmak yerine yanına bir sos kurmak daha doğru — ` +
      `sos kendi hedefiyle ölçülüyor ve etin yağını keserek dengeyi kuruyor.`
    : direction === 'eksik'
      ? `Tabağın ${label} tarafı hedefin altında.`
      : `Tabağın ${label} tarafı hedefin üstünde.`;

  return { axis: worst.axis, direction, messageTr, suggestKind };
}
