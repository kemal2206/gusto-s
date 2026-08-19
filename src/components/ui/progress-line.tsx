import { StyleSheet, View } from 'react-native';

import { palette } from '@/theme/tokens';

/**
 * Ekranın en üstüne yapışan saç teli ilerleme çizgisi.
 * Yer kaplamıyor ama kullanıcı nerede olduğunu sürekli görüyor.
 */
export function ProgressLine({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, backgroundColor: palette.border },
  fill: { height: 3, backgroundColor: palette.brand },
});
