import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { MIN_TOUCH, palette, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Dış boşluk gibi düzen ayarları için. */
  style?: StyleProp<ViewStyle>;
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Yalnızca satır içi kullanımda false yap — varsayılan tam genişlik. */
  block?: boolean;
  icon?: React.ReactNode;
}

/**
 * Minimum yükseklik 56 — platform kılavuzu 44 diyor ama titreyen elle 44 yetmiyor.
 * Bir ekranda yalnızca bir tane `primary` olmalı.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  block = true,
  icon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        VARIANT_STYLE[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.surface : palette.brand} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text
            variant="button"
            tone={variant === 'primary' ? 'inverse' : 'brandDeep'}
            numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANT_STYLE = StyleSheet.create({
  primary: {
    backgroundColor: palette.brand,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.brand,
  },
  quiet: {
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
});

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { marginRight: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});
