import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';

import { PickCard } from '@/components/pick-card';
import { RecipeRail } from '@/components/recipe-rail';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Eyebrow } from '@/components/ui/eyebrow';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { OptionCard } from '@/components/ui/option-card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BY_SLUG, INGREDIENTS, LOOKUP } from '@/data/catalog';
import { COMPONENT_LABELS_TR, METHOD_LABELS_TR } from '@/data/recipes';
import type { ArchetypeId, DishComponent, DishState, Ingredient, IngredientRole } from '@/engine';
import { ARCHETYPES, CHAIN_WEIGHTS, suggestAdditions } from '@/engine';
import {
  CHARACTERS,
  CHARACTER_BY_ARCHETYPE,
  COMPONENT_ORDER,
  COMPONENT_PLANS,
  MAIN_GROUPS,
  MAIN_GROUP_BY_ID,
  type ComponentPlanId,
  type MainGroup,
} from '@/lib/lab-flow';
import { recipesForPicks } from '@/lib/recipe-filter';
import { useHistory } from '@/lib/store/history';
import { useTabReset } from '@/lib/use-tab-reset';
import { palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * Lezzet Lab — **bileşen** temelli tabak kurma.
 *
 * Eski hâli tek düz zincirdi ve şu sorunu üretiyordu: uskumru seçtikten sonra
 * salatalık öneriliyordu, ama salatalık balığın İÇİNE girmiyor — yanındaki
 * salataya giriyor. Artık her bileşen (ana / sos / yanında) ayrı kuruluyor:
 *
 *   - Aktif bileşenin malzemeleri motora `components` olarak gidiyor;
 *     tutarlılık ve tat dengesi o bileşenin içinde ölçülüyor.
 *   - Diğer bileşenler `pairedWith` tarafında duruyor: aroma uyumuna
 *     giriyorlar ama tat profiline karışmıyorlar.
 *
 * "Düz antrikot + yaban mersinli sos" da böyle kuruluyor: bir `ana`, bir `sos`.
 * En küçük yemek tek bileşen — sadece ızgara et de geçerli bir sonuç.
 */

interface LabPick extends DishComponent {
  stepId: string;
}

interface LabComponent {
  planId: ComponentPlanId;
  archetypeId: ArchetypeId;
  picks: LabPick[];
  stepIndex: number;
}

type Phase = 'grup' | 'ana' | 'karakter' | 'rol' | 'bilesen' | 'bilesen-hedef' | 'ozet';

export default function LabScreen() {
  const params = useLocalSearchParams<{ grup?: string; slugs?: string; ana?: string }>();

  const [phase, setPhase] = useState<Phase>('grup');
  const [group, setGroup] = useState<MainGroup | null>(null);
  const [slugFilter, setSlugFilter] = useState<string[] | null>(null);
  const [components, setComponents] = useState<LabComponent[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingPlan, setPendingPlan] = useState<ComponentPlanId | null>(null);

  const logDish = useHistory((s) => s.logDish);
  const loggedRef = useRef(false);

  // Ana sayfadan gelen kısayol.
  const paramKey = `${params.grup ?? ''}|${params.slugs ?? ''}|${params.ana ?? ''}`;
  useEffect(() => {
    if (paramKey === '||') return;
    const main = params.ana ? BY_SLUG.get(params.ana) : undefined;
    const grp = params.grup ? MAIN_GROUP_BY_ID.get(params.grup) : undefined;

    loggedRef.current = false;
    setSlugFilter(params.slugs ? params.slugs.split(',') : null);
    setComponents([]);
    setActiveIndex(0);

    if (main) {
      startWithMain(main);
    } else if (grp) {
      setGroup(grp);
      setPhase('ana');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  const active = components[activeIndex] as LabComponent | undefined;
  const plan = active ? COMPONENT_PLANS[active.planId] : null;
  const step = plan && active ? plan.steps[active.stepIndex] : null;

  /** Aktif bileşen dengeleniyor, diğerleri yalnızca aroma uyumuna giriyor. */
  const dish: DishState = useMemo(() => {
    if (!active) return { components: [] };
    return {
      components: active.picks,
      pairedWith: components.filter((_, i) => i !== activeIndex).flatMap((c) => c.picks),
      archetypeId: active.archetypeId,
    };
  }, [components, activeIndex, active]);

  const lastPick = active?.picks[active.picks.length - 1];
  const character = active ? CHARACTER_BY_ARCHETYPE.get(active.archetypeId) : undefined;

  const suggestions = useMemo(() => {
    if (phase !== 'rol' || !active || !step) return [];
    return suggestAdditions(dish, INGREDIENTS, LOOKUP, {
      mode: 'benzerlik',
      weights: CHAIN_WEIGHTS,
      focusAxes: character?.focusAxes,
      allowedRoles: step.roles,
      anchorIngredientId: lastPick?.ingredient.id,
      doseBounds: step.doseRange,
      fixedGrams: step.fixedGrams,
      requireLink: true,
      limit: 6,
    });
  }, [phase, active, step, dish, lastPick, character]);

  const stepPicks = active?.picks.filter((p) => p.stepId === step?.id) ?? [];

  /** Kurulan tabağın gerçek dünyadaki karşılıkları — her adımda güncelleniyor. */
  const allPickedSlugs = components.flatMap((c) => c.picks.map((p) => p.ingredient.slug));
  const matchingRecipes = useMemo(
    () => recipesForPicks(allPickedSlugs, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPickedSlugs.join(',')],
  );

  const totalSteps = 3 + components.reduce((n, c) => n + COMPONENT_PLANS[c.planId].steps.length, 0);
  const doneSteps =
    (phase === 'grup' ? 0 : phase === 'ana' ? 1 : 2) +
    components.reduce((n, c, i) => n + (i < activeIndex ? COMPONENT_PLANS[c.planId].steps.length : 0), 0) +
    (active?.stepIndex ?? 0);
  const progress = phase === 'ozet' ? 1 : Math.min(0.95, doneSteps / Math.max(totalSteps, 1));

  // ── Eylemler ──────────────────────────────────────────────────────

  function startWithMain(main: Ingredient) {
    loggedRef.current = false;
    setComponents([
      {
        planId: 'ana',
        archetypeId: 'doyurucu-derin',
        stepIndex: 0,
        picks: [{ ingredient: main, grams: 250, role: 'ana', stepId: 'ana' }],
      },
    ]);
    setActiveIndex(0);
    setPhase('karakter');
  }

  const setArchetype = (id: ArchetypeId) =>
    setComponents((prev) =>
      prev.map((c, i) => (i === activeIndex ? { ...c, archetypeId: id } : c)),
    );

  const addPick = (p: LabPick) =>
    setComponents((prev) =>
      prev.map((c, i) => (i === activeIndex ? { ...c, picks: [...c.picks, p] } : c)),
    );

  const removePick = (id: number) =>
    setComponents((prev) =>
      prev.map((c, i) =>
        i === activeIndex ? { ...c, picks: c.picks.filter((p) => p.ingredient.id !== id) } : c,
      ),
    );

  const advanceStep = () => {
    if (!active || !plan) return;
    if (active.stepIndex + 1 < plan.steps.length) {
      setComponents((prev) =>
        prev.map((c, i) => (i === activeIndex ? { ...c, stepIndex: c.stepIndex + 1 } : c)),
      );
    } else {
      setPhase('bilesen');
    }
  };

  const startComponent = (planId: ComponentPlanId, archetypeId: ArchetypeId) => {
    setComponents((prev) => [...prev, { planId, archetypeId, stepIndex: 0, picks: [] }]);
    setActiveIndex(components.length);
    setPendingPlan(null);
    setPhase('rol');
  };

  const reset = () => {
    loggedRef.current = false;
    setPhase('grup');
    setGroup(null);
    setSlugFilter(null);
    setComponents([]);
    setActiveIndex(0);
  };

  // Sekmeye basınca laboratuvarı baştan başlat.
  useTabReset(reset);

  const goBack = () => {
    if (phase === 'ozet') setPhase('bilesen');
    else if (phase === 'bilesen-hedef') setPhase('bilesen');
    else if (phase === 'bilesen') setPhase('rol');
    else if (phase === 'rol' && active && active.stepIndex > 0) {
      setComponents((prev) =>
        prev.map((c, i) => (i === activeIndex ? { ...c, stepIndex: c.stepIndex - 1 } : c)),
      );
    } else if (phase === 'rol') setPhase(activeIndex === 0 ? 'karakter' : 'bilesen');
    else if (phase === 'karakter') setPhase('ana');
    else if (phase === 'ana') setPhase('grup');
  };

  // Tamamlanan tabağı geçmişe yaz.
  useEffect(() => {
    if (phase !== 'ozet' || loggedRef.current) return;
    const main = components[0]?.picks[0];
    if (!main) return;
    loggedRef.current = true;
    logDish({
      mainSlug: main.ingredient.slug,
      groupId: group?.id ?? '',
      archetypeId: components[0].archetypeId,
    });
  }, [phase, components, group, logDish]);

  // ── 01 · Ne pişiyor ───────────────────────────────────────────────
  if (phase === 'grup') {
    return (
      <Screen progress={progress}>
        <Head index="01" eyebrow="Lezzet Lab" question="Ne pişireceksin?"
          hint="Ana malzemeyi seç; sos ve yanındakileri sonra ekleyeceğiz." />
        <View style={styles.list}>
          {MAIN_GROUPS.map((g, i) => (
            <OptionCard key={g.id} title={g.labelTr}
              description={g.hintTr}
              icon={
                <Image
                  source={{ uri: `https://loremflickr.com/100/100/food,dish,${g.id}?random=${g.id}` }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                />
              }
              onPress={() => {
                setSlugFilter(null);
                setGroup(g);
                setPhase('ana');
              }} />
          ))}
        </View>
      </Screen>
    );
  }

  // ── 02 · Ana malzeme ──────────────────────────────────────────────
  if (phase === 'ana' && group) {
    const options = INGREDIENTS.filter(
      (i) =>
        group.categories.includes(i.category) &&
        (i.defaultRole === 'ana' || i.roles.includes('ana')) &&
        (!slugFilter || slugFilter.includes(i.slug)),
    );
    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="02" eyebrow={group.labelTr} question="Hangisi?" />
        <View style={styles.list}>
          {options.map((i) => (
            <OptionCard key={i.id} title={i.nameTr}
              icon={<IngredientAvatar ingredient={i} size={40} />}
              onPress={() => startWithMain(i)} />
          ))}
        </View>
      </Screen>
    );
  }

  // ── 03 · Ana yemeğin karakteri ────────────────────────────────────
  if (phase === 'karakter' && active) {
    const main = active.picks[0]?.ingredient;
    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="03" eyebrow={main?.nameTr ?? 'Karakter'} question="Nasıl bir tat olsun?"
          hint="Bu seçim ana yemeğin hedef tat profilini belirliyor." ingredient={main} />
        <View style={styles.list}>
          {CHARACTERS.filter((c) => COMPONENT_PLANS.ana.archetypes.includes(c.archetypeId)).map(
            (c) => (
              <OptionCard key={c.archetypeId} title={c.labelTr} description={c.hintTr}
                selected={active.archetypeId === c.archetypeId}
                onPress={() => {
                  setArchetype(c.archetypeId);
                  setPhase('rol');
                }} />
            ),
          )}
        </View>
      </Screen>
    );
  }

  // ── Rol adımları ──────────────────────────────────────────────────
  if (phase === 'rol' && active && plan && step) {
    const canPickMore = stepPicks.length < step.maxPicks;
    return (
      <Screen
        progress={progress}
        footer={
          <View style={styles.footerRow}>
            <View style={styles.footerBack}>
              <Button label="Geri" variant="quiet" onPress={goBack} />
            </View>
            <View style={styles.footerNext}>
              <Button label={stepPicks.length ? 'Devam et' : 'Bu adımı geç'}
                variant={stepPicks.length ? 'primary' : 'secondary'} onPress={advanceStep} />
            </View>
          </View>
        }>
        <Head index={COMPONENT_LABELS_TR[plan.kind].toLocaleUpperCase('tr-TR')}
          eyebrow={`${plan.labelTr} · ${ARCHETYPES[active.archetypeId].labelTr}`}
          question={step.questionTr} hint={step.hintTr} />

        <ComponentStrip components={components} activeIndex={activeIndex} onRemove={removePick} />

        {matchingRecipes.length ? (
          <RecipeRail
            title="Buna benzeyen tarifler"
            hint={`Seçtiğin malzemeleri kullanan ${matchingRecipes.length} tarif`}
            recipes={matchingRecipes.map((m) => m.recipe)}
          />
        ) : null}

        {suggestions.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="bodyStrong">Bu role bağlı malzeme kalmadı.</Text>
            <Text variant="caption" tone="muted">
              Seçtiklerinle kimyasal, tat ya da geleneksel bağı olan aday bulunamadı.
              Bu adımı geçebilirsin.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {suggestions.map((s) => {
              const chosen = stepPicks.some((p) => p.ingredient.id === s.ingredient.id);
              return (
                <PickCard key={s.ingredient.id} suggestion={s} selected={chosen}
                  onPress={() => {
                    if (chosen) removePick(s.ingredient.id);
                    else if (canPickMore) {
                      addPick({
                        ingredient: s.ingredient,
                        grams: s.suggestedGrams,
                        role: step.roles[0] as IngredientRole,
                        stepId: step.id,
                      });
                    }
                  }} />
              );
            })}
          </View>
        )}
      </Screen>
    );
  }

  // ── Bileşen ekleme ────────────────────────────────────────────────
  if (phase === 'bilesen') {
    const used = new Set(components.map((c) => c.planId));
    const available = COMPONENT_ORDER.filter((p) => p !== 'ana' && !used.has(p));

    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="+" eyebrow="Tabak" question="Başka bir bileşen ekleyelim mi?"
          hint="Her bileşen ayrı hazırlanıyor ve kendi tat hedefiyle dengeleniyor." />

        <ComponentStrip components={components} activeIndex={-1} />

        <View style={styles.list}>
          {available.map((p) => (
            <OptionCard key={p} title={COMPONENT_PLANS[p].labelTr}
              description={COMPONENT_PLANS[p].hintTr}
              onPress={() => {
                setPendingPlan(p);
                setPhase('bilesen-hedef');
              }} />
          ))}
          <OptionCard title="Bu kadar yeter" description="Tabağı tamamla ve tarifi gör"
            onPress={() => setPhase('ozet')} />
        </View>
      </Screen>
    );
  }

  // ── Yeni bileşenin hedefi ─────────────────────────────────────────
  if (phase === 'bilesen-hedef' && pendingPlan) {
    const p = COMPONENT_PLANS[pendingPlan];
    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="+" eyebrow={p.labelTr} question="Nasıl bir sos/garnitür?"
          hint="Bu bileşen kendi hedefiyle dengelenecek; ana yemek yalnızca aroma uyumuna girecek." />
        <View style={styles.list}>
          {p.archetypes.map((a) => (
            <OptionCard key={a} title={ARCHETYPES[a].labelTr}
              description={ARCHETYPES[a].description}
              onPress={() => startComponent(pendingPlan, a)} />
          ))}
        </View>
      </Screen>
    );
  }

  // ── Özet — tarif biçiminde ────────────────────────────────────────
  return (
    <Screen
      progress={1}
      footer={
        <View style={styles.footerRow}>
          <View style={styles.footerBack}>
            <Button label="Geri" variant="quiet" onPress={goBack} />
          </View>
          <View style={styles.footerNext}>
            <Button label="Yeniden kur" variant="secondary" onPress={reset} />
          </View>
        </View>
      }>
      <Head index="✓" eyebrow="Tarifin hazır"
        question={components[0]?.picks[0]?.ingredient.nameTr ?? 'Tabak'}
        hint={`${components.length} bileşen · ${components.reduce((n, c) => n + c.picks.length, 0)} malzeme`}
        ingredient={components[0]?.picks[0]?.ingredient} />

      {components.map((c, i) => {
        const p = COMPONENT_PLANS[c.planId];
        return (
          <View key={i} style={styles.card}>
            <Eyebrow index={String(i + 1).padStart(2, '0')}>
              {`${COMPONENT_LABELS_TR[p.kind]} · ${ARCHETYPES[c.archetypeId].labelTr}`}
            </Eyebrow>
            <Text variant="caption" tone="muted">
              {METHOD_LABELS_TR[p.method]}
            </Text>
            {c.picks.map((pick) => (
              <View key={pick.ingredient.id} style={styles.row}>
                <IngredientAvatar ingredient={pick.ingredient} size={30} />
                <Text variant="body" style={styles.rowName}>
                  {pick.ingredient.nameTr}
                </Text>
                <Text variant="label" tone="muted" style={tabularNums}>
                  {pick.grams} g
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {matchingRecipes.length ? (
        <RecipeRail
          title="Buna en çok benzeyen tarifler"
          hint="Kurduğun malzemeleri paylaşan, adımları yazılı tarifler"
          recipes={matchingRecipes.map((m) => m.recipe)}
        />
      ) : (
        <Text variant="caption" tone="muted">
          Kurduğun kombinasyonu paylaşan hazır tarif bulunamadı — özgün bir tabak kurmuşsun.
        </Text>
      )}

      <Text variant="caption" tone="muted">
        Lab kompozisyonu kuruyor; pişirme adımları hazır tariflerden gelir.
      </Text>
    </Screen>
  );
}

/** Kurulan bileşenler ve içindekiler; aktif olan vurgulu. */
function ComponentStrip({
  components,
  activeIndex,
  onRemove,
}: {
  components: LabComponent[];
  activeIndex: number;
  onRemove?: (id: number) => void;
}) {
  if (!components.length) return null;
  return (
    <View style={styles.strip}>
      {components.map((c, i) => {
        const plan = COMPONENT_PLANS[c.planId];
        const isActive = i === activeIndex;
        return (
          <View key={i} style={styles.stripBlock}>
            <Eyebrow tone={isActive ? 'brand' : 'muted'}>
              {`${COMPONENT_LABELS_TR[plan.kind]}${isActive ? ' · şu an' : ''}`}
            </Eyebrow>
            <View style={styles.chipRow}>
              {c.picks.length === 0 ? (
                <Text variant="caption" tone="muted">
                  henüz boş
                </Text>
              ) : (
                c.picks.map((p, idx) => (
                  <Chip key={p.ingredient.id} label={p.ingredient.nameTr} meta={`${p.grams} g`}
                    ingredient={p.ingredient}
                    onRemove={
                      isActive && onRemove && !(i === 0 && idx === 0)
                        ? () => onRemove(p.ingredient.id)
                        : undefined
                    } />
                ))
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Head({
  question,
  ingredient,
}: {
  index?: string;
  eyebrow?: string;
  question: string;
  hint?: string;
  ingredient?: Ingredient;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        {ingredient ? <IngredientAvatar ingredient={ingredient} size={48} /> : null}
        <View style={styles.headBody}>
          <Text variant="display" tone="brandDeep" style={{ fontSize: 32, lineHeight: 36, marginBottom: 8 }}>
            {question}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.md, paddingBottom: spacing.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: 3 },
  list: { gap: spacing.sm },
  strip: { gap: spacing.md },
  stripBlock: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  footerBack: { width: 104 },
  footerNext: { flex: 1 },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  rowName: { flex: 1 },
  empty: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
