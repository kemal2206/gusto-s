/**
 * Lezzet motoru — genel API.
 *
 * Saf TypeScript. React/Expo/Supabase bağımlılığı yok; aynı kod hem uygulamada
 * hem `scripts/` veri hattında çalışır.
 *
 * Bilimsel temel:
 *   Ahn, Ahnert, Bagrow, Barabási (2011) — "Flavor network and the principles
 *   of food pairing", Scientific Reports 1:196.
 *   Batı mutfağında paylaşılan bileşik sayısı ile birlikte kullanım pozitif,
 *   Doğu Asya'da NEGATİF korelasyonlu. Bu yüzden motor iki modu da destekler.
 */

export * from './types';
export * from './affinity';
export * from './balance';
export * from './bridge';
export * from './lookup';
export * from './score';
