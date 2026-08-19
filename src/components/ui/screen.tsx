import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, shadow, spacing } from '@/theme/tokens';

import { ProgressLine } from './progress-line';

export interface ScreenProps {
  /** 0–1. Verilirse ekranın en tepesine saç teli ilerleme çizgisi çizilir. */
  progress?: number;
  children: React.ReactNode;
  scroll?: boolean;
  /** Ekranın altına sabitlenen birincil eylem. */
  footer?: React.ReactNode;
  /** İçeriğin kendi yatay boşluğunu yöneteceği durumlar (tam genişlik şeritler). */
  bleed?: boolean;
}

/**
 * Ekran kabuğu.
 *
 * Büyük sayfa başlığı yok — içerik doğrudan başlıyor. Bağlam, içeriğin
 * kendi içindeki bölüm etiketleriyle veriliyor; böylece her ekranda
 * bir ekranlık dikey alan geri kazanılıyor.
 */
export function Screen({ progress, children, scroll = true, footer, bleed = false }: ScreenProps) {
  const insets = useSafeAreaInsets();

  const content = [
    styles.content,
    bleed ? styles.contentBleed : null,
    { paddingTop: spacing.lg },
  ];

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top }} />
      {progress == null ? null : <ProgressLine value={progress} />}

      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[content, styles.flex]}>{children}</View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            shadow.sticky,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surface },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  contentBleed: { paddingHorizontal: 0 },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
});
