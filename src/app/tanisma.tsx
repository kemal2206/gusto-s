import { useRouter } from 'expo-router';
import {
  Baby,
  Cat,
  ChefHat,
  Dog,
  Minus,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Text } from '@/components/ui/text';
import { INGREDIENTS } from '@/data/catalog';
import { pushProfile } from '@/lib/auth';
import {
  APPLIANCE_LABELS,
  DIET_LABELS,
  useProfile,
  type Appliance,
  type DietRestriction,
} from '@/lib/store/profile';
import { fontFamily, palette, radius, spacing } from '@/theme/tokens';

/**
 * İlk açılış soruları.
 *
 * Dört adım: hane, diyet, sevmedikleri, mutfak ekipmanı. Cevaplar profile
 * yazılıyor ve ana sayfadaki tarif listesini süzüyor — yani sorular süs değil,
 * doğrudan ne göreceğini belirliyor.
 *
 * Hiçbiri zorunlu değil: her adım "Geç" ile atlanabiliyor. Zorunlu tutmak
 * uygulamayı ilk açan birini kapıda tutmak demek.
 */

const SAND = '#fbf9f6';
const INK = '#111';
const BRAND = palette.brand;

const STEP_COUNT = 4;

/** Sevmeme sorusunda öne çıkan malzemeler — hepsi katalogda var. */
const COMMON_DISLIKES = [
  'patlican', 'kuru-sogan', 'sarimsak', 'kisnis-yapragi', 'brokoli',
  'karnabahar', 'mantar', 'siyah-zeytin', 'yumurta', 'ceviz',
  'pul-biber', 'nane', 'kereviz', 'balik-sosu',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');

  const household = useProfile((s) => s.household);
  const setHousehold = useProfile((s) => s.setHousehold);
  const diets = useProfile((s) => s.diets);
  const toggleDiet = useProfile((s) => s.toggleDiet);
  const disliked = useProfile((s) => s.dislikedSlugs);
  const toggleDislike = useProfile((s) => s.toggleDislike);
  const appliances = useProfile((s) => s.appliances);
  const toggleAppliance = useProfile((s) => s.toggleAppliance);
  const complete = useProfile((s) => s.completeOnboarding);

  const searchResults = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return [];
    return INGREDIENTS.filter((i) => i.nameTr.toLocaleLowerCase('tr-TR').includes(q)).slice(0, 12);
  }, [query]);

  const finish = () => {
    complete();
    // Oturum varsa buluta da yaz; yoksa sessizce geç.
    void pushProfile();
    router.replace('/');
  };

  const next = () => (step + 1 < STEP_COUNT ? setStep(step + 1) : finish());
  const back = () => (step > 0 ? setStep(step - 1) : router.replace('/'));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {/* ── İlerleme ─────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={back} hitSlop={12}>
          <RNText style={styles.backArrow}>←</RNText>
        </Pressable>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${((step + 1) / STEP_COUNT) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Header title="Hane" subtitle="Kaç kişiye yemek yapıyorsun?" />
            <Counter
              icon={<User size={22} color="#555" />}
              label="Yetişkin"
              value={household.adults}
              onChange={(v) => setHousehold({ adults: v })}
              min={1}
            />
            <Counter
              icon={<Baby size={22} color="#555" />}
              label="Çocuk"
              hint="3 yaş üstü"
              value={household.children}
              onChange={(v) => setHousehold({ children: v })}
            />
            <Counter
              icon={<Dog size={22} color="#555" />}
              label="Köpek"
              value={household.dogs}
              onChange={(v) => setHousehold({ dogs: v })}
            />
            <Counter
              icon={<Cat size={22} color="#555" />}
              label="Kedi"
              value={household.cats}
              onChange={(v) => setHousehold({ cats: v })}
            />
            <Text variant="caption" style={styles.note}>
              Kişi sayısını tarif miktarlarını sana göre ölçeklemek için soruyoruz.
              Evcil hayvanlar için ayrı tarifimiz yok, sadece hanenizi tanıyoruz.
            </Text>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Header title="Damak tadın" subtitle="Bir beslenme kısıtın var mı?" />
            <View style={styles.grid}>
              {(Object.keys(DIET_LABELS) as DietRestriction[]).map((d) => (
                <GridCard
                  key={d}
                  label={DIET_LABELS[d].label}
                  hint={DIET_LABELS[d].hint}
                  selected={diets.includes(d)}
                  onPress={() => toggleDiet(d)}
                />
              ))}
            </View>
            <Text variant="caption" style={styles.note}>
              Seçtiğin kısıta uymayan tarifler listelerden tamamen çıkarılır.
            </Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Header
              title="Sevmediklerin"
              subtitle="Karşına çıkmasını istemediğin malzemeleri seç"
            />

            <View style={styles.chipWrap}>
              {COMMON_DISLIKES.map((slug) => {
                const ing = INGREDIENTS.find((i) => i.slug === slug);
                if (!ing) return null;
                const on = disliked.includes(slug);
                return (
                  <Pressable
                    key={slug}
                    accessibilityRole="button"
                    accessibilityLabel={ing.nameTr}
                    accessibilityState={{ selected: on }}
                    onPress={() => toggleDislike(slug)}
                    style={[styles.chip, on && styles.chipOn]}>
                    <IngredientAvatar ingredient={ing} size={22} />
                    <Text variant="label" style={{ color: on ? '#fff' : INK }}>
                      {ing.nameTr}
                    </Text>
                    {on ? <X size={14} color="#fff" /> : <Plus size={14} color="#777" />}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.search}>
              <Search size={18} color="#777" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Malzeme ara"
                placeholderTextColor="#999"
                accessibilityLabel="Sevmediğin malzemeyi ara"
                autoCorrect={false}
                style={styles.searchInput}
              />
            </View>

            {searchResults.map((ing) => {
              const on = disliked.includes(ing.slug);
              return (
                <Pressable
                  key={ing.slug}
                  accessibilityRole="button"
                  accessibilityLabel={ing.nameTr}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggleDislike(ing.slug)}
                  style={styles.searchRow}>
                  <IngredientAvatar ingredient={ing} size={30} />
                  <Text variant="body" style={{ flex: 1, color: INK }}>
                    {ing.nameTr}
                  </Text>
                  {on ? <X size={18} color={BRAND} /> : <Plus size={18} color="#777" />}
                </Pressable>
              );
            })}

            {disliked.length ? (
              <Text variant="caption" style={styles.note}>
                {`${disliked.length} malzeme listelerden çıkarılacak.`}
              </Text>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Header title="Mutfağın" subtitle="Hangi ekipmanların var?" />
            <View style={styles.grid}>
              {(Object.keys(APPLIANCE_LABELS) as Appliance[]).map((a) => (
                <GridCard
                  key={a}
                  label={APPLIANCE_LABELS[a]}
                  selected={appliances.includes(a)}
                  onPress={() => toggleAppliance(a)}
                />
              ))}
            </View>
            <Text variant="caption" style={styles.note}>
              Ekipmanın olmayan tarifler gizlenmez, sadece listenin altına düşer —
              başka bir yerde pişirmek isteyebilirsin.
            </Text>
          </>
        ) : null}
      </ScrollView>

      {/* ── Alt eylemler ─────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable accessibilityRole="button" onPress={next} style={styles.primary}>
          <Text variant="button" style={styles.primaryText}>
            {step + 1 === STEP_COUNT ? 'Başla' : 'Devam'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
          <Text variant="label" style={{ color: '#777' }}>
            Şimdilik geç
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Parçalar ─────────────────────────────────────────────────────

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text variant="display" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" style={styles.subtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

function Counter({
  icon,
  label,
  hint,
  value,
  onChange,
  min = 0,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <View style={styles.counterCard}>
      <View style={styles.counterLeft}>
        {icon}
        <View>
          <Text variant="h3" style={{ color: INK }}>
            {label}
          </Text>
          {hint ? (
            <Text variant="caption" style={{ color: '#777' }}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} azalt`}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
          hitSlop={8}
          style={styles.stepperButton}>
          <Minus size={18} color={value <= min ? '#bbb' : INK} />
        </Pressable>
        <Text variant="h3" style={styles.stepperValue}>
          {String(value)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} artır`}
          onPress={() => onChange(value + 1)}
          hitSlop={8}
          style={styles.stepperButton}>
          <Plus size={18} color={INK} />
        </Pressable>
      </View>
    </View>
  );
}

function GridCard({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.gridCard, selected && styles.gridCardOn]}>
      <ChefHat size={26} color={selected ? '#fff' : '#555'} />
      <Text variant="bodyStrong" center style={{ color: selected ? '#fff' : INK }}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" center style={{ color: selected ? '#f4d7dd' : '#888' }}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: spacing.xl },
  backArrow: { fontSize: 26, color: INK },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#e3ddd4', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: BRAND, borderRadius: 4 },

  content: { paddingHorizontal: spacing.xl, paddingTop: 32, paddingBottom: 24, gap: 12 },
  header: { alignItems: 'center', marginBottom: 20, gap: 6 },
  title: { fontSize: 34, lineHeight: 38, fontWeight: '800', color: INK },
  subtitle: { fontSize: 17, color: '#555', textAlign: 'center' },
  note: { marginTop: 16, color: '#777', lineHeight: 18 },

  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  counterLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d6ecf7',
    borderRadius: 999,
    paddingHorizontal: 6,
    height: 44,
    minWidth: 120,
    justifyContent: 'space-between',
  },
  stepperButton: { paddingHorizontal: 12, paddingVertical: 8 },
  stepperValue: { color: INK, minWidth: 24, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: '31%',
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  gridCardOn: { backgroundColor: BRAND },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: radius.control,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: BRAND },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radius.control,
    paddingHorizontal: 18,
    height: 48,
    marginTop: 18,
  },
  searchInput: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: INK, paddingVertical: 0 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },

  footer: { paddingHorizontal: spacing.xl, paddingTop: 12, gap: 10 },
  primary: {
    backgroundColor: BRAND,
    borderRadius: radius.control,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  skip: { alignItems: 'center', paddingVertical: 8 },
});
