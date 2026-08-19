import { useRouter } from 'expo-router';
import { Check, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { INGREDIENTS } from '@/data/catalog';
import { CATEGORY_EMOJI } from '@/data/catalog/gorseller';
import type { Ingredient, IngredientCategory } from '@/engine';
import { CATEGORY_LABELS_TR, INGREDIENT_CATEGORIES } from '@/engine';
import { useTabReset } from '@/lib/use-tab-reset';
import { fontFamily, MIN_TOUCH, palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * "Elimde ne var?"
 *
 * Kategoriler üstte yatay bir şerit; sadece açık olan kategorinin içeriği
 * görünüyor. 192 malzemenin hepsini alt alta dökmek yerine tek seferde
 * bir kategori — kaydırma mesafesi kısa, seçim yükü düşük.
 *
 * Aramayı bilen kullanıcı için üstte arama kutusu var; arama açıkken şerit
 * gizleniyor ve sonuç tüm katalogdan geliyor. Dokunarak gezmek isteyen için
 * şerit, yazmayı bilen için arama — ikisi birbirinin yerini almıyor.
 */
export default function PantryScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const groups = useMemo(() => {
    const byCategory = new Map<IngredientCategory, Ingredient[]>();
    for (const i of INGREDIENTS) {
      const list = byCategory.get(i.category);
      if (list) list.push(i);
      else byCategory.set(i.category, [i]);
    }
    // Sabit kategori sırası — şerit her açılışta aynı görünsün.
    return INGREDIENT_CATEGORIES.flatMap((c) => {
      const items = byCategory.get(c);
      if (!items?.length) return [];
      // Kilerde sık bulunanlar önce.
      const sorted = [...items].sort((a, b) => Number(b.isStaple) - Number(a.isStaple));
      return [{ category: c, items: sorted }];
    });
  }, []);

  const [activeCategory, setActiveCategory] = useState<IngredientCategory>(groups[0].category);
  const [query, setQuery] = useState('');

  const active = groups.find((g) => g.category === activeCategory) ?? groups[0];

  // Sekmeye basınca kiler temiz sayfa olsun: seçim, arama ve kategori sıfırlanır.
  useTabReset(() => {
    setSelected(new Set());
    setQuery('');
    setActiveCategory(groups[0].category);
  });

  /**
   * Arama açıkken kategori şeridi devre dışı: kullanıcı ne aradıysa tüm
   * katalogda o çıkıyor. Türkçe küçültme şart — "İSOT" ile "isot" eşleşsin.
   */
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return null;
    return INGREDIENTS.filter(
      (i) =>
        i.nameTr.toLocaleLowerCase('tr-TR').includes(q) ||
        (i.nameEn?.toLowerCase().includes(q) ?? false),
    ).slice(0, 60);
  }, [query]);

  const shown = results ?? active.items;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const count = selected.size;

  /** Kategori şeridinde o kategoriden kaç şey seçildiğini göster. */
  const selectedIn = (items: Ingredient[]) => items.filter((i) => selected.has(i.id)).length;

  return (
    <Screen
      bleed
      footer={
        <Button
          label={count === 0 ? 'Önce malzeme seç' : `${count} malzemeyle ne yapabilirim?`}
          disabled={count === 0}
          onPress={() => {
            const slugs = INGREDIENTS.filter((i) => selected.has(i.id))
              .map((i) => i.slug)
              .join(',');
            router.push({ pathname: '/dolap-sonuc', params: { slugs } });
          }}
        />
      }>
      {/* ── Arama ───────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Search size={18} color={palette.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Malzeme ara"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Malzeme ara"
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aramayı temizle"
              hitSlop={12}
              onPress={() => setQuery('')}>
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Kategori şeridi (arama açıkken gizli) ────────────────── */}
      {results ? null : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}>
        {groups.map((g) => {
          const on = g.category === activeCategory;
          const picked = selectedIn(g.items);
          return (
            <Pressable
              key={g.category}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${CATEGORY_LABELS_TR[g.category]}${picked ? `, ${picked} seçili` : ''}`}
              onPress={() => setActiveCategory(g.category)}
              style={({ pressed }) => [
                styles.stripItem,
                on && styles.stripItemOn,
                pressed && styles.pressed,
              ]}>
              <RNText allowFontScaling={false} style={styles.stripEmoji}>
                {CATEGORY_EMOJI[g.category]}
              </RNText>
              <Text variant="label" tone={on ? 'inverse' : 'default'} numberOfLines={1}>
                {CATEGORY_LABELS_TR[g.category]}
              </Text>
              {picked ? (
                <View style={[styles.count, on && styles.countOn]}>
                  <Text
                    variant="eyebrow"
                    tone={on ? 'brandDeep' : 'inverse'}
                    style={tabularNums}>
                    {String(picked)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      )}

      {/* ── Açık kategorinin ya da arama sonucunun içeriği ───────── */}
      <View style={styles.body}>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 24, lineHeight: 28, marginBottom: 8 }}>
          {results
            ? `"${query.trim()}"`
            : `${CATEGORY_LABELS_TR[active.category]}`}
        </Text>

        {results?.length === 0 ? (
          <Text variant="caption" tone="muted">
            Bulunamadı. Kategorilerden seçmeyi deneyebilirsin.
          </Text>
        ) : null}

        <View style={styles.grid}>
          {shown.map((ing) => {
            const isOn = selected.has(ing.id);
            return (
              <Pressable
                key={ing.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={ing.nameTr}
                onPress={() => toggle(ing.id)}
                style={({ pressed }) => [
                  styles.chip,
                  isOn && styles.chipOn,
                  pressed && styles.pressed,
                ]}>
                <IngredientAvatar ingredient={ing} size={30} />
                <Text variant="bodyStrong" tone={isOn ? 'brandDeep' : 'default'} numberOfLines={1}>
                  {ing.nameTr}
                </Text>
                {isOn ? (
                  <View style={styles.tick}>
                    <Check size={13} color={palette.surface} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: palette.ink,
    // Android'de TextInput'un kendi dikey boşluğu satırı kaydırıyor.
    paddingVertical: 0,
  },
  strip: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: spacing.xs },
  stripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  stripItemOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  stripEmoji: { fontSize: 16, lineHeight: 20 },
  count: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
  countOn: { backgroundColor: palette.surface },
  body: { paddingHorizontal: spacing.xl, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipOn: { borderColor: palette.brand, borderWidth: 2, backgroundColor: palette.brandSoft },
  pressed: { opacity: 0.85 },
  tick: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
});
