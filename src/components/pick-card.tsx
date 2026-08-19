import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Suggestion } from '@/engine';
import { explainLink, explainReason, LINK_LABEL } from '@/lib/explain';
import { palette, radius, spacing, tabularNums } from '@/theme/tokens';

import { IngredientAvatar } from './ui/ingredient-avatar';
import { Text } from './ui/text';

export interface PickCardProps {
  suggestion: Suggestion;
  selected?: boolean;
  onPress?: () => void;
  /** Doz ve gerekçe satırları — liste ekranında kapatılıp özet ekranda açılır. */
  detailed?: boolean;
}

/**
 * Zincirdeki bir aday.
 *
 * Kartın gövdesi malzeme adı; altındaki satır **neden burada olduğu**.
 * Bağ etiketi (KİMYA / GELENEK / DENGE) kullanıcıya hangi gerekçeyle
 * önerildiğini tek bakışta söylüyor — bağsız aday buraya hiç gelmiyor.
 */
export function PickCard({ suggestion, selected, onPress, detailed = false }: PickCardProps) {
  const { ingredient, links, suggestedGrams, reasons } = suggestion;
  const primary = links[0];
  const extraLinks = detailed ? links.slice(1, 3) : [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${ingredient.nameTr}. ${primary ? explainLink(primary) : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardOn,
        pressed && styles.pressed,
      ]}>
      <View style={styles.head}>
        <IngredientAvatar ingredient={ingredient} size={40} />

        <View style={styles.title}>
          <Text variant="h3" tone={selected ? 'brandDeep' : 'default'}>
            {ingredient.nameTr}
          </Text>
          {suggestion.linkedTo.total > 1 ? (
            <Text
              variant="eyebrow"
              tone={suggestion.coherence >= 0.5 ? 'brandDeep' : 'muted'}>
              {`TABAKTAKİ ${suggestion.linkedTo.total} MALZEMENİN ${suggestion.linkedTo.linked}'İYLE BAĞLI`}
            </Text>
          ) : primary?.isAnchor ? (
            <Text variant="eyebrow" tone="brandDeep">
              ZİNCİRE BAĞLI
            </Text>
          ) : null}
        </View>

        {selected ? (
          <View style={styles.check}>
            <Check size={16} color={palette.surface} strokeWidth={3} />
          </View>
        ) : (
          <Text variant="caption" tone="muted" style={tabularNums}>
            ~{suggestedGrams} g
          </Text>
        )}
      </View>

      {primary ? (
        <View style={styles.linkRow}>
          <View style={styles.badge}>
            <Text variant="eyebrow" tone="brandDeep">
              {LINK_LABEL[primary.kind]}
            </Text>
          </View>
          <Text variant="caption" tone="muted" style={styles.linkText}>
            {explainLink(primary)}
          </Text>
        </View>
      ) : null}

      {extraLinks.map((link, i) => (
        <View key={i} style={styles.linkRow}>
          <View style={styles.badgeQuiet}>
            <Text variant="eyebrow" tone="muted">
              {LINK_LABEL[link.kind]}
            </Text>
          </View>
          <Text variant="caption" tone="muted" style={styles.linkText}>
            {explainLink(link)}
          </Text>
        </View>
      ))}

      {detailed
        ? reasons
            .filter((r) => r.kind === 'denge' || r.kind === 'uyari-fazla')
            .slice(0, 2)
            .map((r, i) => (
              <Text
                key={i}
                variant="caption"
                tone={r.kind === 'uyari-fazla' ? 'warning' : 'muted'}
                style={styles.reason}>
                {explainReason(r)}
              </Text>
            ))
        : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 76,
    justifyContent: 'center',
  },
  cardOn: { borderColor: palette.brand, backgroundColor: palette.brandSoft, borderWidth: 2 },
  pressed: { backgroundColor: palette.surfaceAlt },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1, gap: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
  },
  badgeQuiet: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  linkText: { flex: 1 },
  reason: { marginLeft: 2 },
});
