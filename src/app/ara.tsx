import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { RecipeTile } from '@/components/recipe-tile';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { CUISINE_LABELS_TR, RECIPES, type CuisineId } from '@/data/recipes';
import { applyProfile } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { useSearchLog } from '@/lib/store/search-log';
import { fontFamily, MIN_TOUCH, palette, radius, spacing } from '@/theme/tokens';

/**
 * Tarif arama.
 *
 * Hem tarif adında hem malzeme adında arıyor: "patlıcan" yazınca patlıcan
 * geçen bütün tarifler geliyor, adında patlıcan olmayanlar dahil.
 */
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState<CuisineId | null>(null);

  const profileFilter = useProfileFilter();
  const record = useSearchLog((s) => s.record);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    let list = RECIPES;

    if (cuisine) list = list.filter((r) => r.cuisine === cuisine);

    if (q.length >= 2) {
      list = list.filter((r) => {
        if (r.title.toLocaleLowerCase('tr-TR').includes(q)) return true;
        if (r.summary.toLocaleLowerCase('tr-TR').includes(q)) return true;
        // Malzeme adında da ara — "nar ekşisi" yazan onu kullanan tarifleri bulsun.
        return r.allSlugs.some((s) =>
          BY_SLUG.get(s)?.nameTr.toLocaleLowerCase('tr-TR').includes(q),
        );
      });
    }

    const sorted = [...list].sort((a, b) => a.totalMinutes - b.totalMinutes);

    /**
     * Yazılan arama açık bir istektir: "köfte" arayan birine boş liste
     * dönmek yardımcı olmuyor. Bu yüzden arama yapılırken profil sert
     * filtre değil sıralama sinyali — uygun olanlar başa geliyor.
     * Arama kutusu boşken (gezinme hâli) sert filtre geçerli.
     */
    if (q.length < 2) return applyProfile(sorted, profileFilter);

    const fitting = new Set(applyProfile(sorted, profileFilter).map((r) => r.slug));
    return [...sorted.filter((r) => fitting.has(r.slug)), ...sorted.filter((r) => !fitting.has(r.slug))];
  }, [query, cuisine, profileFilter]);

  /**
   * Aramayı yazma bittikten sonra kaydediyoruz; her tuş vuruşunu saymak
   * "k", "kö", "köf" gibi anlamsız terimler biriktiriyordu.
   */
  useEffect(() => {
    if (query.trim().length < 3 || results.length === 0) return;
    const t = setTimeout(() => record(query), 1200);
    return () => clearTimeout(t);
  }, [query, results.length, record]);

  const cuisines: CuisineId[] = ['tr', 'levanten', 'yunan-balkan', 'iran-kafkas', 'uzakdogu'];

  return (
    <Screen bleed footer={<Button label="Geri" variant="quiet" onPress={() => router.back()} />}>
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Search size={18} color={palette.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tarif ya da malzeme ara"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Tarif ara"
            returnKeyType="search"
            autoCorrect={false}
            autoFocus
            style={styles.input}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}>
        <Chip label="Hepsi" active={cuisine === null} onPress={() => setCuisine(null)} />
        {cuisines.map((c) => (
          <Chip
            key={c}
            label={CUISINE_LABELS_TR[c]}
            active={cuisine === c}
            onPress={() => setCuisine(cuisine === c ? null : c)}
          />
        ))}
      </ScrollView>

      <View style={styles.list}>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 24, lineHeight: 28, marginBottom: 8, width: '100%' }}>{`${results.length} tarif`}</Text>
        {results.length === 0 ? (
          <Text variant="body" tone="muted" style={{ width: '100%' }}>
            Bulunamadı. Malzeme adıyla da arayabilirsin — "nar ekşisi", "patlıcan" gibi.
          </Text>
        ) : null}
        {results.map((r) => (
          <View key={r.slug} style={{ width: '48%' }}>
            <RecipeTile recipe={r} fluid />
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Chip({
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
  searchWrap: { paddingHorizontal: spacing.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: palette.ink,
    paddingVertical: 0,
  },
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
