import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { RecipeTile } from '@/components/recipe-tile';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { matchPantry, type RecipeMatch } from '@/data/recipes';
import { isAllowed } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { spacing } from '@/theme/tokens';

/**
 * "Elimde ne var" sonucu.
 *
 * Üç gruba ayrılıyor: tam çıkanlar, bir eksikle çıkanlar, iki eksikle
 * çıkanlar. Eksik malzeme adı gösteriliyor ki kullanıcı ne alması
 * gerektiğini bilsin — "2 eksik" tek başına işe yaramıyor.
 *
 * Tuz, su, un gibi her mutfakta bulunanlar eksik sayılmıyor.
 */
export default function PantryResultScreen() {
  const { slugs } = useLocalSearchParams<{ slugs?: string }>();
  const router = useRouter();

  const profileFilter = useProfileFilter();

  const pantry = useMemo(() => new Set((slugs ?? '').split(',').filter(Boolean)), [slugs]);
  const matches = useMemo(
    () => matchPantry(pantry).filter((m) => isAllowed(m.recipe, profileFilter)),
    [pantry, profileFilter],
  );

  /**
   * Üç kesin grup, sonra "en yakın". Kesin gruplar zayıf kalırsa kullanıcıyı
   * boş ekranla baş başa bırakmamak için en yüksek puanlı kalanları da
   * gösteriyoruz — ama ayrı başlık altında, karıştırmadan.
   */
  const groups: { key: number; title: string; list: RecipeMatch[] }[] = [
    { key: 0, title: 'Tam çıkıyor', list: matches.filter((m) => m.missing.length === 0) },
    { key: 1, title: '1 malzeme eksik', list: matches.filter((m) => m.missing.length === 1) },
    { key: 2, title: '2 malzeme eksik', list: matches.filter((m) => m.missing.length === 2) },
  ];

  const exact = groups.reduce((n, g) => n + g.list.length, 0);
  if (exact < 6) {
    groups.push({
      key: 3,
      title: 'Sana en yakın olanlar',
      list: matches.filter((m) => m.missing.length > 2).slice(0, 8),
    });
  }

  const missingNames = (slugList: string[]) =>
    slugList.map((s) => BY_SLUG.get(s)?.nameTr ?? s).join(', ');

  const anyResult = matches.length > 0;

  return (
    <Screen footer={<Button label="Malzemeleri değiştir" variant="quiet" onPress={() => router.back()} />}>
      <View style={styles.head}>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 32, lineHeight: 36, marginBottom: 8 }}>
          Bunları yapabilirsin
        </Text>
      </View>

      {!anyResult ? (
        <Text variant="body" tone="muted">
          Seçtiklerinle örtüşen tarif bulunamadı. Birkaç malzeme daha işaretlersen
          eşleşme artar — özellikle soğan, salça, yoğurt gibi temel malzemeler
          çok tarife giriyor.
        </Text>
      ) : null}

      {groups.map((g) => {
        const list = g.list;
        if (!list.length) return null;
        return (
          <View key={g.key} style={styles.group}>
            <Eyebrow tone={g.key === 0 ? 'brand' : 'muted'}>
              {`${g.title} · ${list.length}`}
            </Eyebrow>
            <View style={styles.grid}>
              {list.slice(0, 12).map((m) => (
                <View key={m.recipe.slug} style={{ width: '48%' }}>
                  <RecipeTile
                    recipe={m.recipe}
                    fluid
                    matchHint={
                      m.missing.length && m.missing.length <= 2
                        ? `Eksik: ${missingNames(m.missing)}`
                        : `${m.have}/${m.needed} malzeme sende`
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  group: { gap: spacing.sm, marginTop: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    rowGap: spacing.xl,
  },
});
