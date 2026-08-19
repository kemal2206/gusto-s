import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View, Image } from 'react-native';

import { palette, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

export interface OptionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  selected?: boolean;
  onPress?: () => void;
  /** "01", "02" — editöryel sıra numarası. */
  index?: string;
  /** Sağda küçük bilgi rozeti. */
  badge?: string;
}

/**
 * Sihirbaz adımlarının ve ana sayfa girişlerinin tek yapı taşı.
 *
 * Gölge yok, saç teli çizgi var. Seçili durum ÜÇ sinyalle belli oluyor:
 * çerçeve kalınlığı, zemin rengi ve ✓ ikonu — renk körlüğünde ve düşük
 * parlaklıkta da ayırt edilebilsin.
 */
export function OptionCard({
  title,
  description,
  icon,
  imageUrl,
  selected = false,
  onPress,
  index,
  badge,
}: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}>
      {imageUrl ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: radius.md }} />
        </View>
      ) : icon ? (
        <View style={styles.iconWrap}>{icon}</View>
      ) : null}
      {!icon && !imageUrl && index ? (
        <Text variant="label" tone="brand" style={styles.index}>
          {index}
        </Text>
      ) : null}

      <View style={styles.body}>
        <Text variant="h2" tone={selected ? 'brandDeep' : 'default'} style={{ fontSize: 20, fontFamily: 'ZalandoSans_SemiExpanded_Medium' }}>
          {title}
        </Text>
      </View>

      {badge ? (
        <View style={styles.badge}>
          <Text variant="eyebrow" tone="brandDeep">
            {badge.toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.check}>
          <Check size={16} color={palette.surface} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 100,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardSelected: {
    borderColor: palette.brand,
    borderWidth: 2,
    backgroundColor: palette.brandSoft,
  },
  pressed: { backgroundColor: palette.surfaceAlt },
  imageWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
  },
  index: { width: 20 },
  body: { flex: 1, gap: 3 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
});
