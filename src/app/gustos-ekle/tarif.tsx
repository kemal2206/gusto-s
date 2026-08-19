import { useRouter } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { resolveLine, suggestIngredients } from '@/lib/malzeme-coz';
import type { OwnIngredient } from '@/lib/cookbook/types';
import { useCookbook } from '@/lib/store/cookbook';
import { fontFamily, palette, radius, spacing } from '@/theme/tokens';

/**
 * Kendi tarifini yaz.
 *
 * Malzemeyi olduğu gibi yazıyorsun — "2 su bardağı un". Satır katalogla
 * eşleşirse yanında yeşil bir tik ve gramajı çıkıyor; eşleşmezse satır aynen
 * duruyor, sadece uygulamanın akıllı kısımlarına katılmıyor. Bu ayrımı
 * kullanıcıya açıkça gösteriyoruz ki "neden bazıları farklı" sorusu doğmasın.
 */

const SAND = '#fbf9f6';

export default function WriteRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addOwn = useCookbook((s) => s.addOwn);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [minutes, setMinutes] = useState('');
  const [servings, setServings] = useState('4');

  const [ingredientDraft, setIngredientDraft] = useState('');
  const [ingredients, setIngredients] = useState<OwnIngredient[]>([]);
  const [stepDraft, setStepDraft] = useState('');
  const [steps, setSteps] = useState<string[]>([]);

  const suggestions = useMemo(() => {
    const q = ingredientDraft.replace(/^[\d.,/\s]+/, '').trim();
    return q.length >= 2 ? suggestIngredients(q, 6) : [];
  }, [ingredientDraft]);

  const addIngredient = (text?: string) => {
    const value = (text ?? ingredientDraft).trim();
    if (!value) return;
    setIngredients((prev) => [...prev, resolveLine(value)]);
    setIngredientDraft('');
  };

  const addStep = () => {
    const value = stepDraft.trim();
    if (!value) return;
    setSteps((prev) => [...prev, value]);
    setStepDraft('');
  };

  const matched = ingredients.filter((i) => i.slug).length;
  const canSave = title.trim().length >= 3 && ingredients.length >= 2 && steps.length >= 1;

  const save = () => {
    addOwn({
      title,
      summary: summary || undefined,
      ingredients,
      steps,
      minutes: minutes ? Number(minutes) : undefined,
      servings: servings ? Number(servings) : undefined,
    });
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <Text variant="display" style={styles.title}>
          Kendi tarifin
        </Text>

        <Label>ADI</Label>
        <Field value={title} onChange={setTitle} placeholder="Örn. Anneannemin mercimek çorbası" />

        <Label>KISA ANLATIM</Label>
        <Field
          value={summary}
          onChange={setSummary}
          placeholder="Bir cümleyle ne olduğu"
          multiline
        />

        <View style={styles.pairRow}>
          <View style={{ flex: 1 }}>
            <Label>SÜRE (DK)</Label>
            <Field value={minutes} onChange={setMinutes} placeholder="45" numeric />
          </View>
          <View style={{ flex: 1 }}>
            <Label>KAÇ KİŞİLİK</Label>
            <Field value={servings} onChange={setServings} placeholder="4" numeric />
          </View>
        </View>

        {/* ── Malzemeler ───────────────────────────────────────── */}
        <Label>MALZEMELER</Label>
        {ingredients.map((ing, i) => {
          const known = ing.slug ? BY_SLUG.get(ing.slug) : undefined;
          return (
            <View key={`${ing.raw}-${i}`} style={styles.row}>
              {known ? (
                <IngredientAvatar ingredient={known} size={30} />
              ) : (
                <View style={styles.rawDot} />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {ing.raw}
                </Text>
                {known ? (
                  <View style={styles.okRow}>
                    <Check size={12} color={palette.success} />
                    <Text variant="caption" tone="success">
                      {`${known.nameTr}${ing.grams ? ` · ${ing.grams} g` : ''}`}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" tone="muted">
                    Katalogda yok — olduğu gibi yazılacak
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ing.raw} satırını sil`}
                hitSlop={10}
                onPress={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}>
                <X size={18} color={palette.inkMuted} />
              </Pressable>
            </View>
          );
        })}

        <View style={styles.field}>
          <TextInput
            value={ingredientDraft}
            onChangeText={setIngredientDraft}
            onSubmitEditing={() => addIngredient()}
            placeholder="2 su bardağı un"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Malzeme satırı"
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Malzemeyi ekle"
            hitSlop={10}
            onPress={() => addIngredient()}>
            <Plus size={20} color={palette.brand} />
          </Pressable>
        </View>

        {suggestions.length ? (
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable
                key={s.slug}
                accessibilityRole="button"
                accessibilityLabel={s.nameTr}
                onPress={() => {
                  // Yazdığı miktarı koru, adı katalogdakiyle değiştir.
                  const prefix = ingredientDraft.match(/^[\d.,/\s]*[a-zçğıöşü ]*?(?=\S)/i)?.[0] ?? '';
                  const amount = ingredientDraft.match(/^[\d.,/]+\s*\S*\s*/)?.[0] ?? '';
                  addIngredient(`${amount || prefix}${s.nameTr}`.trim());
                }}
                style={styles.suggestion}>
                <IngredientAvatar ingredient={s} size={22} />
                <Text variant="label">{s.nameTr}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {ingredients.length ? (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {`${matched}/${ingredients.length} malzeme katalogla eşleşti. Eşleşenler sayesinde
tarifin "elimde ne var"da çıkıyor ve besin değeri hesaplanıyor.`}
          </Text>
        ) : null}

        {/* ── Adımlar ──────────────────────────────────────────── */}
        <Label>YAPILIŞI</Label>
        {steps.map((s, i) => (
          <View key={`${s}-${i}`} style={styles.row}>
            <View style={styles.stepDot}>
              <Text variant="label" tone="inverse">
                {String(i + 1)}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {s}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. adımı sil`}
              hitSlop={10}
              onPress={() => setSteps((prev) => prev.filter((_, j) => j !== i))}>
              <X size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
        ))}

        <View style={styles.field}>
          <TextInput
            value={stepDraft}
            onChangeText={setStepDraft}
            onSubmitEditing={addStep}
            placeholder="Soğanı kavur…"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Yapılış adımı"
            returnKeyType="done"
            multiline
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adımı ekle"
            hitSlop={10}
            onPress={addStep}>
            <Plus size={20} color={palette.brand} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <View style={{ width: 104 }}>
          <Button label="Vazgeç" variant="quiet" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Kitabıma ekle" disabled={!canSave} onPress={save} />
        </View>
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
      {children}
    </Text>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.inkFaint}
        accessibilityLabel={placeholder}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '800', color: '#111' },

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
    marginTop: spacing.sm,
  },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: palette.ink, paddingVertical: 14 },
  pairRow: { flexDirection: 'row', gap: spacing.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  rawDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
  },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.control,
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
  },

  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
});
