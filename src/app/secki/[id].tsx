import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { RecipeTile } from '@/components/recipe-tile';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RECIPES } from '@/data/recipes';
import { COLLECTION_BY_ID } from '@/lib/koleksiyon';
import { applyProfile } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { spacing, tabularNums } from '@/theme/tokens';

/**
 * Bir özel seçkinin tarif listesi.
 *
 * Kasten soru yok: "15 dakikadan az" diyen kişiye önce dört soru sormak,
 * seçkinin bütün anlamını ortadan kaldırıyor. Başlık ne diyorsa liste o.
 *
 * Profil süzgeci yine geçerli — diyet kısıtı ve sevmediği malzeme her yerde
 * olduğu gibi burada da uygulanıyor.
 */
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const collection = COLLECTION_BY_ID.get(id ?? '');

  const profileFilter = useProfileFilter();

  const list = useMemo(() => {
    if (!collection) return [];
    return applyProfile(
      RECIPES.filter((r) => collection.match(r)),
      profileFilter,
    );
  }, [collection, profileFilter]);

  if (!collection) {
    return (
      <Screen>
        <Text variant="h2" tone="brandDeep">
          Seçki bulunamadı
        </Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Geri dön" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Geri" variant="quiet" onPress={() => router.back()} />}>
      <View style={styles.head}>
        <RNText allowFontScaling={false} style={styles.emoji}>
          {collection.emoji}
        </RNText>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 30, lineHeight: 34 }}>
          {collection.labelTr}
        </Text>
        <Text variant="body" tone="muted">
          {collection.hintTr}
        </Text>
        <Text variant="caption" tone="muted" style={tabularNums}>
          {`${list.length} tarif`}
        </Text>
      </View>

      <View style={styles.grid}>
        {list.slice(0, 60).map((r) => (
          <View key={r.slug} style={{ width: '48%' }}>
            <RecipeTile recipe={r} fluid />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4, marginBottom: spacing.lg },
  emoji: { fontSize: 34, lineHeight: 42 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    rowGap: spacing.xl,
  },
});
