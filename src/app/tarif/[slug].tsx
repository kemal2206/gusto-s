import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Drumstick,
  Flame,
  Share2,
  ShoppingBasket,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { formatGrams, measureTolerances, toHouseholdMeasure } from '@/data/catalog/ev-olcusu';
import {
  CATEGORY_BY_ID,
  COMPONENT_LABELS_TR,
  CUISINE_LABELS_TR,
  METHOD_LABELS_TR,
  RECIPE_BY_SLUG,
} from '@/data/recipes';
import { eaterCount } from '@/lib/profile-model';
import { scaleFactor, scaleGrams } from '@/lib/profile-filter';
import { allergensOf, nutritionOf, tagsOf, utensilsOf } from '@/lib/recipe-facts';
import { useFavorites } from '@/lib/store/favorites';
import { useGrocery } from '@/lib/store/grocery';
import { useCookbook } from '@/lib/store/cookbook';
import { useHistory } from '@/lib/store/history';
import { useProfile } from '@/lib/store/profile';
import { spacing } from '@/theme/tokens';

/**
 * Tarif detayı.
 *
 * Düzen ve renkler arayüz tasarımından; içerik tamamen tarifin kendi
 * verisinden geliyor. Sabit yazılmış sayı yok:
 *  - kalori/protein  → malzeme gramajlarından hesaplanıyor (tahmini)
 *  - etiketler       → süre, zorluk, kategori, diyet uygunluğu
 *  - alerjenler      → malzemelerin alerjen etiketlerinden
 *  - gereçler        → bileşenlerin pişirme yöntemlerinden
 *
 * Kaldırılanlar: "My cookbook photos" ve "Add a photo" — fotoğraf saklama
 * altyapımız yok, çalışmayan düğme göstermek yerine bölümü çıkardım.
 */

const SAND = '#fbf9f6';
const SAND_DEEP = '#f5f0e6';
const TAG_BG = '#f0e6d2';
const LINE = '#ddd';
const INK = '#111';

export default function RecipeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recipe = RECIPE_BY_SLUG.get(slug ?? '');

  const saved = useFavorites((s) => (slug ? s.slugs.includes(slug) : false));
  const toggleSave = useFavorites((s) => s.toggle);
  const addGrocery = useGrocery((s) => s.addMany);
  const logDish = useHistory((s) => s.logDish);
  const markCooked = useCookbook((s) => s.markCooked);

  const [openNutrition, setOpenNutrition] = useState(false);
  const [openUtensils, setOpenUtensils] = useState(false);
  const [openIngredients, setOpenIngredients] = useState(true);
  const [openSteps, setOpenSteps] = useState(true);
  const [addedToList, setAddedToList] = useState(false);
  const [cooked, setCooked] = useState(false);

  if (!recipe) {
    return (
      <View style={styles.missing}>
        <Text variant="bodyStrong">Tarif bulunamadı.</Text>
        <Button label="Geri" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const imageUrl = `https://loremflickr.com/800/600/food,meal,dish?random=${recipe.slug}`;
  const category = CATEGORY_BY_ID.get(recipe.categoryId);
  const nutrition = nutritionOf(recipe);
  const allergens = allergensOf(recipe);
  const tags = tagsOf(recipe);
  const utensils = utensilsOf(recipe);
  const multi = recipe.components.length > 1;

  /**
   * Miktarlar hanenin kişi sayısına göre ölçekleniyor. Baharat doğrusal
   * artmıyor (`scaleGrams`): 4 kişilik tarifi 8 kişiye çıkarırken karabiberi
   * ikiye katlamak yemeği acıtır.
   */
  const household = useProfile((s) => s.household);
  const people = eaterCount(household);
  const factor = scaleFactor(recipe, household);
  const scaled = (slug: string, grams: number) =>
    Math.abs(factor - 1) < 0.05 ? grams : scaleGrams(slug, grams, factor);

  /**
   * Her satırın kendi yuvarlama toleransı.
   *
   * Tabakta ağırlığı olan ve tadı baskın malzemede dar, kenarda kalanda
   * geniş. Toleransı aşan ölçü gösterilmiyor: "yarım limonun suyu"na
   * "1 adet limon" demek ekşiliği ikiye katlar.
   */
  const tolerances = useMemo(
    () =>
      measureTolerances(
        recipe.components.flatMap((c) =>
          c.ingredients.flatMap((ri) => {
            const ing = BY_SLUG.get(ri.slug);
            return ing
              ? [{ slug: ri.slug, grams: ri.grams, potency: ing.potency, taste: ing.taste }]
              : [];
          }),
        ),
      ),
    [recipe],
  );

  const allIngredients = recipe.components.flatMap((c) =>
    c.ingredients.map((i) => ({
      ...i,
      grams: scaled(i.slug, i.grams),
      component: c.title,
      kind: c.kind,
    })),
  );

  const subtitle = multi
    ? `${recipe.components.map((c) => c.title).join(' + ')}`
    : `${category?.labelTr ?? ''} · ${CUISINE_LABELS_TR[recipe.cuisine]} mutfağı`;

  const onShare = () =>
    Share.share({
      message: `${recipe.title} — ${recipe.totalMinutes} dakika, ${recipe.servings} kişilik.\n\n${recipe.summary}`,
    }).catch(() => {
      /* kullanıcı vazgeçti */
    });

  const onAddGrocery = () => {
    addGrocery(
      recipe.title,
      allIngredients.map((i) => ({ slug: i.slug, grams: i.grams })),
    );
    setAddedToList(true);
  };

  const onCooked = () => {
    const main = recipe.components[0]?.ingredients[0];
    if (main) {
      logDish({ mainSlug: main.slug, groupId: recipe.categoryId, archetypeId: '' });
    }
    // Yemek kitabındaki "daha önce yaptıkların" zaman çizelgesi buradan besleniyor.
    markCooked(recipe.slug);
    setCooked(true);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: SAND }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 40 }}>
        
        {/* ── Kapak ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Image source={{ uri: imageUrl }} style={styles.heroImage} />
          <View style={[styles.heroActions, { top: Math.max(insets.top, 20) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => router.back()}
              style={styles.iconButton}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tarifi paylaş"
              onPress={onShare}
              style={styles.iconButton}>
              <Share2 color="#fff" size={20} />
            </Pressable>
          </View>
        </View>

        <View style={{ padding: spacing.xl }}>
          {/* ── Başlık ─────────────────────────────────────────── */}
          <Text variant="display" style={styles.title}>
            {recipe.title}
          </Text>
          <Text variant="body" style={styles.subtitle}>
            {subtitle}
          </Text>

          {/* ── Süre · kalori · protein ────────────────────────── */}
          <View style={styles.metaRow}>
            <Meta label="Toplam süre" icon={<Clock size={16} color={INK} />}>
              {`${recipe.totalMinutes} dk`}
            </Meta>
            <Meta label="Kalori" icon={<Flame size={16} color={INK} />}>
              {`${nutrition.kcal} kcal`}
            </Meta>
            <Meta label="Protein" icon={<Drumstick size={16} color={INK} />}>
              {`${nutrition.protein} g`}
            </Meta>
          </View>
          <Text variant="caption" style={styles.metaNote}>
            Porsiyon başına, malzeme gramajlarından hesaplanan tahmini değer.
          </Text>

          {/* ── Etiketler ──────────────────────────────────────── */}
          <View style={styles.tagRow}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text variant="caption" style={styles.tagText}>
                  {t}
                </Text>
              </View>
            ))}
          </View>

          {/* ── Kaydet / listeye ekle ──────────────────────────── */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              onPress={() => toggleSave(recipe.slug)}
              style={styles.outlineButton}>
              <Bookmark size={18} color={INK} fill={saved ? INK : 'transparent'} />
              <Text variant="button" style={styles.outlineText}>
                {saved ? 'Kaydedildi' : 'Kaydet'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alışveriş listesine ekle"
              onPress={onAddGrocery}
              style={styles.outlineIcon}>
              {addedToList ? <Check size={18} color={INK} /> : <ShoppingBasket size={18} color={INK} />}
            </Pressable>
          </View>

          {/* ── Açıklama ───────────────────────────────────────── */}
          <View style={{ marginTop: 24 }}>
            <Text variant="h3" style={styles.sectionTitle}>
              Bu tarif hakkında
            </Text>
            <Text variant="body" style={styles.body}>
              {recipe.summary}
            </Text>

            {allergens.length ? (
              <Text variant="h3" style={styles.allergenTitle}>
                Alerjen{' '}
                <Text style={styles.allergenBody}>{allergens.join(', ')}</Text>
              </Text>
            ) : (
              <Text variant="caption" style={styles.note}>
                Malzemelerinde bilinen alerjen yok.
              </Text>
            )}
          </View>

          {/* ── Malzemeler ─────────────────────────────────────── */}
          <View style={{ marginTop: 32 }}>
            <Accordion
              title={`Malzemeler · ${people} kişilik`}
              open={openIngredients}
              onToggle={() => setOpenIngredients((v) => !v)}
              titleStyle={styles.malzemelerTitle}
            />

            {openIngredients
              ? recipe.components.map((c, ci) => (
                  <View key={ci}>
                    {multi ? (
                      <Text variant="label" style={styles.componentLabel}>
                        {`${COMPONENT_LABELS_TR[c.kind].toLocaleUpperCase('tr-TR')} · ${c.title}`}
                      </Text>
                    ) : null}
                    {c.ingredients.map((ri, idx) => {
                      const ing = BY_SLUG.get(ri.slug);
                      if (!ing) return null;
                      return (
                        <View key={`${ri.slug}-${idx}`} style={styles.ingRow}>
                          <IngredientAvatar ingredient={ing} size={44} />
                          <View style={{ flex: 1 }}>
                            <Text variant="bodyStrong" style={styles.ingName}>
                              {ing.nameTr}
                            </Text>
                            {/**
                              * Ev ölçüsü varsa o öne çıkıyor, gram yanında
                              * soluk duruyor: tartısı olmayan kaşığı okuyor,
                              * olan gramı. Ölçülemeyen malzemede yalnızca gram.
                              */}
                            <Text variant="body" style={styles.ingAmount}>
                              {householdOf(
                                ri.slug,
                                ing.category,
                                scaled(ri.slug, ri.grams),
                                tolerances.get(ri.slug),
                              )}
                              {ri.note ? ` · ${ri.note}` : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              : null}

            <Pressable
              accessibilityRole="button"
              onPress={onAddGrocery}
              style={[styles.wideButton, { backgroundColor: SAND }]}>
              <View style={styles.wideButtonInner}>
                {addedToList ? <Check size={18} color={INK} /> : <ShoppingBasket size={18} color={INK} />}
                <Text style={styles.wideButtonText}>
                  {addedToList ? 'Listeye eklendi' : 'Alışveriş listesine ekle'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Yapılışı ───────────────────────────────────────────── */}
        <View style={styles.stepsBlock}>
          <Accordion
            title="Yapılışı"
            open={openSteps}
            onToggle={() => setOpenSteps((v) => !v)}
          />

          {openSteps
            ? recipe.components.map((c, ci) => (
                <View key={ci}>
                  {multi ? (
                    <Text variant="label" style={styles.componentLabel}>
                      {`${COMPONENT_LABELS_TR[c.kind].toLocaleUpperCase('tr-TR')} · ${c.title} — ${METHOD_LABELS_TR[c.method]}, ${c.minutes} dk`}
                    </Text>
                  ) : null}
                  {c.steps.map((stepText, idx) => (
                    <View key={idx} style={styles.stepRow}>
                      <View style={styles.stepNo}>
                        <Text style={styles.stepNoText}>{String(idx + 1)}</Text>
                      </View>
                      <Text style={styles.stepText}>{stepText}</Text>
                    </View>
                  ))}
                </View>
              ))
            : null}

          <Pressable
            accessibilityRole="button"
            onPress={onCooked}
            style={[styles.wideButton, { backgroundColor: SAND_DEEP }]}>
            <View style={styles.wideButtonInner}>
              {cooked ? <Check size={18} color={INK} /> : null}
              <Text style={styles.wideButtonText}>
                {cooked ? 'Pişirdin — mutfağına eklendi' : 'Bunu pişirdim'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ── Besin değerleri ve gereçler ────────────────────────── */}
        <View style={{ padding: spacing.xl, gap: 16 }}>
          <Accordion
            title="Besin değerleri"
            open={openNutrition}
            onToggle={() => setOpenNutrition((v) => !v)}
            bordered
          />
          {openNutrition ? (
            <View style={{ gap: 10, paddingBottom: 8 }}>
              <NutritionRow label="Kalori" value={`${nutrition.kcal} kcal`} />
              <NutritionRow label="Protein" value={`${nutrition.protein} g`} />
              <NutritionRow label="Karbonhidrat" value={`${nutrition.carbs} g`} />
              <NutritionRow label="Yağ" value={`${nutrition.fat} g`} />
              <Text variant="caption" style={styles.note}>
                Porsiyon başına. Malzeme gramajları ile 100 g başına referans değerlerden
                hesaplandı; pişirme kaybı ve yağ emilimi hesaba katılmadı.
              </Text>
            </View>
          ) : null}

          <Accordion
            title="Gerekli gereçler"
            open={openUtensils}
            onToggle={() => setOpenUtensils((v) => !v)}
            bordered
          />
          {openUtensils ? (
            <View style={styles.utensilWrap}>
              {utensils.map((u) => (
                <View key={u} style={styles.utensil}>
                  <Text variant="caption" style={styles.tagText}>
                    {u}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Küçük parçalar ───────────────────────────────────────────────

function Meta({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: string;
}) {
  return (
    <View>
      <Text variant="label" style={styles.metaLabel}>
        {label}
      </Text>
      <View style={styles.metaValue}>
        {icon}
        <Text variant="bodyStrong" style={styles.metaValueText}>
          {children}
        </Text>
      </View>
    </View>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  bordered,
  titleStyle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  titleStyle?: any;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={[styles.accordion, bordered && styles.accordionBordered]}>
      <Text style={[styles.accordionTitle, titleStyle]}>{title}</Text>
      {open ? <ChevronUp size={20} color={INK} /> : <ChevronDown size={20} color={INK} />}
    </Pressable>
  );
}

function NutritionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutritionRow}>
      <Text variant="body" style={{ color: '#333' }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ color: INK }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Malzeme miktarının ekrandaki hâli.
 *
 * Çoğu evde hassas tartı yok; "45 g un" yerine "3,5 yemek kaşığı un · 45 g"
 * yazıyoruz. Kaşıkla ölçülemeyen malzeme (et, balık, peynir) gramda kalıyor —
 * "3 çay bardağı tavuk" diye bir şey yok.
 */
function householdOf(
  slug: string,
  category: string,
  grams: number,
  maxDrift?: number,
): string {
  const m = toHouseholdMeasure(slug, category, grams, maxDrift);
  return m ? `${m.text}  ·  ${formatGrams(grams)}` : formatGrams(grams);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },
  missing: { flex: 1, backgroundColor: SAND, alignItems: 'center', justifyContent: 'center' },

  hero: { width: '100%', height: 320, backgroundColor: '#eaddd7' },
  heroImage: { width: '100%', height: '100%' },
  heroActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { fontSize: 40, lineHeight: 46, fontFamily: 'ShadowsIntoLight_400Regular', color: INK },
  subtitle: { fontSize: 17, marginTop: 8, color: '#555' },

  metaRow: { flexDirection: 'row', gap: 24, marginTop: 24, flexWrap: 'wrap' },
  metaLabel: { fontWeight: '700', color: INK, fontSize: 13 },
  metaValue: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaValueText: { color: INK, fontSize: 15 },
  metaNote: { marginTop: 10, color: '#777', lineHeight: 17 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  tag: { backgroundColor: TAG_BG, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  tagText: { color: '#444', fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  outlineText: { color: INK, fontWeight: '700' },
  outlineIcon: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },

  sectionTitle: { fontWeight: '800', marginBottom: 12, fontSize: 18, color: INK },
  body: { color: '#333', lineHeight: 22 },
  allergenTitle: { fontWeight: '800', marginTop: 20, fontSize: 16, color: INK },
  allergenBody: { fontWeight: '400', fontSize: 15, color: '#333' },
  note: { marginTop: 12, lineHeight: 18, color: '#666' },

  componentLabel: {
    marginTop: 16,
    marginBottom: 10,
    color: '#8a6a4a',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  ingName: { fontSize: 16, color: INK, fontWeight: '800' },
  ingAmount: { color: '#555', fontSize: 15, marginTop: 2 },

  wideButton: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  wideButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wideButtonText: { fontWeight: '800', fontSize: 15, color: INK },

  stepsBlock: { backgroundColor: SAND_DEEP, padding: spacing.xl, marginTop: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2b2b2b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNoText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 16, color: '#333', lineHeight: 24 },

  accordion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  accordionBordered: { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: LINE },
  accordionTitle: { fontWeight: '800', fontSize: 18, color: INK },
  malzemelerTitle: { fontFamily: 'ShadowsIntoLight_400Regular', fontSize: 26, fontWeight: '400' },

  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  utensilWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  utensil: { backgroundColor: TAG_BG, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
});
