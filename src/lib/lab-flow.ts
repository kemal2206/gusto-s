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
}

export const CHARACTERS: CharacterChoice[] = [
  {
    archetypeId: 'doyurucu-derin',
    labelTr: 'Doyurucu olsun',
    hintTr: 'Soslu, uzun pişmiş, tok tutan',
    focusAxes: ['umami', 'fat'],
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
    labelTr: 'Dumanlı olsun',
    hintTr: 'Izgara, kömür, is notası',
    focusAxes: ['salty', 'sour'],
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
  },
];

export const CHARACTER_BY_ARCHETYPE = new Map(CHARACTERS.map((c) => [c.archetypeId, c]));

// ── 3+ adım: rol adımları ──────────────────────────────────────────

export interface RoleStep {
  id: string;
  /** Ekranın büyük başlığı. */
  questionTr: string;
  /** Altındaki tek satırlık açıklama — neden bu adım var. */
  hintTr: string;
  roles: IngredientRole[];
  /** Kaç malzeme seçilebilir. Baharatta birden fazla mantıklı. */
  maxPicks: number;
  /**
   * Dozun pratik aralığı, tabak ağırlığının oranı olarak.
   * Sınır olmadan optimizasyon "2 g pirinç" ya da "100 g tereyağı" öneriyor.
   */
  doseRange?: { min: number; max: number };
  /** Sabit gram — dengeye göre optimize edilmez. */
  fixedGrams?: number;
  /** Tabağın içine değil yanına gider; tat profiline karışmaz. */
  accompaniment?: boolean;
}

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
    hintTr: 'Yağ, aromayı taşıyan şeydir. Tereyağı ile zeytinyağı aynı yemeği değiştirir.',
    roles: ['yag'],
    maxPicks: 1,
    doseRange: { min: 0.04, max: 0.14 },
  },
  {
    id: 'aromatik',
    questionTr: 'Hangi aromatik girsin?',
    hintTr: 'Yemeğin kokusunu en çok bunlar belirler.',
    roles: ['aromatik'],
    maxPicks: 2,
    doseRange: { min: 0.05, max: 0.3 },
  },
  {
    id: 'asit',
    questionTr: 'Ekşiliği nereden alsın?',
    hintTr: 'Asit yağı keser ve tadı açar. Ekşisi olmayan yemek ağır kalır.',
    roles: ['asit'],
    maxPicks: 1,
    doseRange: { min: 0.02, max: 0.12 },
  },
  {
    id: 'baharat',
    questionTr: 'Hangi baharat?',
    hintTr: 'Az miktar çok iş yapar. İkiden fazlası birbirini bastırır.',
    roles: ['baharat'],
    maxPicks: 2,
    doseRange: { min: 0.002, max: 0.02 },
  },
  {
    id: 'bitirici',
    questionTr: 'Üstüne ne gelsin?',
    hintTr: 'Servisten hemen önce eklenir; kokusu pişerken kaybolmasın.',
    roles: ['bitirici'],
    maxPicks: 2,
    doseRange: { min: 0.01, max: 0.06 },
  },
  {
    id: 'zemin',
    questionTr: 'Yanında ne olsun?',
    hintTr: 'Pilav, bulgur ya da ekmek — sosu taşıyan taraf.',
    roles: ['zemin'],
    maxPicks: 1,
    // Yanına gidiyor, içine değil: 200 g pilavı tabağın profiline karıştırırsak
    // bütün tatlar seyreliyor ve denge okuması anlamsızlaşıyor.
    fixedGrams: 180,
    accompaniment: true,
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
      { id: 'yag', questionTr: 'Neyle pişirelim?',
        hintTr: 'Yağ aromayı taşır. Tereyağı ile zeytinyağı aynı yemeği değiştirir.',
        roles: ['yag'], maxPicks: 1, doseRange: { min: 0.04, max: 0.14 } },
      { id: 'aromatik', questionTr: 'Hangi aromatik girsin?',
        hintTr: 'Yemeğin kokusunu en çok bunlar belirler.',
        roles: ['aromatik'], maxPicks: 2, doseRange: { min: 0.05, max: 0.3 } },
      { id: 'baharat', questionTr: 'Hangi baharat?',
        hintTr: 'Az miktar çok iş yapar. İkiden fazlası birbirini bastırır.',
        roles: ['baharat'], maxPicks: 2, doseRange: { min: 0.002, max: 0.02 } },
      { id: 'bitirici', questionTr: 'Üstüne ne gelsin?',
        hintTr: 'Servisten hemen önce; kokusu pişerken kaybolmasın.',
        roles: ['bitirici'], maxPicks: 2, doseRange: { min: 0.01, max: 0.06 } },
    ],
  },

  sos: {
    kind: 'sos',
    labelTr: 'Sos',
    hintTr: 'Üzerine ya da yanına',
    method: 'sulu',
    archetypes: ['tatli-eksi-sos', 'kremali-sos', 'kirmizi-et-sos', 'salata-sosu'],
    steps: [
      { id: 'taban', questionTr: 'Sosun tabanı ne olsun?',
        hintTr: 'Sosun karakterini bu belirliyor — meyve, ekşi ya da süt.',
        roles: ['asit', 'tatlandirici', 'baglayici'], maxPicks: 1,
        doseRange: { min: 0.3, max: 0.7 } },
      { id: 'sos-yag', questionTr: 'Yağı nereden alsın?',
        hintTr: 'Yağ sosu bağlar ve ağızda kalmasını sağlar.',
        roles: ['yag'], maxPicks: 1, doseRange: { min: 0.05, max: 0.2 } },
      { id: 'sos-aromatik', questionTr: 'Hangi aromatik?',
        hintTr: 'Soğan, sarımsak ya da bir ot.',
        roles: ['aromatik'], maxPicks: 2, doseRange: { min: 0.05, max: 0.25 } },
      { id: 'sos-baharat', questionTr: 'Baharat?',
        hintTr: 'Sosta baharat daha da az kullanılır.',
        roles: ['baharat'], maxPicks: 1, doseRange: { min: 0.002, max: 0.015 } },
    ],
  },

  garnitur: {
    kind: 'garnitur',
    labelTr: 'Yanında',
    hintTr: 'Salata, pilav ya da püre',
    method: 'cig',
    archetypes: ['hafif-ferah', 'salata-sosu'],
    steps: [
      { id: 'garni-taban', questionTr: 'Yanına ne koyalım?',
        hintTr: 'Ana malzemenin yanındaki tabak.',
        roles: ['zemin', 'ana'], maxPicks: 2, doseRange: { min: 0.4, max: 0.9 } },
      { id: 'garni-asit', questionTr: 'Ekşiliği nereden?',
        hintTr: 'Yanındaki tabak ekşi olursa ana yemeğin yağını keser.',
        roles: ['asit'], maxPicks: 1, doseRange: { min: 0.02, max: 0.12 } },
      { id: 'garni-yag', questionTr: 'Yağı?',
        hintTr: 'Salatada zeytinyağı, pilavda tereyağı.',
        roles: ['yag'], maxPicks: 1, doseRange: { min: 0.03, max: 0.12 } },
      { id: 'garni-bitirici', questionTr: 'Üstüne?',
        hintTr: 'Yeşillik, peynir ya da kuruyemiş.',
        roles: ['bitirici'], maxPicks: 2, doseRange: { min: 0.01, max: 0.08 } },
    ],
  },
};

export const COMPONENT_ORDER = ['ana', 'sos', 'garnitur'] as const;
export type ComponentPlanId = (typeof COMPONENT_ORDER)[number];
