import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChefHat, Clock, Trash2, Users } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { CATEGORY_BY_ID } from '@/data/recipes';
import { useCookbook } from '@/lib/store/cookbook';
import { palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * Kullanıcının kendi tarifi.
 *
 * Uygulama tarifi sayfasının sade karşılığı: besin değeri ve gereç listesi
 * yok, çünkü kullanıcının yazdığı satırların hepsi katalogla eşleşmiyor ve
 * yarım veriden hesap uydurmak yanlış olur. Eşleşen malzemeler simgeleriyle,
 * eşleşmeyenler yazıldığı gibi görünüyor.
 */

const SAND = '#fbf9f6';

export default function OwnRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const item = useCookbook((s) => s.items.find((i) => i.id === id));
  const markCooked = useCookbook((s) => s.markCooked);
  const remove = useCookbook((s) => s.remove);

  if (!item || item.kind !== 'kendi') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingHorizontal: spacing.xl }]}>
        <Text variant="h2" tone="brandDeep">
          Tarif bulunamadı
        </Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Geri dön" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const category = item.categoryId ? CATEGORY_BY_ID.get(item.categoryId) : undefined;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 40,
        }}>
        <Text variant="label" tone="brand">
          {category ? `${category.emoji}  ${category.labelTr.toLocaleUpperCase('tr-TR')}` : 'SENİN TARİFİN'}
        </Text>

        <Text variant="display" style={styles.title}>
          {item.title}
        </Text>

        {item.summary ? (
          <Text variant="body" tone="muted" style={{ marginTop: spacing.sm }}>
            {item.summary}
          </Text>
        ) : null}

        <View style={styles.facts}>
          {item.minutes ? (
            <Fact icon={<Clock size={16} color={palette.inkMuted} />} value={`${item.minutes} dk`} />
          ) : null}
          {item.servings ? (
            <Fact icon={<Users size={16} color={palette.inkMuted} />} value={`${item.servings} kişilik`} />
          ) : null}
          {item.cookCount ? (
            <Fact icon={<ChefHat size={16} color={palette.inkMuted} />} value={`${item.cookCount} kez yaptın`} />
          ) : null}
        </View>

        <Text variant="h3" tone="brandDeep" style={styles.malzemelerTitle}>
          Malzemeler
        </Text>
        {item.ingredients.map((ing, i) => {
          const known = ing.slug ? BY_SLUG.get(ing.slug) : undefined;
          return (
            <View key={`${ing.raw}-${i}`} style={styles.row}>
              {known ? (
                <IngredientAvatar ingredient={known} size={36} />
              ) : (
                <View style={styles.rawDot} />
              )}
              <Text variant="body" style={{ flex: 1 }}>
                {ing.raw}
              </Text>
            </View>
          );
        })}

        <Text variant="h3" tone="brandDeep" style={{ marginTop: spacing['3xl'] }}>
          Yapılışı
        </Text>
        {item.steps.map((s, i) => (
          <View key={`${s}-${i}`} style={styles.step}>
            <View style={styles.stepDot}>
              <Text variant="label" tone="inverse" style={tabularNums}>
                {String(i + 1)}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {s}
            </Text>
          </View>
        ))}

        <View style={{ marginTop: spacing['3xl'], gap: spacing.sm }}>
          <Button
            label={item.cookedAt ? 'Bir kez daha pişirdim' : 'Bunu pişirdim'}
            variant="secondary"
            onPress={() => markCooked(item.id)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tarifi kitaptan sil"
            onPress={() => {
              remove(item.id);
              router.back();
            }}
            style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}>
            <Trash2 size={16} color={palette.inkMuted} />
            <Text variant="label" tone="muted">
              Kitaptan sil
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Fact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View style={styles.fact}>
      {icon}
      <Text variant="bodyStrong" style={tabularNums}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  title: { fontSize: 38, lineHeight: 44, fontFamily: 'ShadowsIntoLight_400Regular', color: '#111', marginTop: spacing.sm },
  malzemelerTitle: { fontFamily: 'ShadowsIntoLight_400Regular', fontSize: 28, marginTop: spacing['3xl'] },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.lg },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  rawDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
  },
  step: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, alignItems: 'flex-start' },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
    marginTop: 2,
  },

  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
});
