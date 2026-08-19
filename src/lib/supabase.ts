import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Aşama 2'ye kadar .env yok — o yüzden burada patlamak yerine `null` dönüyoruz.
 * Ekranlar `isSupabaseConfigured` ile yerel örnek veriye düşüyor.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native'de URL tabanlı oturum algılama yok.
        detectSessionInUrl: false,
      },
    })
  : null;
