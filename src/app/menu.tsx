import { useRouter } from 'expo-router';
import { Clock, Flame, RefreshCw, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { OptionCard } from '@/components/ui/option-card';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { buildMenu, type MenuAnswers } from '@/lib/menu-builder';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { eaterCount } from '@/lib/profile-model';
import { palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * "Bana menü hazırla".
 *
 * Tek tarif sihirbazından farkı: burada beş tabaklık bir sofra kuruyoruz,
 * bu yüzden sorular da farklı — kaç kişi, hangi vesile, ne kadar emek.
 * Cevaplar `buildMenu`'ye gidiyor; tabaklar arası bağı orada aroma ağı
 * kuruyor ve her tabağın altında neden orada olduğu yazıyor.
 */

const SAND = '#fbf9f6';
const INK = '#111';

interface Q {
  id: keyof MenuAnswers;
  question: string;
  hint?: string;
  options: { value: string; label: string; description?: string; slug?: string }[];
}

const QUESTIONS: Q[] = [
  {
    id: 'vesile',
    question: 'Sofra kimin için?',
    options: [
      { value: 'misafir', label: 'Misafir geliyor', description: 'Gösterişli ama abartısız', slug: 'kuzu-but' },
      { value: 'aile', label: 'Ev sofrası', description: 'Herkesin sevdiği tabaklar', slug: 'domates-salcasi' },
      { value: 'ozel-gun', label: 'Özel bir gün', description: 'Emek isteyen tabaklar', slug: 'safran' },
      { value: 'hafif', label: 'Hafif bir akşam', description: 'Az ve çabuk', slug: 'salatalik' },
    ],
  },
  {
    id: 'ana',
    question: 'Ana yemek ne olsun?',
    options: [
      { value: 'kirmizi-et', label: 'Kırmızı et', slug: 'kuzu-pirzola' },
      { value: 'tavuk', label: 'Tavuk', slug: 'tavuk-but' },
      { value: 'balik', label: 'Balık', slug: 'levrek' },
      { value: 'sebze', label: 'Etsiz', description: 'Sebze ve baklagil', slug: 'patlican' },
    ],
  },
  {
    id: 'mutfak',
    question: 'Hangi mutfak?',
    hint: 'Fark etmezse geç.',
    options: [
      { value: 'turk', label: 'Türk mutfağı', slug: 'nar-eksisi' },
      { value: 'ege', label: 'Ege ve zeytinyağlı', slug: 'zeytinyagi' },
      { value: 'guneydogu', label: 'Güneydoğu', description: 'İsotlu, baharatlı', slug: 'isot' },
      { value: 'uzakdogu', label: 'Uzak Doğu', slug: 'soya-sosu' },
    ],
  },
  {
    id: 'agirlik',
    question: 'Sofra ne kadar ağır olsun?',
    options: [
      { value: 'hafif', label: 'Hafif', description: 'Kalkarken ağırlık olmasın' },
      { value: 'dengeli', label: 'Dengeli' },
      { value: 'doyurucu', label: 'Doyurucu', description: 'Doya doya' },
    ],
  },
  {
    id: 'emek',
    question: 'Ne kadar vaktin var?',
    options: [
      { value: 'kolay', label: 'Kısa tutalım', description: 'Her tabak yarım saat civarı' },
      { value: 'orta', label: 'Normal bir hazırlık' },
      { value: 'sinirsiz', label: 'Bütün gün mutfaktayım' },
    ],
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState(1);

  const household = useProfile((s) => s.household);
  const profileFilter = useProfileFilter();
  const people = eaterCount(household);

  const finished = index >= QUESTIONS.length;

  const menu = useMemo(() => {
    if (!finished) return null;
    return buildMenu({ ...(answers as MenuAnswers), kisi: people }, profileFilter, seed);
  }, [finished, answers, people, profileFilter, seed]);

  if (finished) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 40 }}>
          <Text variant="display" style={styles.bigTitle}>
            Sofran hazır
          </Text>

          {menu ? (
            <>
              <View style={styles.summary}>
                <Fact icon={<Users size={16} color={palette.inkMuted} />} value={`${people} kişilik`} />
                <Fact icon={<Clock size={16} color={palette.inkMuted} />} value={`${menu.totalMinutes} dk`} />
                <Fact icon={<Flame size={16} color={palette.inkMuted} />} value={`${menu.kcalPerPerson} kcal`} />
              </View>

              <Text variant="caption" tone="muted" style={{ marginBottom: spacing.lg }}>
                {menu.coherence >= 0.35
                  ? 'Tabaklar birbirine aroma bileşikleriyle bağlı — her birinin altında hangi bağla geldiği yazıyor.'
                  : 'Tabaklar birbirini dengeleyecek şekilde seçildi.'}
              </Text>

              {menu.courses.map((c, i) => {
                const lead = c.recipe.components[0]?.ingredients[0]?.slug;
                const ing = lead ? BY_SLUG.get(lead) : undefined;
                return (
                  <Pressable
                    key={c.recipe.slug}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.course.labelTr}: ${c.recipe.title}`}
                    onPress={() =>
                      router.push({ pathname: '/tarif/[slug]', params: { slug: c.recipe.slug } })
                    }
                    style={({ pressed }) => [styles.course, pressed && { opacity: 0.85 }]}>
                    <View style={styles.courseHead}>
                      <View style={styles.stepDot}>
                        <Text variant="label" tone="inverse" style={tabularNums}>
                          {String(i + 1)}
                        </Text>
                      </View>
                      <Text variant="eyebrow" tone="brand">
                        {c.course.labelTr.toLocaleUpperCase('tr-TR')}
                      </Text>
                    </View>

                    <View style={styles.courseBody}>
                      {ing ? <IngredientAvatar ingredient={ing} size={52} /> : null}
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text variant="h3" style={{ color: INK }} numberOfLines={2}>
                          {c.recipe.title}
                        </Text>
                        <Text variant="caption" tone="muted" style={tabularNums}>
                          {`${c.recipe.totalMinutes} dk · ${c.recipe.components.reduce((n, k) => n + k.steps.length, 0)} adım`}
                        </Text>
                      </View>
                    </View>

                    <Text variant="caption" tone="brandDeep" style={styles.reason}>
                      {c.reasonTr}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                onPress={() => setSeed((s) => s + 1)}
                style={({ pressed }) => [styles.again, pressed && { opacity: 0.85 }]}>
                <RefreshCw size={18} color={palette.brand} />
                <Text variant="button" tone="brand">
                  Başka bir sofra kur
                </Text>
              </Pressable>
            </>
          ) : (
            <Text variant="body" tone="muted">
              Bu cevaplarla sofra kuramadık. Bir soruyu &quot;fark etmez&quot; bırakıp tekrar dene.
            </Text>
          )}

          <View style={{ marginTop: spacing.lg }}>
            <Button
              label="Soruları değiştir"
              variant="secondary"
              onPress={() => {
                setAnswers({});
                setIndex(0);
              }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  const step = QUESTIONS[index];
  const selected = answers[step.id];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((index + 1) / QUESTIONS.length) * 100}%` }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 28, paddingBottom: 24 }}>
        <Text variant="display" style={styles.bigTitle}>
          {step.question}
        </Text>
        {step.hint ? (
          <Text variant="body" tone="muted" style={{ marginBottom: spacing.lg }}>
            {step.hint}
          </Text>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {step.options.map((o) => {
            const ing = o.slug ? BY_SLUG.get(o.slug) : undefined;
            return (
              <OptionCard
                key={o.value}
                title={o.label}
                description={o.description}
                icon={ing ? <IngredientAvatar ingredient={ing} size={40} /> : undefined}
                selected={selected === o.value}
                onPress={() => {
                  setAnswers((prev) => ({ ...prev, [step.id]: o.value }));
                  setIndex((i) => i + 1);
                }}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {index > 0 ? (
          <View style={{ width: 104 }}>
            <Button label="Geri" variant="quiet" onPress={() => setIndex((i) => i - 1)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            label="Fark etmez, geç"
            variant="secondary"
            onPress={() => setIndex((i) => i + 1)}
          />
        </View>
      </View>
    </View>
  );
}

function Fact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View style={styles.fact}>
      {icon}
      <Text variant="bodyStrong" style={tabularNums}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  track: {
    height: 6,
    marginHorizontal: spacing.xl,
    borderRadius: 3,
    backgroundColor: '#e3ddd4',
    overflow: 'hidden',
  },
  fill: { height: 6, backgroundColor: palette.brand, borderRadius: 3 },
  bigTitle: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: INK, marginBottom: spacing.md },

  summary: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md, flexWrap: 'wrap' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  course: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  courseHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reason: {
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    lineHeight: 19,
  },

  again: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: palette.surface,
    marginTop: spacing.sm,
  },

  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
});
