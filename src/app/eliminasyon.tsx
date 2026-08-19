import { useRouter } from 'expo-router';
import { Check, Info, Plus, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { INGREDIENTS } from '@/data/catalog';
import { ELIMINATIONS } from '@/data/catalog/eliminasyon';
import { RECIPES } from '@/data/recipes';
import { isAllowed } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { fontFamily, palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * Eliminasyon ayarları.
 *
 * Ekranın tonu bilinçli olarak iddiasız: burada hastalık adı geçmiyor,
 * "şunu iyileştirir" denmiyor. Yapılan iş bir süzgeç kurmak — neyin
 * eleneceğine kullanıcı ya da doktoru karar veriyor.
 *
 * Hazır şablonlar sadece hızlandırıcı; her birinin yanında kaç tarifin
 * kaldığı yazıyor, çünkü 30 tarif bırakan bir eliminasyon kullanılamaz ve
 * bunu kullanıcının seçmeden önce bilmesi gerekiyor.
 */

const SAND = '#fbf9f6';

export default function EliminationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const eliminations = useProfile((s) => s.eliminations);
  const toggleElimination = useProfile((s) => s.toggleElimination);
  const excludedSlugs = useProfile((s) => s.excludedSlugs);
  const toggleExcluded = useProfile((s) => s.toggleExcluded);
  const profileFilter = useProfileFilter();

  /** Şu anki ayarlarla kaç tarif kalıyor — seçim yaparken canlı güncelleniyor. */
  const remaining = useMemo(
    () => RECIPES.filter((r) => isAllowed(r, profileFilter)).length,
    [profileFilter],
  );

  /** Bir şablon açılsa kaç tarif kalırdı — seçmeden önce görünsün. */
  const previewFor = (id: string) => {
    const next = eliminations.includes(id)
      ? eliminations.filter((x) => x !== id)
      : [...eliminations, id];
    return RECIPES.filter((r) => isAllowed(r, { ...profileFilter, eliminations: next })).length;
  };

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return [];
    return INGREDIENTS.filter((i) => i.nameTr.toLocaleLowerCase('tr-TR').includes(q)).slice(0, 10);
  }, [query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <Text variant="display" style={styles.title}>
          Çıkarılan malzemeler
        </Text>
        <Text variant="body" tone="muted">
          Seçtiklerin uygulamanın her yerinde eleniyor: ana sayfa, keşfet,
          seçkiler, menü kurucu ve dolabındakilerle çıkan tarifler.
        </Text>

        {/* ── Tıbbi not ────────────────────────────────────────── */}
        <View style={styles.notice}>
          <Info size={16} color={palette.warning} />
          <Text variant="caption" tone="warning" style={{ flex: 1, lineHeight: 19 }}>
            Bu bir süzgeç, tedavi önerisi değil. Egzema gibi durumlarda
            eliminasyon diyeti, tanısı konmuş bir besin alerjisi yoksa rutin
            olarak önerilmiyor; gereksiz eliminasyon özellikle çocuklarda
            besin eksikliğine yol açabiliyor. Neyi keseceğine doktorun ya da
            diyetisyeninle karar ver.
          </Text>
        </View>

        <View style={styles.counter}>
          <Text variant="bodyStrong" tone="brandDeep" style={tabularNums}>
            {`${remaining} tarif`}
          </Text>
          <Text variant="caption" tone="muted">
            şu anki ayarlarınla açık
          </Text>
        </View>

        {/* ── Şablonlar ────────────────────────────────────────── */}
        <Text variant="label" tone="muted" style={styles.label}>
          HAZIR LİSTELER
        </Text>

        {ELIMINATIONS.map((e) => {
          const on = eliminations.includes(e.id);
          const kalan = previewFor(e.id);

          return (
            <Pressable
              key={e.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${e.labelTr}. ${e.summaryTr}`}
              onPress={() => toggleElimination(e.id)}
              style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}>
              <View style={styles.cardHead}>
                <View style={[styles.tick, on && styles.tickOn]}>
                  {on ? <Check size={13} color={palette.surface} strokeWidth={3} /> : null}
                </View>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {e.labelTr}
                </Text>
                <Text variant="caption" tone="muted" style={tabularNums}>
                  {on ? `${kalan} tarif` : `→ ${kalan} tarif`}
                </Text>
              </View>

              <Text variant="caption" tone="muted">
                {e.summaryTr}
              </Text>

              {e.noteTr ? (
                <Text variant="caption" tone="muted" style={styles.note}>
                  {e.noteTr}
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        {/* ── Kendi listen ─────────────────────────────────────── */}
        <Text variant="label" tone="muted" style={styles.label}>
          KENDİ LİSTEN
        </Text>
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          Doktorun ne dediyse onu ekle. Bu liste &quot;sevmediklerin&quot;den ayrı
          tutuluyor.
        </Text>

        {excludedSlugs.length ? (
          <View style={styles.chipWrap}>
            {excludedSlugs.map((slug) => {
              const ing = INGREDIENTS.find((i) => i.slug === slug);
              if (!ing) return null;
              return (
                <Pressable
                  key={slug}
                  accessibilityRole="button"
                  accessibilityLabel={`${ing.nameTr} listeden çıkar`}
                  onPress={() => toggleExcluded(slug)}
                  style={styles.chipOn}>
                  <IngredientAvatar ingredient={ing} size={22} />
                  <Text variant="label" tone="inverse">
                    {ing.nameTr}
                  </Text>
                  <X size={14} color="#fff" />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.search}>
          <Search size={18} color={palette.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Malzeme ara"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Çıkarılacak malzemeyi ara"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {results.map((ing) => {
          const on = excludedSlugs.includes(ing.slug);
          return (
            <Pressable
              key={ing.slug}
              accessibilityRole="button"
              accessibilityLabel={ing.nameTr}
              accessibilityState={{ selected: on }}
              onPress={() => toggleExcluded(ing.slug)}
              style={styles.searchRow}>
              <IngredientAvatar ingredient={ing} size={30} />
              <Text variant="body" style={{ flex: 1 }}>
                {ing.nameTr}
              </Text>
              {on ? <X size={18} color={palette.brand} /> : <Plus size={18} color={palette.inkMuted} />}
            </Pressable>
          );
        })}

        {remaining < 150 ? (
          <View style={[styles.notice, { marginTop: spacing.xl }]}>
            <Info size={16} color={palette.warning} />
            <Text variant="caption" tone="warning" style={{ flex: 1, lineHeight: 19 }}>
              {`Elinde ${remaining} tarif kaldı. Bu kadar dar bir listeyle uygulamanın önerileri işe yaramaz hâle gelir; bir şablonu kapatmayı düşünebilirsin.`}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Button label="Bitti" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '800', color: '#111', marginBottom: spacing.xs },
  label: { marginTop: spacing['2xl'], marginBottom: spacing.sm },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.warningSoft,
  },

  counter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
    marginBottom: spacing.sm,
  },
  cardOn: { borderColor: palette.brand, borderWidth: 2, backgroundColor: palette.brandSoft },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: palette.brand, borderColor: palette.brand },
  note: { marginTop: 4, lineHeight: 18, fontStyle: 'italic' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chipOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.brand,
    borderRadius: radius.pill,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 6,
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: palette.ink, paddingVertical: 0 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  pressed: { opacity: 0.85 },
});
