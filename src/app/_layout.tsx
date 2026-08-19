import { useFonts } from 'expo-font';
import { ShadowsIntoLight_400Regular } from '@expo-google-fonts/shadows-into-light';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initAuth } from '@/lib/auth';
import { useProfile } from '@/lib/store/profile';
import { palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Malzeme/bileşik katalogu neredeyse hiç değişmiyor; boşuna ağ trafiği yapma.
      staleTime: 30 * 60 * 1000,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    ShadowsIntoLight_400Regular,
    ZalandoSans_SemiExpanded_Regular: require('../../assets/fonts/ZalandoSans-SemiExpanded.ttf'),
    ZalandoSans_SemiExpanded_Medium: require('../../assets/fonts/ZalandoSans-SemiExpandedMedium.ttf'),
    ZalandoSans_SemiExpanded_SemiBold: require('../../assets/fonts/ZalandoSans-SemiExpandedSemiBold.ttf'),
    ZalandoSans_SemiExpanded_Bold: require('../../assets/fonts/ZalandoSans-SemiExpandedBold.ttf'),
  });

  const hydrated = useProfile((s) => s.hydrated);
  const onboarded = useProfile((s) => s.onboarded);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Kayıtlı oturumu geri yükle ve oturum değişikliklerini dinle.
  useEffect(() => initAuth(), []);

  /**
   * İlk açılış: profil diskten okunmadan karar vermiyoruz, yoksa hesabı olan
   * kullanıcıya da tanışma ekranı bir an görünüp kayboluyor.
   */
  useEffect(() => {
    if (fontsLoaded && hydrated && !onboarded) router.replace('/tanisma');
  }, [fontsLoaded, hydrated, onboarded, router]);

  // Inter yüklenmeden çizersek metinler önce sistem fontuyla görünüp zıplıyor.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.surface },
          }}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
