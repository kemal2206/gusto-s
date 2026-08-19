import { StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/theme/tokens';

import { Text } from './text';

export interface EyebrowProps {
  /** Daima büyük harfe çevrilir. */
  children: string;
  /** "01", "02" — bölüm numarası. Editöryel düzenin omurgası. */
  index?: string;
  tone?: 'muted' | 'brand';
}

/**
 * Bölüm üstü küçük etiket. Numarayla birlikte kullanıldığında kullanıcı
 * kaçıncı adımda olduğunu başlığa bakmadan görüyor.
 */
export function Eyebrow({ children, index, tone = 'muted' }: EyebrowProps) {
  return (
    <View style={styles.row}>
      {index ? (
        <>
          <Text variant="eyebrow" tone="brand">
            {index}
          </Text>
          <View style={styles.tick} />
        </>
      ) : null}
      <Text variant="eyebrow" tone={tone === 'brand' ? 'brandDeep' : 'muted'}>
        {children.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tick: { width: 14, height: 1, backgroundColor: palette.borderStrong },
});
