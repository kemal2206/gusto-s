/**
 * Profil veri modeli — saf TypeScript.
 *
 * Tipler ve etiketler store'dan ayrı duruyor: `store/profile.ts` AsyncStorage'a
 * bağlı, dolayısıyla React Native dışında (veri hattı, smoke test) çalışmıyor.
 * Filtreleme ve menü kurucu bu dosyayı kullanınca aynı kod Node'da da koşuyor.
 */

/** Diyet kısıtları — açılış sorusundaki kutucuklar. */
export type DietRestriction =
  | 'laktozsuz'
  | 'glutensiz'
  | 'domuzsuz'
  | 'vegan'
  | 'vejetaryen'
  | 'pesketaryen';

export const DIET_LABELS: Record<DietRestriction, { label: string; hint: string }> = {
  laktozsuz: { label: 'Süt ürünsüz', hint: 'Süt, peynir, yoğurt yok' },
  glutensiz: { label: 'Glutensiz', hint: 'Buğday, un, makarna yok' },
  domuzsuz: { label: 'Domuzsuz', hint: 'Domuz ürünü yok' },
  vegan: { label: 'Vegan', hint: 'Hiçbir hayvansal ürün yok' },
  vejetaryen: { label: 'Vejetaryen', hint: 'Et ve balık yok' },
  pesketaryen: { label: 'Pesketaryen', hint: 'Et yok, balık var' },
};

/** Mutfak ekipmanı — hangi pişirme yöntemleri mümkün. */
export type Appliance =
  | 'ocak'
  | 'firin'
  | 'mikrodalga'
  | 'fritoz'
  | 'blender'
  | 'dusuk-tencere'
  | 'airfryer';

export const APPLIANCE_LABELS: Record<Appliance, string> = {
  ocak: 'Ocak',
  firin: 'Fırın',
  mikrodalga: 'Mikrodalga',
  fritoz: 'Fritöz',
  blender: 'Blender',
  'dusuk-tencere': 'Düdüklü / yavaş pişirici',
  airfryer: 'Airfryer',
};

/**
 * Sağlık gerekçesiyle tamamen çıkarılan malzemeler.
 *
 * `dislikedSlugs`'tan ayrı tutuluyor: "patlıcan sevmiyorum" ile "yumurta beni
 * hasta ediyor" aynı şey değil. İkisi de listeden eliyor ama kullanıcı
 * birini temizlerken diğerini kaybetmemeli, ve ekranda ayrı anlatılıyorlar.
 */
export interface EliminationState {
  /** Seçili şablonlar — `eliminasyon.ts` kimlikleri. */
  eliminations: string[];
  /** Kullanıcının kendi eklediği malzemeler. */
  excludedSlugs: string[];
}

export interface Household {
  adults: number;
  children: number;
  dogs: number;
  cats: number;
}

/** Kaç kişilik pişirilecek — porsiyon ölçeklemesi bunu kullanıyor. */
export function eaterCount(h: Household): number {
  // Çocuk yarım porsiyon sayılıyor; hayvanlar yemekten pay almıyor.
  return Math.max(1, Math.round(h.adults + h.children * 0.5));
}
