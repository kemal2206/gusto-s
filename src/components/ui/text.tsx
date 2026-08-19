import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { MAX_FONT_SCALE, palette, type as typeScale, type TypeVariant } from '@/theme/tokens';

export type TextTone =
  | 'default'
  | 'muted'
  | 'brand'
  | 'brandDeep'
  | 'inverse'
  | 'success'
  | 'warning';

const TONE_COLOR: Record<TextTone, string> = {
  default: palette.ink,
  muted: palette.inkMuted,
  brand: palette.brand,
  brandDeep: palette.brandDeep,
  inverse: palette.surface,
  success: palette.success,
  warning: palette.warning,
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  center?: boolean;
}

/**
 * Uygulamadaki tek metin bileşeni. Doğrudan RN `Text` kullanılmaz —
 * yoksa Inter yüklenmemiş, kontrastı düşük veya sistem yazı ölçeğinde
 * kırılan metinler ortaya çıkıyor.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  center,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={StyleSheet.flatten([
        typeScale[variant],
        { color: TONE_COLOR[tone] },
        center && styles.center,
        style,
      ])}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
