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
import { COMPONENT_LABELS_TR, METHOD_LABELS_TR, type CookMethod } from '@/data/recipes';
import type {
  ArchetypeId,
  DishComponent,
  DishState,
  Ingredient,
  IngredientRole,
  Suggestion,
} from '@/engine';
import { ARCHETYPES, CHAIN_WEIGHTS, ROLE_LABELS_TR, suggestAdditions } from '@/engine';
import {
  CHARACTER_BY_ARCHETYPE,
  TASTES,
  TASTE_BY_ID,
  bodiesFor,
  planFor,
  COMPONENT_ORDER,
  COMPONENT_PLANS,
  MAIN_GROUPS,
  MAIN_GROUP_BY_ID,
  type ComponentPlanId,
  type MainGroup,
} from '@/lib/lab-flow';
import { recipesForPicks } from '@/lib/recipe-filter';
import { buildLabRecipe, findGap, type LabComponentLite } from '@/lib/lab-tarif';
import { suggestForStep } from '@/lib/lab-oneri';
import { nutritionOf } from '@/lib/recipe-facts';
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
  /**
   * Pişirme yöntemi. Planın varsayılanıyla başlıyor ama karakter seçimi
   * söylüyorsa ona dönüyor — "Izgara ve mangal" seçen kişinin tabağı
   * tavada pişemez.
   */
  method: CookMethod;
  picks: LabPick[];
  stepIndex: number;
}

/** Karakterin söylediği yöntem varsa o, yoksa planın kendi yöntemi. */
const methodFor = (planId: ComponentPlanId, archetypeId: ArchetypeId): CookMethod =>
  CHARACTER_BY_ARCHETYPE.get(archetypeId)?.method ?? COMPONENT_PLANS[planId].method;

type Phase = 'grup' | 'ana' | 'tat' | 'govde' | 'rol' | 'bilesen' | 'bilesen-hedef' | 'ozet';

export default function LabScreen() {
  const params = useLocalSearchParams<{ grup?: string; slugs?: string; ana?: string }>();

  const [phase, setPhase] = useState<Phase>('grup');
  /**
   * Seçilen tat. Gövde seçenekleri buna göre daralıyor ve sos bileşeninin
   * gerekip gerekmediğini bu belirliyor.
   */
  const [tasteId, setTasteId] = useState<string | null>(null);
  /** Ana yemek bitince otomatik açılacak sos hedefi. */
  const [pendingSauce, setPendingSauce] = useState<ArchetypeId | null>(null);
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

  /**
   * Denge hesabında 4× ağırlık alan eksenler.
   *
   * Eskiden bunlar arketipten geliyordu ve kullanıcının tat seçiminin aday
   * havuzuna hiçbir etkisi yoktu — ölçüldü, dört karakter de neredeyse aynı
   * altı malzemeyi öneriyordu. Artık doğrudan tat cevabından geliyor:
   * "tatlı-ekşi" diyen kişinin sosunda tatlılık ve ekşilik eksenleri ağır
   * basıyor, "acılı" diyenin ana yemeğinde acılık.
   */
  const focusAxes = tasteId ? TASTE_BY_ID.get(tasteId)?.focusAxes : character?.focusAxes;

  /**
   * Tabağın ana malzemesi — uyum tablosunun çıpası.
   *
   * Uyum, seçilenlerin tamamına değil ana malzemeye göre hesaplanıyor:
   * "antrikotun kurduğu türden yemeklerde bu malzeme geçiyor mu?" Zincir
   * kuralı bunu yakalayamıyordu çünkü tereyağı evrensel bir bağlayıcı ve
   * her şey onun üzerinden listeye giriyordu — tarhana dâhil.
   */
  const mainSlug = components[0]?.picks.find((p) => p.role === 'ana')?.ingredient.slug;

  const stepPicks = active?.picks.filter((p) => p.stepId === step?.id) ?? [];

  const suggestions = useMemo(() => {
    if (phase !== 'rol' || !active || !step) return [];
    return suggestForStep({
      dish,
      step,
      stepPicks,
      mainSlug,
      cuisine: 'tr',
      focusAxes,
      anchorIngredientId: lastPick?.ingredient.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active, step, dish, lastPick, focusAxes, mainSlug, stepPicks.length]);

  /**
   * Adayı ikiden az olan küme sessizce atlanıyor.
   *
   * Levrek + "sade" akışında baharat adımında **tek aday** kalıyordu ve o da
   * gochujang'dı — uyum vetosu diğerlerini elemiş, geriye Kore biber ezmesi
   * kalmıştı. Tek seçenekli bir adım zaten soru değil.
   */
  /**
   * `active` ve `step` yokken `suggestions` zaten boş dönüyor; o anı "aday
   * yok" sanıp adımı atlarsak ekranlar zincirleme atlanıyor ve kullanıcı
   * doğrudan özete düşüyor. İlk hâli tam olarak bunu yapıyordu — dört
   * kümenin dördü de atlandı. Koşula açıkça ikisini de ekliyoruz.
   */
  const stepTooThin =
    phase === 'rol' && Boolean(active) && Boolean(step) && stepPicks.length === 0 && suggestions.length < 2;
  useEffect(() => {
    if (stepTooThin) advanceStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepTooThin, step?.id, activeIndex]);

  /** Kurulan tabağın gerçek dünyadaki karşılıkları — her adımda güncelleniyor. */
  const allPickedSlugs = components.flatMap((c) => c.picks.map((p) => p.ingredient.slug));
  const matchingRecipes = useMemo(
    () => recipesForPicks(allPickedSlugs, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPickedSlugs.join(',')],
  );

  /**
   * Kurulan tabağın kendi yapılışı.
   *
   * Lab yeni bir yemek kurduruyor; o yemeğin tarifi hiçbir korpusta yok
   * çünkü kullanıcı onu az önce icat etti. Adımlar bileşenin yöntemi ve
   * her seçimin rolünden üretiliyor (`lab-tarif.ts`).
   */
  const labComponents: LabComponentLite[] = components.map((c) => ({
    kind: COMPONENT_PLANS[c.planId].kind,
    method: c.method,
    archetypeId: c.archetypeId,
    picks: c.picks.map((p) => ({ ingredient: p.ingredient, grams: p.grams, role: p.role })),
  }));
  const built = useMemo(
    () => buildLabRecipe(labComponents, 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPickedSlugs.join(','), components.map((c) => c.archetypeId).join(',')],
  );

  /**
   * Hedefe ulaşıldı mı? Kullanıcı "tatlı ekşi" seçip düz bir et kurduysa
   * o tabak tek başına hedefe ulaşamaz — bir sos gerekiyor ve bunu
   * söylemek gerekiyor.
   */
  const gap = useMemo(
    () =>
      built && active
        ? findGap(built.profile, active.archetypeId, components.some((c) => COMPONENT_PLANS[c.planId].kind === 'sos'))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [built?.profile, active?.archetypeId, components.length],
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
        method: methodFor('ana', 'doyurucu-derin'),
        stepIndex: 0,
        picks: [{ ingredient: main, grams: 250, role: 'ana', stepId: 'ana' }],
      },
    ]);
    setActiveIndex(0);
    setTasteId(null);
    setPhase('tat');
  }

  /**
   * Tat ve gövde cevaplarını tek plana çevirip uyguluyor.
   *
   * Sos gerekiyorsa hemen açılmıyor: önce ana yemek kuruluyor, ana yemeğin
   * adımları bitince sos bileşeni kendiliğinden devreye giriyor. Sıra
   * önemli — sosun hedefi ana yemeğin yağını kesmek ve motor bunu
   * `pairedWith` üzerinden hesaplıyor, yani sos kurulurken ana yemeğin
   * içeriği bilinmek zorunda.
   */
  const applyPlan = (tid: string, bodyId: string) => {
    const p = planFor(tid, bodyId);
    if (!p) return;
    setComponents((prev) =>
      prev.map((c, i) =>
        i === 0 ? { ...c, archetypeId: p.mainArchetype, method: p.method } : c,
      ),
    );
    setPendingSauce(p.sauceArchetype ?? null);
    setPhase('rol');
  };

  const setArchetype = (id: ArchetypeId) =>
    setComponents((prev) =>
      prev.map((c, i) =>
        i === activeIndex ? { ...c, archetypeId: id, method: methodFor(c.planId, id) } : c,
      ),
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
    } else if (pendingSauce && activeIndex === 0) {
      /**
       * Tat seçimi sos gerektiriyordu; "başka bileşen ekleyelim mi?" diye
       * sormuyoruz çünkü seçenek yok — o tada başka türlü ulaşılmıyor.
       */
      startComponent('sos', pendingSauce);
      setPendingSauce(null);
    } else {
      setPhase('bilesen');
    }
  };

  const startComponent = (planId: ComponentPlanId, archetypeId: ArchetypeId) => {
    setComponents((prev) => [
      ...prev,
      { planId, archetypeId, method: methodFor(planId, archetypeId), stepIndex: 0, picks: [] },
    ]);
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
    setTasteId(null);
    setPendingSauce(null);
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
    } else if (phase === 'rol') setPhase(activeIndex === 0 ? 'govde' : 'bilesen');
    else if (phase === 'govde') setPhase('tat');
    else if (phase === 'tat') setPhase('ana');
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
                  source={{ uri: `https://loremflickr.com/100/100/ingredient,food?random=${g.id}` }}
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
  // ── 03 · Tat ──────────────────────────────────────────────────────
  if (phase === 'tat' && active) {
    const main = active.picks[0]?.ingredient;
    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="03" eyebrow={main?.nameTr ?? 'Tat'} question="Nasıl bir tat olsun?"
          hint="Bu seçim yemeğin ne olacağını belirliyor — bazı tatlar yanına bir sos gerektiriyor."
          ingredient={main} />
        <View style={styles.list}>
          {TASTES.map((t) => (
            <OptionCard key={t.id} title={t.labelTr} description={t.hintTr}
              selected={tasteId === t.id}
              onPress={() => {
                setTasteId(t.id);
                setPhase('govde');
              }} />
          ))}
        </View>
      </Screen>
    );
  }

  // ── 04 · Gövde ────────────────────────────────────────────────────
  if (phase === 'govde' && active && tasteId) {
    const main = active.picks[0]?.ingredient;
    const taste = TASTE_BY_ID.get(tasteId);
    return (
      <Screen progress={progress} footer={<Button label="Geri" variant="quiet" onPress={goBack} />}>
        <Head index="04" eyebrow={taste?.labelTr ?? ''} question="Nasıl bir yemek olsun?"
          hint="Bu seçim pişirme yöntemini belirliyor." ingredient={main} />

        {/**
          * Sos gerekiyorsa burada söyleniyor. Sorulmuyor çünkü seçenek yok:
          * et kendi başına tatlı-ekşi ya da kremalı olamaz, o tada başka
          * türlü ulaşılmıyor.
          */}
        {taste?.sauce ? (
          <View style={styles.gapCard}>
            <Eyebrow index="+">Yanına sos</Eyebrow>
            <Text variant="body" style={{ lineHeight: 21 }}>
              {`${taste.labelTr.replace(' olsun', '')} bir tabak için ana malzemenin yanına bir sos kurulacak — ` +
                'ana yemeği seçtikten sonra sosun malzemelerini de birlikte seçeceğiz.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {bodiesFor(tasteId).map((b) => (
            <OptionCard key={b.id} title={b.labelTr} description={b.hintTr}
              onPress={() => applyPlan(tasteId, b.id)} />
          ))}
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

        {gap?.suggestKind ? (
          <View style={styles.gapCard}>
            <Eyebrow index="!">Hedefe ulaşmak için</Eyebrow>
            <Text variant="body" style={{ lineHeight: 21 }}>
              {gap.messageTr}
            </Text>
          </View>
        ) : null}

        {matchingRecipes.length ? (
          <RecipeRail
            title={matchingRecipes[0].level === 'tam' ? 'Buna benzeyen tarifler' : 'Yakın tarifler'}
            hint={
              matchingRecipes[0].level === 'tam'
                ? `Seçtiğin malzemeleri kullanan ${matchingRecipes.length} tarif`
                : matchingRecipes[0].level === 'akraba'
                  ? 'Bu malzemenin hazır tarifi yok; en yakın akrabasının tarifleri'
                  : 'Bu malzemenin hazır tarifi yok; aynı türden tarifler'
            }
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
                        role: s.slotRole,
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
              {METHOD_LABELS_TR[c.method]}
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

      {/**
        * Kurduğun tabağın yapılışı. Hazır bir tariften kopyalanmıyor —
        * bileşenin yöntemi ve her malzemenin rolünden üretiliyor.
        */}
      {built ? (
        <View style={styles.card}>
          <Eyebrow index="→">Nasıl yapılır</Eyebrow>
          <Text variant="bodyStrong" style={{ fontSize: 20, marginBottom: 4 }}>
            {built.recipe.title}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
            {built.recipe.totalMinutes} dakika · {built.recipe.servings} kişilik ·
            {' '}
            {nutritionOf(built.recipe).kcal} kcal (porsiyon başına tahmini)
          </Text>

          {built.recipe.components.map((comp, ci) => (
            <View key={ci} style={{ marginTop: ci ? 20 : 0 }}>
              {built.recipe.components.length > 1 ? (
                <Text variant="label" style={styles.stepGroup}>
                  {`${COMPONENT_LABELS_TR[comp.kind].toLocaleUpperCase('tr-TR')} · ${comp.title}`}
                </Text>
              ) : null}
              {comp.steps.map((st, si) => (
                <View key={si} style={styles.stepRow}>
                  <Text variant="label" tone="muted" style={styles.stepNo}>
                    {si + 1}
                  </Text>
                  <Text variant="body" style={styles.stepText}>
                    {st}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          {gap && !gap.suggestKind ? (
            <Text variant="caption" tone="muted" style={{ marginTop: 14, lineHeight: 18 }}>
              {gap.messageTr}
            </Text>
          ) : null}
        </View>
      ) : null}

      {matchingRecipes.length ? (
        <RecipeRail
          title="Yakın duran hazır tarifler"
          hint={
            matchingRecipes[0].level === 'tam'
              ? 'Kurduğun malzemeleri paylaşan tarifler — karşılaştırmak istersen'
              : 'Birebir eşleşen tarif yok; en yakın duranlar'
          }
          recipes={matchingRecipes.map((m) => m.recipe)}
        />
      ) : null}
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
  gapCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fdf6ec',
    borderWidth: 1,
    borderColor: '#e8d9bd',
    gap: 8,
    marginBottom: 8,
  },
  stepGroup: { marginBottom: 8, letterSpacing: 0.6 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNo: { minWidth: 18, paddingTop: 2 },
  stepText: { flex: 1, lineHeight: 22 },
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
