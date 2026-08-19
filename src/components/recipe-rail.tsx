import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Recipe } from '@/data/recipes';
import { palette, spacing } from '@/theme/tokens';

import { RecipeTile } from './recipe-tile';
import { Text } from './ui/text';

export interface RecipeRailProps {
  title: string;
  /** Başlığın altındaki tek satır. */
  hint?: string;
  recipes: Recipe[];
  /** Verilirse başlık dokunulabilir olur ve "›" çıkar. */
  onSeeAll?: () => void;
  inverse?: boolean;
}

/**
 * Yatay kaydırmalı tarif rayı — ana sayfanın omurgası.
 *
 * Başlık dokunulabilir ve tümünü göstermeye gidiyor; referans tasarımdaki
 * "Most popular recipes ›" davranışı. Ray ekranın kenarına kadar uzanıyor
 * (`bleed`), böylece kaydırılabilir olduğu görsel olarak belli oluyor.
 */
export function RecipeRail({ title, hint, recipes, onSeeAll, inverse }: RecipeRailProps) {
  if (!recipes.length) return null;

  const textColor = inverse ? 'rgba(255,255,255,0.9)' : undefined;
  const hintColor = inverse ? 'rgba(255,255,255,0.7)' : undefined;

  const header = (
    <View style={styles.head}>
      <View style={styles.titleRow}>
        <Text variant="h2" tone={inverse ? 'inverse' : 'brandDeep'} style={{ flex: 1, fontFamily: 'ZalandoSans_SemiExpanded_Bold', fontSize: 22 }}>
          {title}
        </Text>
        {onSeeAll ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: inverse ? '#fff' : palette.brand, marginRight: 2 }}>Tümünü Gör</Text>
            <ChevronRight size={18} color={inverse ? '#fff' : palette.brand} />
          </View>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone={inverse ? 'inverse' : 'muted'} style={inverse ? { color: hintColor } : undefined}>
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, tümünü gör`}
          onPress={onSeeAll}
          style={({ pressed }) => [styles.headPress, pressed && styles.pressed]}>
          {header}
        </Pressable>
      ) : (
        <View style={styles.headPress}>{header}</View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {recipes.map((r) => (
          <RecipeTile key={r.slug} recipe={r} inverse={inverse} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  headPress: { paddingHorizontal: spacing.xl },
  head: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pressed: { opacity: 0.6 },
  rail: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.xs },
});
