import { Tabs } from 'expo-router/js-tabs';
import { BookHeart, FlaskConical, House, Refrigerator, Soup } from 'lucide-react-native';

import { palette } from '@/theme/tokens';

const ICON_SIZE = 27;

/**
 * Beş sekme; Gusto's tam ortada.
 *
 * Orta konum bilinçli: kullanıcının kendi kitabı uygulamanın kalbi, başparmağın
 * doğal olarak durduğu yer orası.
 *
 * İkonların altında yazı yok. Yükseklik de elle verilmiyor: yazı olmayınca
 * çubuk kendi doğal boyuna oturuyor ve alt güvenli alanı kendisi hesaplıyor.
 * `title` ve `tabBarAccessibilityLabel` yine de dolu — etiket ekranda
 * görünmese de ekran okuyucu sekmeyi bu adla okuyor.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: { paddingVertical: 6 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <House color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="canim"
        options={{
          title: 'Keşfet',
          tabBarAccessibilityLabel: 'Canım ne istiyor',
          tabBarIcon: ({ color }) => <Soup color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="gustos"
        options={{
          title: "Gusto's",
          tabBarAccessibilityLabel: "Gusto's, yemek kitabın",
          tabBarIcon: ({ color }) => <BookHeart color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="dolabim"
        options={{
          title: 'Dolabım',
          tabBarAccessibilityLabel: 'Elimde ne var',
          tabBarIcon: ({ color }) => <Refrigerator color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: 'Lab',
          tabBarAccessibilityLabel: 'Lezzet Lab',
          tabBarIcon: ({ color }) => <FlaskConical color={color} size={ICON_SIZE} />,
        }}
      />
    </Tabs>
  );
}
