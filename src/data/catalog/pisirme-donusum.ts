/**
 * Pişirmenin besin değerine etkisi.
 *
 * ── Önce yanlış bilinen şey ────────────────────────────────────────
 *
 * **Su kaybı kaloriyi düşürmez.** 250 g tavuk göğsü fırında 180 g'a iner ama
 * o 180 g, 250 g'ın içindeki proteinin ve yağın TAMAMINI taşır. Giden şey su
 * ve suyun kalorisi yok. Bu yüzden modelin ekseni kütle değil **besin akışı**:
 * bir makronun tabaktan çıkmasının üç yolu var, üçü de burada.
 *
 *   1. **Damlayan yağ** — ızgara, kömür ve fırında yağlı etten eriyen yağ
 *      tepsiye ya da ateşe akar. Tabağa gelmez.
 *   2. **Dökülen sıvı** — haşlama suyu atılıyorsa suda çözünen nişasta ve
 *      şekerin bir kısmı onunla gider. Suyu yeniyorsa (çorba, sulu yemek)
 *      kayıp yok.
 *   3. **Tavada kalan yağ** — en büyüğü. Tarifte "kızartmak için 3 su bardağı
 *      sıvı yağ" yazar; o yağın tabağa geçen kısmı %5–15 arasıdır, gerisi
 *      tavada kalır. Tamamını saymak kızartma tariflerinin kalorisini beş-on
 *      katına çıkarıyordu.
 *
 * Ağırlık verimi (`YIELD`) ayrı tutuluyor: kaloriyi değil, "pişmiş hâlinin
 * 100 gramında" demek istersek gereken bölme sayısını veriyor.
 *
 * ── Sayılar nereden ────────────────────────────────────────────────
 *
 * Temel USDA'nın iki tablosu:
 *   · Table of Nutrient Retention Factors, Release 6
 *   · Table of Cooking Yields for Meat and Poultry
 *
 * Bunlar bizim 17 malzeme kategorimize ve 12 pişirme yöntemimize indirgendi,
 * sonra `scripts/kalibrasyon-besin.ts` ile Yummly28K'nın 27.638 gerçek tarifi
 * üzerinde ölçülüp ayarlandı. Ölçüm sonucu o dosyanın çıktısında.
 *
 * **Hepsi tahmindir** ve arayüzde öyle sunuluyor.
 */

import type { IngredientCategory } from '@/engine';
import type { CookMethod } from '@/data/recipes/types';

// ── 1. Damlayan yağ ────────────────────────────────────────────────

/**
 * Yağlı proteinden eriyip akan yağın oranı — tabağa kalan pay.
 *
 * Yalnızca hayvansal proteinde anlamlı: ızgarada kuzu pirzolanın yağı akar,
 * patlıcanın akacak yağı yoktur. Sulu pişirmede yağ tencerede kalıyor ve
 * yeniyor, o yüzden 1.0.
 */
const FAT_KEPT: Partial<Record<CookMethod, number>> = {
  izgara: 0.72,
  komur: 0.70,
  firin: 0.85,
  kizartma: 1.0,
  tava: 0.95,
  haslama: 0.80,
  sulu: 1.0,
  buhar: 0.92,
  wok: 0.97,
};

/** Yağın eridiği kategoriler — bitkisel malzemede damlama yok. */
const FATTY_CATEGORIES = new Set<IngredientCategory>(['protein', 'sarkuteri', 'deniz']);

// ── 2. Dökülen sıvı ────────────────────────────────────────────────

/**
 * Haşlama suyuna geçip atılan çözünür madde — tabağa kalan pay.
 *
 * Makarna suyu, haşlanmış patatesin suyu, bakliyatın ilk suyu dökülüyor.
 * Nişasta ve şekerin bir kısmı onunla gidiyor; protein çok az, yağ hiç
 * (suda çözünmüyor).
 *
 * `sulu` ve `corba` benzeri pişirmede sıvı yemeğin kendisi — kayıp yok.
 */
const LEACH_KEPT: Partial<Record<CookMethod, { protein: number; carbs: number }>> = {
  haslama: { protein: 0.95, carbs: 0.92 },
  buhar: { protein: 0.99, carbs: 0.98 },
};

/** Suda bir şey bırakan kategoriler. Et haşlanınca da bir miktar bırakır. */
const LEACHY = new Set<IngredientCategory>([
  'tahil', 'baklagil', 'sebze', 'protein', 'mantar',
]);

// ── 3. Tavada kalan yağ ────────────────────────────────────────────

/**
 * Kızartmada gıdanın emdiği yağ — kendi ağırlığının oranı olarak.
 *
 * Emilim yüzeyle ilgili: hamur ve galeta unu gözenekli, en çok emen onlar;
 * et ve balık yüzeyi kapalı, en az emen. Sayılar kızarmış gıda üzerinde
 * yapılan yağ analizlerinin tipik aralıklarının ortası.
 *
 * Bu oran gıda kütlesiyle çarpılıp tarifte YAZAN yağ miktarıyla
 * karşılaştırılıyor; hangisi küçükse o alınıyor. Bir tarif kızartma için
 * 20 g yağ yazmışsa gıda 60 g emmiş olamaz.
 */
const FRY_UPTAKE: Partial<Record<IngredientCategory, number>> = {
  tahil: 0.14,
  sebze: 0.10,
  mantar: 0.09,
  baklagil: 0.09,
  protein: 0.06,
  deniz: 0.07,
  sarkuteri: 0.05,
  sut: 0.06,
  meyve: 0.08,
};
const FRY_UPTAKE_DEFAULT = 0.08;

/**
 * Kızartma banyosu kurulabilen yağlar.
 *
 * Nötr, yüksek duman noktalı sıvı yağlar. Tereyağı, margarin ve mayonez
 * yok — onlar hamurun ve sosun içine girer. **Zeytinyağı da yok**: Türk
 * mutfağında zeytinyağlı yemek bol yağla pişer ve o yağ tabakta yenir;
 * onu tavada kalmış saymak zeytinyağlı rafının tamamını yanlış hesaplardı.
 */
const BATH_OILS = new Set(['sivi-yag', 'aycicek-yagi', 'misir-yagi', 'kanola-yagi']);

// ── 4. Ağırlık verimi ──────────────────────────────────────────────

/**
 * Pişmiş ağırlık / ham ağırlık.
 *
 * Kaloriyi DEĞİŞTİRMEZ; yalnızca porsiyonun kaç gram geldiğini söyler.
 * Etler su ve yağ kaybedip küçülür, tahıl ve bakliyat su çekip büyür.
 */
const YIELD: Partial<Record<CookMethod, Partial<Record<IngredientCategory, number>>>> = {
  izgara: { protein: 0.70, deniz: 0.78, sarkuteri: 0.68, sebze: 0.80, mantar: 0.55 },
  komur: { protein: 0.68, deniz: 0.76, sarkuteri: 0.66, sebze: 0.78, mantar: 0.55 },
  firin: { protein: 0.75, deniz: 0.80, sarkuteri: 0.72, sebze: 0.75, tahil: 0.90, mantar: 0.55 },
  tava: { protein: 0.75, deniz: 0.80, sebze: 0.75, mantar: 0.50 },
  kizartma: { protein: 0.80, deniz: 0.82, sebze: 0.65, tahil: 0.85 },
  haslama: { protein: 0.75, deniz: 0.85, sebze: 0.92, tahil: 2.6, baklagil: 2.4 },
  sulu: { protein: 0.80, deniz: 0.85, sebze: 0.90, tahil: 2.4, baklagil: 2.3 },
  buhar: { protein: 0.82, deniz: 0.88, sebze: 0.95, tahil: 2.5 },
  wok: { protein: 0.78, deniz: 0.82, sebze: 0.82, mantar: 0.55 },
};

// ── Uygulama ───────────────────────────────────────────────────────

export interface Macro4 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CookedIngredient {
  slug: string;
  category: IngredientCategory;
  grams: number;
  /** 100 g ham hâlin değerleri. */
  per100: Macro4;
}

export interface CookedResult extends Macro4 {
  /** Pişmiş toplam ağırlık — porsiyon gramajı için. */
  cookedGrams: number;
  /** Tabağa geçmeyen yağ (g) — kızartma yağı ve damlayan yağın toplamı. */
  fatDiscarded: number;
}

/**
 * Bir bileşenin pişmiş besin değeri.
 *
 * Bileşen bazında çalışıyor çünkü tarifin sosu ile anası ayrı yöntemle
 * pişebiliyor: ızgara et + tavada sos aynı tabağın iki ayrı dönüşümü.
 */
export function cookComponent(items: CookedIngredient[], method: CookMethod): CookedResult {
  /**
   * Kızartma yağı hesabı gıdanın kendi kütlesini gerektiriyor, o yüzden
   * yağ olmayan malzemelerin toplamı önce çıkarılıyor.
   */
  const foodMass = items
    .filter((i) => i.category !== 'yag')
    .reduce((a, i) => a + i.grams, 0);
  const oilMass = items
    .filter((i) => i.category === 'yag')
    .reduce((a, i) => a + i.grams, 0);
  /** Banyo kurulabilen yağ — gerekçesi `BATH_OILS` üstünde. */
  const bathOilMass = items
    .filter((i) => BATH_OILS.has(i.slug))
    .reduce((a, i) => a + i.grams, 0);

  /**
   * **Yağ banyosu, etiketine değil oranına bakarak bulunuyor.**
   *
   * Yönteme güvenmek yetmedi: korpusta "Fish and Chips" tavada, "Puf Böreği"
   * sulu pişirmede, "Pişi" dinlendirmede görünüyor — üçü de derin yağda
   * kızarıyor. Yöntem alanı ya kaynakta yok ya adım metninden tahmin edilmiş,
   * ikisi de yanılıyor.
   *
   * Fizik daha güvenilir bir ölçüt veriyor: gıda kütlesinin dörtte birinden
   * fazla yağ, yemeğin içine giren yağ değil içinde piştiği yağdır. Kimse
   * 4 kişilik bir tatlıda 736 g yağ yemiyor. Bu eşiği geçen bileşen, hangi
   * yöntemle etiketlenmiş olursa olsun kızartma gibi hesaplanıyor.
   */
  /**
   * Banyo eşiği üç koşulun BİRLİKTE tutmasını istiyor ve bunun ölçülmüş bir
   * sebebi var.
   *
   * İlk hâli tek koşulluydu: yağ, gıdanın dörtte birini geçiyorsa banyo.
   * 6.000 tariflik referans setinde bu kuralın neyi yakaladığına baktım:
   *
   *   0.45  Basil Pesto Sauce          0.44  Beatty's Chocolate Cake
   *   0.44  Irish Soda Bread           0.44  Homemade Double Pie Crust
   *   0.44  Raspberry Vinaigrette      0.44  Butterscotch Sundae Sauce
   *
   * Hiçbiri kızartma değil — hepsinde yağ tabağa gidiyor. Sonuç ölçüldü:
   * yağ oranı yüksek 327 tarifte model kaloriyi %39 AŞAĞI kaydırıyordu,
   * oysa ham toplamın sapması −%0,4'tü. Yani düzeltme, düzeltilecek şey
   * yokken devreye giriyordu.
   *
   * Üç koşul birlikte ayırıyor:
   *
   *  1. **Yağın cinsi.** Kek tereyağıyla, salata sosu zeytinyağıyla yapılır;
   *     kızartma banyosu nötr sıvı yağla kurulur. Zeytinyağı kasten dışarıda:
   *     zeytinyağlı yemekte yağ yenir, bu Türk mutfağının temel bir kalıbı.
   *  2. **Mutlak miktar.** Banyo 200 gramın altında kurulamaz. Pestoya giden
   *     100 g yağ çoktur ama banyo değildir.
   *  3. **Orana göre baskınlık.** Eşik 0,3 ve bu sayı ölçüldü. Önce 0,5
   *     denendi; Türk hamur kızartmaları (pişi, çiğ börek) hamur kütlesi
   *     büyük olduğu için eşiğin altında kalıp düzeltilmiyordu. Referans
   *     setinde nötr yağı 200 g'ı geçen tariflerin 0,25–0,50 bandına
   *     bakıldı: Chicken Nuggets, Schnitzel, Egg Rolls, Falafel, Croquettes
   *     — neredeyse tamamı gerçekten kızartma. Kalan birkaç yanlış pozitif
   *     tek bir kalıptı, hamur işindeki `shortening`; o da 1. koşulda
   *     eleniyor.
   */
  const FRY_BATH_RATIO = 0.3;
  const FRY_BATH_MIN_G = 200;
  const isFryBath =
    method === 'kizartma' ||
    (method !== 'cig' &&
      foodMass > 0 &&
      bathOilMass >= FRY_BATH_MIN_G &&
      bathOilMass > foodMass * FRY_BATH_RATIO);

  const fryCapacity = isFryBath
    ? items
        .filter((i) => i.category !== 'yag')
        .reduce((a, i) => a + i.grams * (FRY_UPTAKE[i.category] ?? FRY_UPTAKE_DEFAULT), 0)
    : Infinity;

  let out: Macro4 = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let cookedGrams = 0;
  let fatDiscarded = 0;
  let fryBudget = fryCapacity;
  /** Dönüşümden önceki hâl — kalori oranını buradan çıkarıyoruz. */
  let rawKcal = 0;
  let rawAtwater = 0;

  for (const i of items) {
    const k = i.grams / 100;
    let protein = i.per100.protein * k;
    let carbs = i.per100.carbs * k;
    let fat = i.per100.fat * k;
    let grams = i.grams;

    if (isFryBath && (BATH_OILS.has(i.slug) || (method === 'kizartma' && i.category === 'yag'))) {
      /**
       * Kızartma yağı: tabağa yalnızca emilen kadarı geçiyor. Birden çok yağ
       * satırı varsa bütçe sırayla tükeniyor — iki kalem yağ yazmak emilimi
       * ikiye katlamaz.
       */
      const eaten = Math.min(i.grams, Math.max(0, fryBudget));
      fryBudget -= eaten;
      fatDiscarded += (i.grams - eaten) * (i.per100.fat / 100);
      const ratio = i.grams > 0 ? eaten / i.grams : 0;
      protein *= ratio;
      carbs *= ratio;
      fat *= ratio;
      grams = eaten;
    } else {
      // Damlayan yağ — yalnızca yağlı hayvansal üründe.
      if (FATTY_CATEGORIES.has(i.category)) {
        const kept = FAT_KEPT[method] ?? 1;
        fatDiscarded += fat * (1 - kept);
        fat *= kept;
      }
      // Dökülen sıvı.
      const leach = LEACH_KEPT[method];
      if (leach && LEACHY.has(i.category)) {
        protein *= leach.protein;
        carbs *= leach.carbs;
      }
      const y = YIELD[method]?.[i.category] ?? 1;
      grams = i.grams * y;
    }

    rawKcal += i.per100.kcal * k;
    rawAtwater += (i.per100.protein * 4 + i.per100.carbs * 4 + i.per100.fat * 9) * k;

    out.protein += protein;
    out.carbs += carbs;
    out.fat += fat;
    cookedGrams += grams;
  }

  /**
   * Kalori, tablodaki kalorinin **korunan payı** olarak hesaplanıyor —
   * makrolardan sıfırdan kurulmuyor.
   *
   * İlk hâli Atwater ile yeniden hesaplıyordu (protein 4, karbonhidrat 4,
   * yağ 9) ve bu ölçülebilir biçimde kötüydü: Yummly28K karşısında yağsız
   * tariflerin kalori sapması +%25.8'den +%31.3'e çıkıyordu. Sebebi **lif**.
   * Lif karbonhidrat sayılıyor ama 4 değil ~2 kcal/g veriyor; tablodaki
   * kalori bunu zaten hesaba katmış, Atwater ise katmıyor. Yeniden hesap,
   * tablonun bildiği doğruyu atıp yerine kaba bir yaklaşım koyuyordu.
   *
   * Doğrusu oranı taşımak: dönüşümde makro enerjisinin ne kadarı kaldıysa
   * tablo kalorisi de o kadarı. Hiçbir şey atılmadıysa oran 1 ve kalori
   * tablodaki hâliyle geçiyor.
   */
  const cookedAtwater = out.protein * 4 + out.carbs * 4 + out.fat * 9;
  const kept = rawAtwater > 0 ? cookedAtwater / rawAtwater : 1;
  out.kcal = rawKcal * kept;

  return {
    kcal: Math.max(0, out.kcal),
    protein: Math.max(0, out.protein),
    carbs: Math.max(0, out.carbs),
    fat: Math.max(0, out.fat),
    cookedGrams: Math.max(0, cookedGrams),
    fatDiscarded: Math.max(0, fatDiscarded),
  };
}
