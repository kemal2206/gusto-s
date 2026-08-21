/**
 * Lezzet Lab zinciri — adımların tanımı.
 *
 * Akış: ana malzeme → karakter → rol rol malzeme seçimi → özet.
 *
 * Her rol adımının adayları motordan geliyor ve **zincir kuralına** tabi:
 * adayın o ana kadar seçilenlerden en az biriyle kimya/tat/gelenek bağı
 * olmak zorunda. Bu yüzden adımlar sabit bir listeden okunmuyor, her seferinde
 * yeniden hesaplanıyor — kullanıcı ne seçerse sonraki adım ona göre değişiyor.
 */

import type { ArchetypeId, IngredientCategory, IngredientRole, TasteAxis } from '@/engine';
import type { ComponentKind, CookMethod } from '@/data/recipes';

// ── 1. adım: ana malzeme grupları ──────────────────────────────────

export interface MainGroup {
  id: string;
  labelTr: string;
  hintTr: string;
  categories: IngredientCategory[];
}

/**
 * Kategori doğrudan gösterilmiyor; kullanıcının kafasındaki bölümlemeye
 * çevriliyor. "Şarküteri" demek yerine "Sucuk, pastırma" diyoruz.
 */
export const MAIN_GROUPS: MainGroup[] = [
  { id: 'et', labelTr: 'Et ve tavuk', hintTr: 'Kuzu, dana, tavuk, hindi', categories: ['protein'] },
  { id: 'deniz', labelTr: 'Balık ve deniz', hintTr: 'Levrek, hamsi, karides', categories: ['deniz'] },
  { id: 'sebze', labelTr: 'Sebze', hintTr: 'Patlıcan, kabak, ıspanak', categories: ['sebze', 'mantar'] },
  { id: 'bakliyat', labelTr: 'Bakliyat', hintTr: 'Mercimek, nohut, fasulye', categories: ['baklagil'] },
  { id: 'hamur', labelTr: 'Makarna ve pilav', hintTr: 'Pirinç, bulgur, makarna', categories: ['tahil'] },
  { id: 'sarkuteri', labelTr: 'Sucuk, pastırma', hintTr: 'Kahvaltılık ve şarküteri', categories: ['sarkuteri'] },
];

export const MAIN_GROUP_BY_ID = new Map(MAIN_GROUPS.map((g) => [g.id, g]));

// ── 2. adım: karakter ──────────────────────────────────────────────

export interface CharacterChoice {
  archetypeId: ArchetypeId;
  labelTr: string;
  hintTr: string;
  /** Kullanıcının derdi olan eksenler — denge hesabında 4× ağırlık alır. */
  focusAxes: TasteAxis[];
  /**
   * Bu karakter pişirme yöntemini de söylüyorsa o yöntem.
   *
   * Karakter seçimi eskiden yalnızca tat hedefini değiştiriyordu; yöntem
   * bileşen planında sabit `tava` kalıyordu. Sonucu ekranda "IZGARA VE
   * MANGAL · Tavada" gibi kendi kendini yalanlayan bir satırdı ve dört yere
   * birden yanlış besleniyordu: üretilen adımlar tavayı anlatıyordu,
   * kalori hesabı ızgarada damlayan yağı düşmüyordu, süre yanlış çıkıyordu
   * ve ekipman süzgeci mangalı olmayan birine "sana uygun" diyordu.
   *
   * Alan **isteğe bağlı**: her karakter yöntem söylemiyor. "Izgara ve
   * mangal" açıkça söylüyor, "Doyurucu" uzun pişmeyi ima ediyor; "Hafif"
   * ile "Baharatlı" ise söylemiyor — onlarda planın kendi yöntemi kalıyor.
   */
  method?: CookMethod;
}

export const CHARACTERS: CharacterChoice[] = [
  {
    archetypeId: 'doyurucu-derin',
    labelTr: 'Doyurucu olsun',
    hintTr: 'Soslu, uzun pişmiş, tok tutan',
    focusAxes: ['umami', 'fat'],
    method: 'sulu',
  },
  {
    archetypeId: 'hafif-ferah',
    labelTr: 'Hafif olsun',
    hintTr: 'Limonlu, yeşillikli, ağırlık yapmayan',
    focusAxes: ['sour', 'fat'],
  },
  {
    archetypeId: 'baharatli-atesli',
    labelTr: 'Baharatlı olsun',
    hintTr: 'Acı ve keskin',
    focusAxes: ['heat', 'sour'],
  },
  {
    archetypeId: 'dumanli-izgara',
    // "Dumanlı" soyut kalıyordu; kullanıcı zaten aleti düşünüyor.
    labelTr: 'Izgara ve mangal',
    hintTr: 'Ateşte pişsin, is kokusu olsun',
    focusAxes: ['salty', 'sour'],
    method: 'izgara',
  },
  {
    archetypeId: 'tatli-eksi-sos',
    labelTr: 'Tatlı-ekşi olsun',
    hintTr: 'Meyveli, parlak, eti kesen',
    focusAxes: ['sweet', 'sour'],
  },
  {
    archetypeId: 'kremali-sos',
    labelTr: 'Kremalı olsun',
    hintTr: 'Yumuşak, sarmalayan',
    focusAxes: ['fat', 'umami'],
    method: 'sulu',
  },
];

export const CHARACTER_BY_ARCHETYPE = new Map(CHARACTERS.map((c) => [c.archetypeId, c]));

// ── 3. adım: tat ───────────────────────────────────────────────────

/**
 * Tabağın tat kimliği.
 *
 * ── Neden bu soru en başa geldi ────────────────────────────────────
 *
 * Eskiden ilk soru "nasıl bir tat olsun?" diye sorulup `Doyurucu / Hafif /
 * Baharatlı / Dumanlı` seçtiriyordu ve **hiçbir işe yaramıyordu**: seçim
 * yalnızca denge teriminin eksen ağırlığını değiştiriyor, aday havuzuna
 * dokunmuyordu. Ölçüldü — dört karakter de neredeyse aynı altı malzemeyi
 * öneriyordu.
 *
 * Şimdi bu cevap **yemeğin ne olacağını** belirliyor: hangi tat ekseni
 * baskın olacak ve tabağın bir **sosa ihtiyacı var mı**.
 *
 * ── Sos neden zorunlu ──────────────────────────────────────────────
 *
 * Et kendi başına tatlı-ekşi olamaz. Baharat ve acı ana malzemenin üzerine
 * girer, ama tatlılık ile ekşilik ayrı bir bileşenden gelmek zorundadır.
 * `sauce` alanı dolu olan seçeneklerde sos bileşeni kendiliğinden açılıyor;
 * kullanıcıya sorulmuyor çünkü seçenek yok — o tada başka türlü ulaşılmıyor.
 */
export interface TasteChoice {
  id: string;
  labelTr: string;
  hintTr: string;
  /** Tat baskınsa ana yemeğin arketipini de o belirliyor; yoksa gövdeden geliyor. */
  archetypeId?: ArchetypeId;
  focusAxes: TasteAxis[];
  /** Dolu ise sos bileşeni otomatik açılıyor ve hedefi bu oluyor. */
  sauce?: ArchetypeId;
  /** Bu tatla bağdaşmayan gövde seçenekleri — ekranda gizleniyor. */
  hideBody?: string[];
}

export const TASTES: TasteChoice[] = [
  {
    id: 'sade',
    labelTr: 'Sade olsun',
    hintTr: 'Malzemenin kendi tadı öne çıksın',
    focusAxes: ['umami'],
  },
  {
    id: 'baharatli',
    labelTr: 'Baharatlı olsun',
    hintTr: 'Kokulu ve keskin; baharat etin üzerine girer',
    archetypeId: 'baharatli-atesli',
    focusAxes: ['heat', 'umami'],
  },
  {
    id: 'acili',
    labelTr: 'Acılı olsun',
    hintTr: 'Yakan; acı ana malzemeye işler',
    archetypeId: 'baharatli-atesli',
    focusAxes: ['heat'],
    // Acı ile krema birbirini bastırır.
    hideBody: ['kremali'],
  },
  {
    id: 'tatli-eksi',
    labelTr: 'Tatlı-ekşi olsun',
    hintTr: 'Meyveli ve parlak — yanına bir sos kurulur',
    focusAxes: ['sweet', 'sour'],
    sauce: 'tatli-eksi-sos',
  },
  {
    id: 'aci-tatli',
    labelTr: 'Acı-tatlı olsun',
    hintTr: 'Hem yakan hem tatlı — yanına bir sos kurulur',
    archetypeId: 'baharatli-atesli',
    focusAxes: ['heat', 'sweet'],
    sauce: 'tatli-eksi-sos',
    hideBody: ['kremali'],
  },
  {
    id: 'kremali',
    labelTr: 'Kremalı olsun',
    hintTr: 'Yumuşak ve sarmalayan — yanına kremalı sos kurulur',
    focusAxes: ['fat', 'umami'],
    sauce: 'kremali-sos',
    // Kremalı bir tabak hafif olmaz.
    hideBody: ['hafif'],
  },
  {
    id: 'eksi-ferah',
    labelTr: 'Ekşi ve ferah olsun',
    hintTr: 'Limonlu, yeşillikli — yanına hafif bir sos kurulur',
    archetypeId: 'hafif-ferah',
    focusAxes: ['sour'],
    sauce: 'salata-sosu',
    // Ferah bir tabak "doyurucu" olmaz.
    hideBody: ['doyurucu'],
  },
];

export const TASTE_BY_ID = new Map(TASTES.map((t) => [t.id, t]));

// ── 4. adım: gövde ─────────────────────────────────────────────────

/**
 * Tabağın gövdesi — ne kadar zengin ve nasıl pişecek.
 *
 * Tat "hangi eksen" sorusunun cevabı; gövde "ne kadar ve nasıl" sorusunun.
 * İkisi birlikte hem ana yemeğin arketipini hem pişirme yöntemini kuruyor.
 * Eskiden yöntem bileşen planında sabit `tava` yazılıydı ve karakter ne
 * seçilirse seçilsin değişmiyordu.
 */
export interface BodyChoice {
  id: string;
  labelTr: string;
  hintTr: string;
  method: CookMethod;
  /** Tat kendi arketipini dayatmıyorsa ana yemeğin arketipi bu. */
  archetypeId: ArchetypeId;
}

export const BODIES: BodyChoice[] = [
  {
    id: 'doyurucu',
    labelTr: 'Doyurucu olsun',
    hintTr: 'Tencerede, uzun pişmiş, sulu',
    method: 'sulu',
    archetypeId: 'doyurucu-derin',
  },
  {
    id: 'ateste',
    labelTr: 'Ateşte olsun',
    hintTr: 'Izgara ya da mangal; is kokusu',
    method: 'izgara',
    archetypeId: 'dumanli-izgara',
  },
  {
    id: 'kremali',
    labelTr: 'Fırında olsun',
    hintTr: 'Fırında, üzeri kızarmış',
    method: 'firin',
    archetypeId: 'doyurucu-derin',
  },
  {
    id: 'hafif',
    labelTr: 'Hafif olsun',
    hintTr: 'Tavada, çabuk, ağırlık yapmayan',
    method: 'tava',
    archetypeId: 'hafif-ferah',
  },
];

export const BODY_BY_ID = new Map(BODIES.map((b) => [b.id, b]));

/** Seçilen tada göre gösterilecek gövde seçenekleri. */
export function bodiesFor(tasteId: string): BodyChoice[] {
  const hide = new Set(TASTE_BY_ID.get(tasteId)?.hideBody ?? []);
  return BODIES.filter((b) => !hide.has(b.id));
}

export interface LabPlan {
  /** Ana yemeğin tat hedefi. */
  mainArchetype: ArchetypeId;
  method: CookMethod;
  focusAxes: TasteAxis[];
  /** Dolu ise sos bileşeni otomatik açılıyor. */
  sauceArchetype?: ArchetypeId;
}

/**
 * İki cevabı tek plana çeviriyor.
 *
 * Tat kendi arketipini dayatıyorsa (baharatlı, acılı, ekşi-ferah) o kazanıyor;
 * dayatmıyorsa (sade, tatlı-ekşi, kremalı) gövdeninki geçerli. Sebep: "tatlı-ekşi"
 * ana yemeğin değil sosun hedefi — ana yemek bu durumda gövdesiyle tanımlanıyor.
 */
export function planFor(tasteId: string, bodyId: string): LabPlan | null {
  const t = TASTE_BY_ID.get(tasteId);
  const b = BODY_BY_ID.get(bodyId);
  if (!t || !b) return null;
  return {
    mainArchetype: t.archetypeId ?? b.archetypeId,
    method: b.method,
    focusAxes: t.focusAxes,
    sauceArchetype: t.sauce,
  };
}

// ── 3+ adım: rol adımları ──────────────────────────────────────────

/**
 * Bir kümedeki tek bir rol ve o rolün kendi sınırı.
 *
 * Sınırlar mutfak sebebiyle var: bir tavaya iki yağ konmaz, üçten fazla
 * baharat birbirini bastırır. Doz aralığı da role özgü — baharatın oranı
 * binde ikiyle yüzde iki arasında, aromatiğinki yüzde beşle otuz arasında.
 */
export interface RoleSlot {
  role: IngredientRole;
  /** Bu rolden en fazla kaç tane. */
  max: number;
  /** Dozun pratik aralığı, tabak ağırlığının oranı olarak. */
  doseRange?: { min: number; max: number };
  fixedGrams?: number;
}

/**
 * Bir soru ekranı — **pişirme anına göre** kümelenmiş roller.
 *
 * ── Neden küme ─────────────────────────────────────────────────────
 *
 * Önce her rol ayrı bir ekrandı: yağ, aromatik, baharat, bitirici. Ana
 * yemek için dört, sos için dört daha — sekiz ekran. Kullanıcının tarifi
 * "çok zor kuruluyor" demesinin sebebi buydu; arka arkaya baharat ve yağ
 * türevleri geliyordu.
 *
 * ── Neden pişirme anına göre ───────────────────────────────────────
 *
 * Kümeleri mutfak kategorisine göre değil **tencereye giriş sırasına** göre
 * kurduk. Böylece soru sırası, üretilen tarifin adım sırasıyla birebir aynı
 * oluyor (`lab-tarif.ts` içindeki `ROLE_ORDER`): kullanıcı seçim yaparken
 * yemeği zihninde sırayla pişiriyor.
 *
 * ── İki sınır iç içe ───────────────────────────────────────────────
 *
 * `slots[].max` rolün kendi sınırı, `maxPicks` kümenin bütçesi. Hangisi
 * önce dolarsa o bağlar ve arayüz sebebini yazıyor — "yağı zaten seçtin"
 * ile "bu adımda üç malzeme yeter" farklı şeyler.
 */
export interface RoleStep {
  id: string;
  /** Ekranın büyük başlığı. */
  questionTr: string;
  /** Altındaki tek satırlık açıklama — neden bu adım var. */
  hintTr: string;
  slots: RoleSlot[];
  /** Kümenin toplam sınırı. */
  maxPicks: number;
  /** Tabağın içine değil yanına gider; tat profiline karışmaz. */
  accompaniment?: boolean;
}

/** Kümedeki rollerin düz listesi — motorun `allowedRoles` seçeneği için. */
export const rolesOf = (step: RoleStep): IngredientRole[] => step.slots.map((s) => s.role);

/**
 * Sıra tesadüf değil, tencerenin sırası: yağ ısınır, aromatik kavrulur,
 * asit ve baharat girer, bitirici en sonda serpilir.
 *
 * Hiçbir adım zorunlu değil — hepsi "geç" ile atlanabilir.
 */
export const ROLE_STEPS: RoleStep[] = [
  {
    id: 'yag',
    questionTr: 'Neyle pişirelim?',
    hintTr: 'Yağ, aromayı taşıyan şeydir.',
    maxPicks: 1,
    slots: [{ role: 'yag', max: 1, doseRange: { min: 0.04, max: 0.14 } }],
  },
  {
    id: 'aromatik',
    questionTr: 'Hangi aromatik girsin?',
    hintTr: 'Yemeğin kokusunu en çok bunlar belirler.',
    maxPicks: 2,
    slots: [{ role: 'aromatik', max: 2, doseRange: { min: 0.05, max: 0.3 } }],
  },
  {
    id: 'asit',
    questionTr: 'Ekşiliği nereden alsın?',
    hintTr: 'Asit yağı keser ve tadı açar.',
    maxPicks: 1,
    slots: [{ role: 'asit', max: 1, doseRange: { min: 0.02, max: 0.12 } }],
  },
  {
    id: 'baharat',
    questionTr: 'Hangi baharat?',
    hintTr: 'Az miktar çok iş yapar.',
    maxPicks: 2,
    slots: [{ role: 'baharat', max: 2, doseRange: { min: 0.002, max: 0.02 } }],
  },
  {
    id: 'bitirici',
    questionTr: 'Üstüne ne gelsin?',
    hintTr: 'Servisten hemen önce eklenir.',
    maxPicks: 2,
    slots: [{ role: 'bitirici', max: 2, doseRange: { min: 0.01, max: 0.06 } }],
  },
  {
    id: 'zemin',
    questionTr: 'Yanında ne olsun?',
    hintTr: 'Pilav, bulgur ya da ekmek — sosu taşıyan taraf.',
    maxPicks: 1,
    accompaniment: true,
    slots: [{ role: 'zemin', max: 1, fixedGrams: 180 }],
  },
];

// ── Bileşen planları ───────────────────────────────────────────────

/**
 * Her bileşen tipinin kendi adım listesi ve kendi hedef profili var.
 *
 * Sorunun kaynağı buydu: tek bir düz zincir kurunca uskumrun yanına
 * salatalık "balığın içine" giriyordu. Artık salatalık `garnitur`
 * bileşeninde seçiliyor; motor o bileşeni ayrı bir tabak gibi dengeliyor,
 * balık ise `pairedWith` tarafında duruyor — aroma uyumuna giriyor ama
 * tat profiline karışmıyor.
 */
export interface ComponentPlan {
  kind: ComponentKind;
  labelTr: string;
  hintTr: string;
  method: CookMethod;
  /** Kullanıcının seçebileceği hedef profiller. */
  archetypes: ArchetypeId[];
  steps: RoleStep[];
}

export const COMPONENT_PLANS: Record<'ana' | 'sos' | 'garnitur', ComponentPlan> = {
  ana: {
    kind: 'ana',
    labelTr: 'Ana yemek',
    hintTr: 'Tabağın merkezi',
    method: 'tava',
    archetypes: ['doyurucu-derin', 'hafif-ferah', 'baharatli-atesli', 'dumanli-izgara'],
    steps: [
      {
        id: 'taban',
        questionTr: 'Neyin içinde pişsin?',
        hintTr: 'Yağ aromayı taşır, aromatik kokuyu verir. İlk tencereye girenler.',
        maxPicks: 3,
        slots: [
          { role: 'yag', max: 1, doseRange: { min: 0.04, max: 0.14 } },
          { role: 'aromatik', max: 2, doseRange: { min: 0.05, max: 0.3 } },
        ],
      },
      {
        id: 'birlikte',
        questionTr: 'Ana malzemeyle birlikte ne girsin?',
        hintTr: 'Yanında pişecekler ve baharat. Baharatta az miktar çok iş yapar.',
        maxPicks: 3,
        slots: [
          { role: 'zemin', max: 2, doseRange: { min: 0.15, max: 0.6 } },
          { role: 'baglayici', max: 1, doseRange: { min: 0.05, max: 0.3 } },
          { role: 'baharat', max: 2, doseRange: { min: 0.002, max: 0.02 } },
        ],
      },
      {
        id: 'sona',
        questionTr: 'Sona doğru ne eklensin?',
        hintTr: 'Ekşilik ve tatlılık sona bırakılır; erken girerse tadı uçar.',
        maxPicks: 2,
        slots: [
          { role: 'asit', max: 1, doseRange: { min: 0.01, max: 0.08 } },
          { role: 'tatlandirici', max: 1, doseRange: { min: 0.01, max: 0.08 } },
        ],
      },
      {
        id: 'bitiris',
        questionTr: 'Ocaktan sonra üstüne ne gelsin?',
        hintTr: 'Servisten hemen önce; kokusu pişerken kaybolmasın.',
        maxPicks: 2,
        slots: [{ role: 'bitirici', max: 2, doseRange: { min: 0.01, max: 0.06 } }],
      },
    ],
  },

  sos: {
    kind: 'sos',
    labelTr: 'Sos',
    hintTr: 'Üzerine ya da yanına',
    method: 'sulu',
    archetypes: ['tatli-eksi-sos', 'kremali-sos', 'kirmizi-et-sos', 'salata-sosu'],
    steps: [
      {
        id: 'sos-taban',
        questionTr: 'Sosun tabanı ne olsun?',
        hintTr: 'Sosun karakterini bu belirliyor — meyve, ekşi ya da süt.',
        maxPicks: 2,
        slots: [
          { role: 'asit', max: 1, doseRange: { min: 0.3, max: 0.7 } },
          { role: 'tatlandirici', max: 1, doseRange: { min: 0.2, max: 0.5 } },
          { role: 'baglayici', max: 1, doseRange: { min: 0.2, max: 0.6 } },
        ],
      },
      {
        id: 'sos-ortam',
        questionTr: 'Yağını ve aromatiğini nereden alsın?',
        hintTr: 'Yağ sosu bağlar; soğan ya da sarımsak gövdesini verir.',
        maxPicks: 3,
        slots: [
          { role: 'yag', max: 1, doseRange: { min: 0.05, max: 0.2 } },
          { role: 'aromatik', max: 2, doseRange: { min: 0.05, max: 0.25 } },
        ],
      },
      {
        id: 'sos-bitiris',
        questionTr: 'Baharatı ve üstü?',
        hintTr: 'Sosta baharat daha da az kullanılır.',
        maxPicks: 2,
        slots: [
          { role: 'baharat', max: 1, doseRange: { min: 0.002, max: 0.015 } },
          { role: 'bitirici', max: 1, doseRange: { min: 0.01, max: 0.05 } },
        ],
      },
    ],
  },

  garnitur: {
    kind: 'garnitur',
    labelTr: 'Yanında',
    hintTr: 'Salata, pilav ya da püre',
    method: 'cig',
    archetypes: ['hafif-ferah', 'salata-sosu'],
    steps: [
      {
        id: 'garni-taban',
        questionTr: 'Yanına ne koyalım?',
        hintTr: 'Ana malzemenin yanındaki tabak.',
        maxPicks: 2,
        slots: [
          { role: 'zemin', max: 2, doseRange: { min: 0.4, max: 0.9 } },
          { role: 'ana', max: 1, doseRange: { min: 0.4, max: 0.9 } },
        ],
      },
      {
        id: 'garni-tat',
        questionTr: 'Ekşiliğini ve yağını nereden alsın?',
        hintTr: 'Yanındaki tabak ekşi olursa ana yemeğin yağını keser.',
        maxPicks: 2,
        slots: [
          { role: 'asit', max: 1, doseRange: { min: 0.02, max: 0.12 } },
          { role: 'yag', max: 1, doseRange: { min: 0.03, max: 0.12 } },
        ],
      },
      {
        id: 'garni-bitiris',
        questionTr: 'Üstüne?',
        hintTr: 'Yeşillik, peynir ya da kuruyemiş.',
        maxPicks: 2,
        slots: [{ role: 'bitirici', max: 2, doseRange: { min: 0.01, max: 0.08 } }],
      },
    ],
  },
};

export const COMPONENT_ORDER = ['ana', 'sos', 'garnitur'] as const;
export type ComponentPlanId = (typeof COMPONENT_ORDER)[number];
