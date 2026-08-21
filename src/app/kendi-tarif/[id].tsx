import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChefHat, Clock, Plus, ShoppingBasket, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { CATEGORY_BY_ID } from '@/data/recipes';
import { consolidate, textKey, type BasketLine } from '@/lib/sepet';
import { useCookbook } from '@/lib/store/cookbook';
import type { OwnIngredient } from '@/lib/cookbook/types';
import { useGrocery } from '@/lib/store/grocery';
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

  const basket = useGrocery((s) => s.items);
  const addGrocery = useGrocery((s) => s.addMany);
  const toggleGrocery = useGrocery((s) => s.toggleOne);
  const removeFromBasket = useGrocery((s) => s.removeRecipe);
  const [basketCleared, setBasketCleared] = useState(false);

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

  /**
   * Kendi tarifinin satırları sepete böyle çevriliyor.
   *
   * Katalogla eşleşen satır slug'ıyla gidiyor — böylece uygulamanın
   * tarifinden gelen soğanla sepette aynı satırda birleşiyor. Eşleşmeyen
   * satır **yazıldığı hâliyle** gidiyor: "annemin turşusundan bir kavanoz"
   * katalogda yok ama alışverişte lazım; sessizce atmak kullanıcının kendi
   * listesini budamak olurdu. Miktarı çözülememişse gram 0 kalıyor ve
   * sepette miktar satırı hiç yazılmıyor.
   */
  const lineFor = (ing: OwnIngredient): BasketLine =>
    ing.slug
      ? { slug: ing.slug, grams: ing.grams ?? 0 }
      : { slug: textKey(ing.raw), grams: 0, label: ing.raw };

  const lines = consolidate(item.ingredients.map(lineFor));
  const totalOf = new Map(lines.map((l) => [l.slug, l]));
  const inBasket = new Set(
    basket.filter((b) => b.sources.some((s) => s.recipe === item.title)).map((b) => b.slug),
  );
  const missing = lines.filter((l) => !inBasket.has(l.slug));

  const onAddAll = () => {
    if (missing.length === 0) {
      router.push('/sepet');
      return;
    }
    addGrocery(item.title, missing);
  };

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
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          Malzemeye dokun, sepete girsin.
        </Text>

        {item.ingredients.map((ing, i) => {
          const known = ing.slug ? BY_SLUG.get(ing.slug) : undefined;
          const line = totalOf.get(ing.slug ?? textKey(ing.raw)) ?? lineFor(ing);
          const added = inBasket.has(line.slug);
          return (
            <Pressable
              key={`${ing.raw}-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: added }}
              accessibilityLabel={
                added
                  ? `${ing.raw} sepette. Çıkarmak için dokun.`
                  : `${ing.raw}. Sepete eklemek için dokun.`
              }
              onPress={() => toggleGrocery(item.title, line)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              {known ? (
                <IngredientAvatar ingredient={known} size={36} />
              ) : (
                <View style={styles.rawDot} />
              )}
              <Text variant="body" style={{ flex: 1 }}>
                {ing.raw}
              </Text>
              <View style={[styles.rowBasket, added && styles.rowBasketOn]}>
                {added ? (
                  <Check size={16} color={palette.surface} />
                ) : (
                  <Plus size={16} color={palette.inkMuted} />
                )}
              </View>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={onAddAll}
          style={({ pressed }) => [styles.toBasket, pressed && { opacity: 0.85 }]}>
          {missing.length === 0 ? (
            <Check size={18} color={palette.brandDeep} />
          ) : (
            <ShoppingBasket size={18} color={palette.brandDeep} />
          )}
          <Text variant="button" tone="brandDeep">
            {missing.length === 0
              ? 'Hepsi sepette — sepeti aç'
              : missing.length === lines.length
                ? 'Tümünü sepete ekle'
                : `Kalan ${missing.length} malzemeyi ekle`}
          </Text>
        </Pressable>

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
            onPress={() => {
              markCooked(item.id);
              // Pişirdiysen almışsındır: yalnızca bu tarifin sepetteki payı düşüyor.
              setBasketCleared(inBasket.size > 0);
              removeFromBasket(item.title);
            }}
          />
          {basketCleared ? (
            <Text variant="caption" tone="muted" center>
              Bu tarifin malzemeleri sepetten düşüldü.
            </Text>
          ) : null}
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
  /** Satırın sağ ucundaki ekle/çıkar işareti. */
  rowBasket: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBasketOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  toBasket: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: palette.surface,
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
