/**
 * Lezzet motoru — tip tanımları.
 *
 * Bu klasördeki hiçbir dosya React, Expo veya Supabase import etmez.
 * Aynı kod hem uygulamada hem `scripts/` veri hattında çalışır, birim testi kolaydır.
 */

// ── Tat ────────────────────────────────────────────────────────────────

export const TASTE_AXES = ['sweet', 'sour', 'salty', 'bitter', 'umami', 'fat', 'heat'] as const;
export type TasteAxis = (typeof TASTE_AXES)[number];

/** Her eksen 0–10. */
export type TasteVector = Record<TasteAxis, number>;

/**
 * Türkçede "acı" hem bitter hem hot demek. UI'da asla yalın "acı" yazmıyoruz,
 * bu yüzden etiketler burada tek yerde tanımlı.
 */
export const TASTE_LABELS_TR: Record<TasteAxis, string> = {
  sweet: 'Tatlı',
  sour: 'Ekşi',
  salty: 'Tuzlu',
  bitter: 'Kekremsi',
  umami: 'Doyurucu',
  fat: 'Yağlı',
  heat: 'Acı/baharatlı',
};

export const ZERO_TASTE: TasteVector = {
  sweet: 0,
  sour: 0,
  salty: 0,
  bitter: 0,
  umami: 0,
  fat: 0,
  heat: 0,
};

// ── Malzeme ────────────────────────────────────────────────────────────

export const INGREDIENT_CATEGORIES = [
  'protein',
  'deniz',
  'sarkuteri',
  'sut',
  'sebze',
  'mantar',
  'ot',
  'baharat',
  'meyve',
  'kuruyemis',
  'tahil',
  'baklagil',
  'yag',
  'asit',
  'tatlandirici',
  'icecek',
  'diger',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const CATEGORY_LABELS_TR: Record<IngredientCategory, string> = {
  protein: 'Et ve kümes',
  deniz: 'Deniz ürünü',
  sarkuteri: 'Şarküteri',
  sut: 'Süt ürünü',
  sebze: 'Sebze',
  mantar: 'Mantar',
  ot: 'Yeşillik ve ot',
  baharat: 'Baharat',
  meyve: 'Meyve',
  kuruyemis: 'Kuruyemiş',
  tahil: 'Tahıl ve hamur',
  baklagil: 'Bakliyat',
  yag: 'Yağ',
  asit: 'Ekşi ve sirke',
  tatlandirici: 'Tatlandırıcı',
  icecek: 'İçecek',
  diger: 'Diğer',
};

/** Malzemenin tabaktaki işlevi — motor "hangi rol boş?" sorusunu bununla yanıtlar. */
export type IngredientRole =
  | 'ana'
  | 'aromatik'
  | 'asit'
  | 'tatlandirici'
  | 'yag'
  | 'baglayici'
  | 'baharat'
  | 'bitirici'
  | 'zemin';

export const ROLE_LABELS_TR: Record<IngredientRole, string> = {
  ana: 'Ana malzeme',
  aromatik: 'Aromatik',
  asit: 'Ekşilik veren',
  tatlandirici: 'Tatlandırıcı',
  yag: 'Yağ',
  baglayici: 'Bağlayıcı',
  baharat: 'Baharat',
  bitirici: 'Bitirici',
  zemin: 'Zemin',
};

export interface Ingredient {
  id: number;
  slug: string;
  nameTr: string;
  nameEn?: string;
  category: IngredientCategory;
  defaultRole: IngredientRole;
  /** Karakteristik olduğu mutfaklar — 'tr', 'levanten', 'balkan'… */
  cuisines: string[];
  roles: IngredientRole[];

  taste: TasteVector;
  /** 1 gramın yemeği ne kadar etkilediği. Safran ~10, patates ~1. */
  potency: number;
  /** Aroma gücü 0–10 — sessiz mi gürültülü mü bir malzeme. */
  aromaPower: number;

  /**
   * Bileşik id'leri. Uygulamada genelde boş (kenarlar önceden hesaplı gelir);
   * yalnızca veri hattında ve "ne olurdu?" hesaplarında dolu olur.
   */
  compoundIds?: number[];

  /**
   * Akrabalık grubu — aynı şeyin farklı hâlleri.
   *
   * Taze nane ile kuru nane kimyasal olarak birbirine çok benzer, bu yüzden
   * motor ikisini de "mükemmel eşleşme" sanıyor ve ete taze nane koyduktan
   * sonra kuru nane öneriyor. Matematik doğru, mutfak saçma. Aynı akrabalıktan
   * ikinci bir malzeme ağır ceza alıyor.
   */
  kin?: string;

  allergenTags: string[];
  dietTags: string[];
  isStaple: boolean;

  /**
   * Gerçek fotoğraf. Aşama 2'de dolacak; boşken arayüz emoji katmanına düşer.
   */
  imageUrl?: string;
}

// ── Flavor network kenarı ──────────────────────────────────────────────

export interface CompoundRef {
  slug: string;
  nameTr: string;
  /** Duyusal karşılığı — "damaskenon" yerine "kuru meyve, gül" demek için. */
  senseTr?: string;
  /** IDF ağırlığı — ne kadar ayırt edici bir bileşik. */
  weight: number;
}

export type PairingKind = 'paylasilan' | 'zit' | 'geleneksel' | 'kopru';

export interface PairingEdge {
  aId: number;
  bId: number;
  kind?: PairingKind;
  /** Ham ortak bileşik sayısı — kullanıcıya bu gösterilir. */
  sharedCount: number;
  /** IDF ağırlıklı kosinüs benzerliği ∈ [0,1]. */
  aromaScore: number;
  /** Tarif korpusundan kültürel önsel ∈ [0,1]. Bilinmiyorsa undefined. */
  priorNpmi?: number;
  topCompounds: CompoundRef[];
}

/** Önceden hesaplanmış kenarlara O(1) erişim. */
export interface PairingIndex {
  get(aId: number, bId: number): PairingEdge | undefined;
  /** Bir malzemenin en yüksek skorlu komşuları. */
  neighbors(id: number, limit?: number): PairingEdge[];
}

// ── Tabak durumu ───────────────────────────────────────────────────────

export interface DishComponent {
  ingredient: Ingredient;
  grams: number;
  role: IngredientRole;
}

export interface DishState {
  /**
   * Dengelenen hazırlığın İÇİNDEKİLER. Sos yapıyorsak yalnızca sosun malzemeleri.
   */
  components: DishComponent[];

  /**
   * Yanında/üstünde servis edilenler — antrikotun üzerine sos yapıyorsak antrikot.
   *
   * Bunlar tat profiline KARIŞMAZ: 250 g eti 60 g sosla aynı kaba koyarsak
   * sosun tatlılığı ölçülemez hâle geliyor. Ama aroma uyumuna ve hedefin
   * kaymasına (yağlı et daha ekşi sos ister) katkı verirler.
   */
  pairedWith?: DishComponent[];

  /** Hedef arketip — yoksa denge skoru hesaplanmaz, sadece aroma çalışır. */
  archetypeId?: ArchetypeId;
}

/**
 * Hedef profiller iki gruba ayrılıyor:
 *  - **karakter**: kullanıcının "nasıl bir yemek olsun" cevabı (Lab zincirinin 2. adımı)
 *  - **hazırlık**: belirli bir bileşenin hedefi (sos, çorba, marinasyon)
 */
export type ArchetypeId =
  // karakter
  | 'hafif-ferah'
  | 'doyurucu-derin'
  | 'baharatli-atesli'
  | 'dumanli-izgara'
  // hazırlık
  | 'tatli-eksi-sos'
  | 'kirmizi-et-sos'
  | 'kremali-sos'
  | 'salata-sosu'
  | 'corba'
  | 'izgara-marine'
  | 'tatli';

export interface Archetype {
  id: ArchetypeId;
  labelTr: string;
  description: string;
  target: TasteVector;
  /** Eksen başına kabul edilebilir sapma; aşılırsa "fazla kaçmış" cezası. */
  tolerance: number;
  expectedRoles: IngredientRole[];
}

// ── Öneri ──────────────────────────────────────────────────────────────

/**
 * Gerekçeler yapısal tutuluyor; Türkçe cümleye UI katmanı çeviriyor.
 * Böylece motor dilden bağımsız kalıyor ve test edilebiliyor.
 */
export type Reason =
  | { kind: 'ortak-bilesik'; withName: string; count: number; top: string[] }
  | { kind: 'denge'; axis: TasteAxis; from: number; to: number; target: number }
  | { kind: 'gelenek'; withName: string; strength: number }
  | { kind: 'rol'; role: IngredientRole }
  | { kind: 'zitlik'; withName: string }
  | { kind: 'uyari-fazla'; axis: TasteAxis; value: number; limit: number };

/**
 * Adayın tabaktaki bir malzemeye BAĞI.
 *
 * Zincir kuralı: kullanıcıya gösterilen her seçeneğin, o ana kadar seçtiği
 * malzemelerden en az biriyle gösterilebilir bir bağı olmak zorunda —
 * kimyasal (ortak aroma ailesi), tat (dengeyi tamamlıyor) ya da geleneksel.
 * Bağı olmayan aday listeye hiç girmez.
 */
export type LinkKind = 'kimya' | 'tat' | 'gelenek';

export interface SuggestionLink {
  kind: LinkKind;
  withSlug: string;
  withName: string;
  /** kimya → ortak aile sayısı · tat → kazanç 0–1 · gelenek → güç 0–1 */
  strength: number;
  /** Bağ, kullanıcının EN SON seçtiği malzemeye mi? */
  isAnchor: boolean;
  /** kimya bağında paylaşılan aroma aileleri. */
  compounds?: CompoundRef[];
}

export interface Suggestion {
  ingredient: Ingredient;
  /** Nihai bileşik skor ∈ [0,1]. */
  score: number;
  /** Boş olamaz — bağsız aday üretilmez. */
  links: SuggestionLink[];

  /**
   * Tabaktaki malzemelerin ne kadarıyla bağlı ∈ [0,1].
   *
   * Tek bir malzemeye bağlı olmak yetmiyor: uskumrunun yanına salatalık
   * "salatalıkla uskumru bir bileşik paylaşıyor" diye gelirse tabak dağılıyor.
   * Çoğunlukla bağlı olan aday öne çıkar.
   */
  coherence: number;
  /** Bağlı olduğu malzeme sayısı / toplam. Kullanıcıya bu gösterilir. */
  linkedTo: { linked: number; total: number };
  breakdown: {
    aroma: number;
    balance: number;
    prior: number;
    role: number;
    penalty: number;
  };
  /** Önerilen miktar (gram) — dozaj skorun bir parçası, gizlenmemeli. */
  suggestedGrams: number;
  reasons: Reason[];
}

// ── Motor ayarları ─────────────────────────────────────────────────────

export type PairingMode = 'benzerlik' | 'zitlik';

export interface ScoreWeights {
  aroma: number;
  balance: number;
  prior: number;
  role: number;
}

export interface EngineOptions {
  mode: PairingMode;
  weights: ScoreWeights;
  /**
   * Kullanıcının derdi olan eksenler. "Tatlı-ekşi dengesini soruyorum" →
   * ['sweet','sour']. Bu eksenlerdeki açık, denge hesabında ağır basar.
   */
  focusAxes?: TasteAxis[];
  /** Sert filtre — hiçbir skor bunu geçemez. */
  excludeAllergens?: string[];
  excludeIngredientIds?: number[];
  requireDietTags?: string[];
  /** Yalnızca bu rollerdeki adaylar. */
  allowedRoles?: IngredientRole[];
  /** Yalnızca bu kategorilerdeki adaylar. */
  allowedCategories?: IngredientCategory[];
  /** Yalnızca bu mutfaklarda karakteristik olan adaylar. */
  cuisines?: string[];

  /**
   * Zincir kuralı: bağı olmayan adayı listeden çıkar. Varsayılan açık.
   * Kapatmak yalnızca serbest keşif ekranında mantıklı.
   */
  requireLink?: boolean;
  /** Kimya bağı için asgari aroma benzerliği. */
  minAromaLink?: number;
  /** Tat bağı için asgari denge kazancı. */
  minBalanceLink?: number;
  /** Gelenek bağı için asgari güç. */
  minPriorLink?: number;
  /** Kullanıcının en son seçtiği malzeme — ona bağlı adaylar öne çıkar. */
  anchorIngredientId?: number;

  /**
   * Adayın tabaktaki malzemelerin en az bu oranıyla bağlı olması beklenir.
   * Bu eşiği geçen yeterli aday yoksa kural gevşetilir (boş liste göstermeyiz),
   * ama sıralama yine tutarlılığa göre yapılır. Varsayılan 0.5.
   */
  minCoherence?: number;

  /**
   * Doz aralığı (tabak ağırlığının oranı). Rol adımından gelir; sınır yoksa
   * optimizasyon mutfakta anlamsız miktarlar öneriyor.
   */
  doseBounds?: { min: number; max: number };
  /** Sabit gram — denge optimizasyonu yapılmaz (ör. pilav 150 g). */
  fixedGrams?: number;

  limit?: number;
}

export interface BridgeResult {
  ingredient: Ingredient;
  /** İki uçla olan aroma benzerliklerinin harmonik ortalaması. */
  score: number;
  toA: number;
  toB: number;
  sharedWithA: number;
  sharedWithB: number;
}
