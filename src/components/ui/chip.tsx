import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Ingredient } from '@/engine';
import { palette, radius, spacing } from '@/theme/tokens';

import { IngredientAvatar } from './ingredient-avatar';
import { Text } from './text';

export interface ChipProps {
  label: string;
  /** Sağ tarafta küçük gri ek bilgi — "20 g", "aromatik". */
  meta?: string;
  /** Verilirse solda küçük görsel çıkar. */
  ingredient?: Ingredient;
  selected?: boolean;
  onPress?: () => void;
  /** Verilirse çarpı görünür ve dokunma alanı ayrı olur. */
  onRemove?: () => void;
}

export function Chip({ label, meta, ingredient, selected, onPress, onRemove }: ChipProps) {
  return (
    <View style={[styles.chip, selected && styles.chipOn, ingredient && styles.chipWithAvatar]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        disabled={!onPress}
        style={styles.body}>
        {ingredient ? <IngredientAvatar ingredient={ingredient} size={24} /> : null}
        <Text variant="label" tone={selected ? 'brandDeep' : 'default'}>
          {label}
        </Text>
        {meta ? (
          <Text variant="caption" tone="muted">
            {meta}
          </Text>
        ) : null}
      </Pressable>

      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} malzemesini çıkar`}
          onPress={onRemove}
          hitSlop={12}
          style={styles.remove}>
          <X size={15} color={palette.inkMuted} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    minHeight: 40,
  },
  chipWithAvatar: { paddingLeft: spacing.xs },
  chipOn: { borderColor: palette.brandSoftBorder, backgroundColor: palette.brandSoft },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  remove: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
});
