import { useRouter } from 'expo-router';
import { Check, LogOut, Mail, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { pullProfile, pushProfile, sendLoginCode, signOut, verifyLoginCode } from '@/lib/auth';
import { APPLIANCE_LABELS, DIET_LABELS, useProfile } from '@/lib/store/profile';
import { eaterCount } from '@/lib/profile-model';
import { fontFamily, palette, radius, spacing } from '@/theme/tokens';

/**
 * Hesap ekranı.
 *
 * Parola yok: e-posta yaz, gelen 6 haneli kodu gir. Hesap **zorunlu değil** —
 * uygulama tamamen yerel çalışıyor; hesap yalnızca kaydettiklerini başka
 * cihazda da görmek isteyene lazım. Bu yüzden ekran bir duvar değil, bir teklif.
 */

const SAND = '#fbf9f6';

type Stage = 'eposta' | 'kod';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const email = useProfile((s) => s.email);
  const userId = useProfile((s) => s.userId);
  const household = useProfile((s) => s.household);
  const diets = useProfile((s) => s.diets);
  const dislikedSlugs = useProfile((s) => s.dislikedSlugs);
  const appliances = useProfile((s) => s.appliances);
  const eliminations = useProfile((s) => s.eliminations);
  const excludedSlugs = useProfile((s) => s.excludedSlugs);
  const resetOnboarding = useProfile((s) => s.resetOnboarding);

  const [stage, setStage] = useState<Stage>('eposta');
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setNote(null);
    const res = await sendLoginCode(input);
    setBusy(false);

    if (res.ok) {
      setStage('kod');
      setNote(`${input.trim()} adresine 6 haneli kod gönderildi.`);
      return;
    }
    setNote(
      res.reason === 'gecersiz-eposta'
        ? 'E-posta adresi geçerli görünmüyor.'
        : res.reason === 'yapilandirilmadi'
          ? 'Hesap sunucusu bu kurulumda tanımlı değil. Uygulama yerel olarak çalışmaya devam ediyor.'
          : (res.message ?? 'Kod gönderilemedi.'),
    );
  };

  const verify = async () => {
    setBusy(true);
    setNote(null);
    const res = await verifyLoginCode(input, code);
    if (res.ok) {
      // Bulutta profil varsa onu al, yoksa yereli yukarı yaz.
      await pullProfile();
      await pushProfile();
      setBusy(false);
      setNote('Giriş yapıldı.');
      return;
    }
    setBusy(false);
    setNote(res.message ?? 'Kod doğrulanamadı.');
  };

  const out = async () => {
    await signOut();
    setStage('eposta');
    setInput('');
    setCode('');
    setNote('Çıkış yapıldı. Kayıtların bu cihazda duruyor.');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <Text variant="display" style={styles.bigTitle}>
          {userId ? 'Hesabın' : 'Giriş yap'}
        </Text>

        {userId ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Check size={18} color={palette.success} />
                <Text variant="bodyStrong">{email ?? 'Oturum açık'}</Text>
              </View>
              <Text variant="caption" tone="muted">
                Kaydettiğin tarifler, pişirdiklerin ve tercihlerin bu hesapla birlikte
                taşınıyor.
              </Text>
            </View>

            <Text variant="eyebrow" tone="brand" style={styles.sectionLabel}>
              TERCİHLERİN
            </Text>
            <View style={styles.card}>
              <Line label="Sofra" value={`${eaterCount(household)} kişilik`} />
              <Line
                label="Beslenme"
                value={diets.length ? diets.map((d) => DIET_LABELS[d].label).join(', ') : 'Kısıt yok'}
              />
              <Line
                label="Sevmedikleri"
                value={dislikedSlugs.length ? `${dislikedSlugs.length} malzeme` : 'Yok'}
              />
              <Line
                label="Mutfak"
                value={appliances.map((a) => APPLIANCE_LABELS[a]).join(', ') || 'Belirtilmedi'}
              />
              <Line
                label="Çıkarılanlar"
                value={
                  eliminations.length || excludedSlugs.length
                    ? `${eliminations.length} liste · ${excludedSlugs.length} malzeme`
                    : 'Yok'
                }
              />
            </View>

            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                label="Çıkarılan malzemeler"
                variant="secondary"
                onPress={() => router.push('/eliminasyon')}
              />
              <Button
                label="Soruları yeniden cevapla"
                variant="secondary"
                onPress={() => {
                  resetOnboarding();
                  router.push('/tanisma');
                }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={out}
                style={({ pressed }) => [styles.quiet, pressed && { opacity: 0.7 }]}>
                <LogOut size={16} color={palette.inkMuted} />
                <Text variant="label" tone="muted">
                  Çıkış yap
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text variant="body" tone="muted" style={{ marginBottom: spacing.lg }}>
              Parola yok. E-postanı yaz, gelen kodu gir. Hesap açmadan da uygulamanın
              tamamını kullanabilirsin — hesap sadece kayıtlarını başka cihaza taşır.
            </Text>

            <View style={styles.field}>
              <Mail size={18} color={palette.inkMuted} />
              <TextInput
                value={input}
                onChangeText={setInput}
                editable={stage === 'eposta'}
                placeholder="eposta@ornek.com"
                placeholderTextColor={palette.inkFaint}
                accessibilityLabel="E-posta adresi"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            {stage === 'kod' ? (
              <View style={[styles.field, { marginTop: spacing.sm }]}>
                <ShieldCheck size={18} color={palette.inkMuted} />
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="6 haneli kod"
                  placeholderTextColor={palette.inkFaint}
                  accessibilityLabel="Giriş kodu"
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  style={styles.input}
                />
              </View>
            ) : null}

            {note ? (
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
                {note}
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {busy ? (
                <ActivityIndicator color={palette.brand} />
              ) : stage === 'eposta' ? (
                <Button label="Kod gönder" onPress={send} />
              ) : (
                <>
                  <Button label="Giriş yap" onPress={verify} />
                  <Button
                    label="E-postayı değiştir"
                    variant="quiet"
                    onPress={() => {
                      setStage('eposta');
                      setCode('');
                      setNote(null);
                    }}
                  />
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  bigTitle: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: '#111', marginBottom: spacing.md },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },

  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: palette.ink, paddingVertical: 0 },

  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
});
