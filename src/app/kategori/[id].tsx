import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RecipeTile } from '@/components/recipe-tile';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  CATEGORY_BY_ID,
  CUISINE_LABELS_TR,
  recipesByCategory,
  type CuisineId,
} from '@/data/recipes';
import { applyProfile } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { palette, radius, spacing } from '@/theme/tokens';

/**
 * Bir kategorinin tarif listesi.
 *
 * Mutfak filtresi ikincil bir şerit: kategori yemek tipine göre, mutfak ise
 * coğrafyaya göre. "Çorbalar"a bakan biri hem mercimek hem miso çorbasını
 * görüyor, isterse mutfağa göre daraltıyor.
 */
export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const category = CATEGORY_BY_ID.get(id ?? '');
  const profileFilter = useProfileFilter();

  // Liste profile göre süzülüyor: diyetine uymayan tarif kategoride de görünmesin.
  const all = useMemo(
    () => applyProfile(recipesByCategory(id ?? ''), profileFilter),
    [id, profileFilter],
  );

  const [cuisine, setCuisine] = useState<CuisineId | null>(null);

  const cuisines = useMemo(() => {
    const counts = new Map<CuisineId, number>();
    for (const r of all) counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const shown = cuisine ? all.filter((r) => r.cuisine === cuisine) : all;

  if (!category) {
    return (
      <Screen footer={<Button label="Geri" variant="quiet" onPress={() => router.back()} />}>
        <Text variant="bodyStrong">Kategori bulunamadı.</Text>
      </Screen>
    );
  }

  return (
    <Screen bleed footer={<Button label="Geri" variant="quiet" onPress={() => router.back()} />}>
      <View style={styles.head}>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 32, lineHeight: 36, marginBottom: 8 }}>
          {category.labelTr}
        </Text>
      </View>

      {cuisines.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}>
          <FilterChip
            label={`Hepsi (${all.length})`}
            active={cuisine === null}
            onPress={() => setCuisine(null)}
          />
          {cuisines.map(([c, n]) => (
            <FilterChip
              key={c}
              label={`${CUISINE_LABELS_TR[c]} (${n})`}
              active={cuisine === c}
              onPress={() => setCuisine(c)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.list}>
        {shown.map((r) => (
          <View key={r.slug} style={{ width: '48%' }}>
            <RecipeTile recipe={r} fluid />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && styles.pressed]}>
      <Text variant="label" tone={active ? 'inverse' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing.xl, gap: spacing.xs },
  strip: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  pressed: { opacity: 0.85 },
  list: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    rowGap: spacing.xl,
  },
});
