import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AlertCircle, Check, ClipboardPaste, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { fetchVideoMeta, parseVideoUrl, PLATFORM_LABELS, type VideoMeta } from '@/lib/cookbook/video';
import { useCookbook } from '@/lib/store/cookbook';
import { fontFamily, palette, radius, spacing } from '@/theme/tokens';

/**
 * Sosyal medya tarif videosu ekleme.
 *
 * Kullanıcı bağlantıyı yapıştırıyor; platformu tanıyor, künyeyi platformun
 * kendi oEmbed ucundan çekiyoruz. **Videoyu indirmiyoruz** — kapak bile
 * platformun sunucusundan gösteriliyor, dokununca kendi uygulaması açılıyor.
 *
 * Instagram künyeyi anahtarsız vermiyor; orada başlığı kullanıcı yazıyor ve
 * bu ekran bunu açıkça söylüyor, sessizce boş kart bırakmıyor.
 */

const SAND = '#fbf9f6';

export default function AddVideoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addVideo = useCookbook((s) => s.addVideo);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (value: string) => {
    setError(null);
    setMeta(null);

    const ref = parseVideoUrl(value);
    if (!ref) {
      setError('Bu bir bağlantı gibi görünmüyor. Videonun paylaş bağlantısını yapıştır.');
      return;
    }

    setBusy(true);
    const found = await fetchVideoMeta(ref);
    setBusy(false);
    setMeta(found);
    if (found.title) setTitle(found.title);
  };

  const save = () => {
    if (!meta) return;
    const item = addVideo(meta, title);
    if (!item) {
      setError('Bu video kitabında zaten var (ya da başlık boş).');
      return;
    }
    router.back();
  };

  const needsManualTitle = meta && meta.source === 'elle';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <Text variant="display" style={styles.title}>
          Video ekle
        </Text>
        <Text variant="body" tone="muted" style={{ marginBottom: spacing.xl }}>
          Instagram, TikTok ya da YouTube&apos;da gördüğün tarif videosunun bağlantısını
          yapıştır. Video kitabına bağlantı olarak giriyor; dokununca kendi
          uygulamasında açılıyor.
        </Text>

        <View style={styles.field}>
          <Link2 size={18} color={palette.inkMuted} />
          <TextInput
            value={url}
            onChangeText={setUrl}
            onBlur={() => url.trim() && check(url)}
            placeholder="https://…"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Video bağlantısı"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <Button
            label={busy ? 'Bakılıyor…' : 'Bağlantıyı çöz'}
            variant="secondary"
            disabled={busy || url.trim().length < 8}
            onPress={() => check(url)}
          />
        </View>

        {busy ? <ActivityIndicator color={palette.brand} style={{ marginTop: spacing.lg }} /> : null}

        {error ? (
          <View style={styles.warn}>
            <AlertCircle size={16} color={palette.warning} />
            <Text variant="caption" tone="warning" style={{ flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* ── Önizleme ─────────────────────────────────────────── */}
        {meta ? (
          <View style={styles.preview}>
            <View style={styles.previewArt}>
              {meta.thumbUrl ? (
                <Image source={{ uri: meta.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.artBlank]}>
                  <ClipboardPaste size={26} color={palette.brandDeep} />
                </View>
              )}
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" tone="brand">
                {PLATFORM_LABELS[meta.platform].toLocaleUpperCase('tr-TR')}
              </Text>
              {meta.author ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {meta.author}
                </Text>
              ) : null}
              <View style={styles.okRow}>
                <Check size={13} color={palette.success} />
                <Text variant="caption" tone="success">
                  {meta.source === 'oembed' ? 'Künye platformdan geldi' : 'Bağlantı tanındı'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {meta ? (
          <>
            <Text variant="label" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {needsManualTitle ? 'BAŞLIK (SEN YAZ)' : 'BAŞLIK'}
            </Text>
            <View style={styles.field}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Örn. Fırında Karnabahar"
                placeholderTextColor={palette.inkFaint}
                accessibilityLabel="Video başlığı"
                style={styles.input}
              />
            </View>
            {needsManualTitle ? (
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                Bu platform başlığı dışarıya vermiyor, o yüzden sen yazıyorsun. Yazdığın
                başlık kitapta hangi bölüme düşeceğini de belirliyor — &quot;börek&quot;
                yazarsan hamur işlerine giriyor.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={{ width: 104 }}>
          <Button label="Vazgeç" variant="quiet" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Kitabıma ekle" disabled={!meta || !title.trim()} onPress={save} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '800', color: '#111', marginBottom: spacing.sm },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: palette.ink, paddingVertical: 12 },

  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: palette.warningSoft,
  },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewArt: {
    width: 76,
    height: 100,
    borderRadius: radius.control,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  artBlank: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.brandSoft },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
});
