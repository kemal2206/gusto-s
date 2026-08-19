import { useRouter } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { BY_SLUG } from '@/data/catalog';
import { CATEGORY_BY_ID, CUISINE_LABELS_TR, type Recipe } from '@/data/recipes';
import { palette, radius, spacing, tabularNums } from '@/theme/tokens';

import { IngredientAvatar } from './ui/ingredient-avatar';
import { Text } from './ui/text';

export interface RecipeCardProps {
  recipe: Recipe;
  /** "2 malzeme eksik" gibi ek bilgi — kiler eşleştirmesinde kullanılıyor. */
  note?: string;
  noteTone?: 'success' | 'warning' | 'muted';
}

/**
 * Tarif listesi satırı.
 *
 * Soldaki görsel tarifin ilk ana malzemesinden geliyor; yemek fotoğrafı
 * yok (aşama 3'te `Recipe.imageUrl` ile gelecek) ama malzeme simgesi bile
 * listeyi taranabilir yapıyor.
 */
export function RecipeCard({ recipe, note, noteTone = 'muted' }: RecipeCardProps) {
  const router = useRouter();
  const category = CATEGORY_BY_ID.get(recipe.categoryId);

  // Ana bileşenin ilk malzemesi tarifi en iyi temsil eden şey.
  const lead = recipe.components[0]?.ingredients[0]?.slug;
  const leadIngredient = lead ? BY_SLUG.get(lead) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${recipe.totalMinutes} dakika`}
      onPress={() => router.push({ pathname: '/tarif/[slug]', params: { slug: recipe.slug } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {leadIngredient ? (
        <IngredientAvatar ingredient={leadIngredient} size={44} />
      ) : (
        <RNText allowFontScaling={false} style={styles.emoji}>
          {category?.emoji ?? '🍽️'}
        </RNText>
      )}

      <View style={styles.body}>
        <Text variant="h3" numberOfLines={1}>
          {recipe.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {recipe.summary}
        </Text>

        <View style={styles.metaRow}>
          <Clock size={13} color={palette.inkMuted} />
          <Text variant="caption" tone="muted" style={tabularNums}>
            {recipe.totalMinutes} dk
          </Text>
          <View style={styles.dot} />
          <Text variant="caption" tone="muted">
            {CUISINE_LABELS_TR[recipe.cuisine]}
          </Text>
          {recipe.components.length > 1 ? (
            <>
              <View style={styles.dot} />
              <Text variant="caption" tone="muted">
                {recipe.components.length} bileşen
              </Text>
            </>
          ) : null}
        </View>

        {note ? (
          <Text variant="label" tone={noteTone === 'muted' ? 'muted' : noteTone}>
            {note}
          </Text>
        ) : null}
      </View>

      <ChevronRight size={18} color={palette.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 76,
  },
  pressed: { backgroundColor: palette.surfaceAlt },
  emoji: { fontSize: 26, lineHeight: 32, width: 44, textAlign: 'center' },
  body: { flex: 1, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: palette.borderStrong },
});
