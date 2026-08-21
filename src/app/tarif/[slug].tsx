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
  Minus,
  Plus,
  Share2,
  ShoppingBasket,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
import { scaleFactorFor, scaleGrams } from '@/lib/profile-filter';
import { allergensOf, nutritionOf, tagsOf, utensilsOf } from '@/lib/recipe-facts';
import { consolidate } from '@/lib/sepet';
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
  const basket = useGrocery((s) => s.items);
  const addGrocery = useGrocery((s) => s.addMany);
  const toggleGrocery = useGrocery((s) => s.toggleOne);
  const removeFromBasket = useGrocery((s) => s.removeRecipe);
  const logDish = useHistory((s) => s.logDish);
  const markCooked = useCookbook((s) => s.markCooked);

  const [openNutrition, setOpenNutrition] = useState(false);
  const [openUtensils, setOpenUtensils] = useState(false);
  const [openIngredients, setOpenIngredients] = useState(true);
  const [openSteps, setOpenSteps] = useState(true);
  const [cooked, setCooked] = useState(false);
  const [basketCleared, setBasketCleared] = useState(false);

  if (!recipe) {
    return (
      <View style={styles.missing}>
        <Text variant="bodyStrong">Tarif bulunamadı.</Text>
        <Button label="Geri" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  /**
   * yemek.com korpusundan gelen tariflerin kendi fotoğrafı var. Diğerlerinde
   * yer tutucu duruyor: konusu yemek olan rastgele bir fotoğraf, tarifin
   * kendisi değil.
   */
  const imageUrl =
    recipe.imageUrl ?? `https://picsum.photos/seed/${recipe.slug}/800/600`;
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

  /**
   * Kişi sayısı hanenin ayarından geliyor ama bu sayfada geçici olarak
   * değiştirilebiliyor: misafir gelmiş ya da biri yokmuş olabilir. Değişiklik
   * yalnızca bu tarife ve bu ziyarete ait — hane ayarına dokunmuyor, çünkü
   * "bu akşam altı kişiyiz" kalıcı bir bilgi değil.
   */
  const [peopleOverride, setPeopleOverride] = useState<number | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const housePeople = eaterCount(household);
  const people = peopleOverride ?? housePeople;

  const factor = scaleFactorFor(recipe, people);
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

  /**
   * Sepet durumu iki ayrı soruya bakıyor ve ikisi de lazım:
   *
   *  - `inBasket` → malzeme sepette mi (hangi tariften geldiği fark etmez)
   *  - `fromHere` → sepete **bu tarif** mi koydu
   *
   * Satırdaki işaret `fromHere`e bakıyor. Sepette olan ama başka tariften
   * gelmiş malzemede satır boş görünüyor, altındaki soluk not durumu söylüyor.
   * İşaret `inBasket`e baksaydı kullanıcı dokunduğunda hiçbir şey
   * değişmiyormuş gibi görünürdü — ekleme sessizce yapılmış olurdu.
   */
  const inBasket = new Set(basket.map((i) => i.slug));
  const fromHere = new Set(
    basket.filter((i) => i.sources.some((s) => s.recipe === recipe.title)).map((i) => i.slug),
  );

  /**
   * Sepet satırları malzeme başına tek ve su dışarıda (bkz. `lib/sepet.ts`).
   *
   * Tekilleştirme şart: tarif tereyağını hem sosta hem ana bileşende
   * isteyebiliyor, markette iki kez tereyağı aranmaz. Satıra dokunmak da bu
   * toplamı ekliyor — bu yüzden `totalOf` üzerinden gidiyoruz, satırın kendi
   * gramı üzerinden değil.
   */
  const buyable = consolidate(allIngredients.map((i) => ({ slug: i.slug, grams: i.grams })));
  const totalOf = new Map(buyable.map((b) => [b.slug, b.grams]));
  const missing = buyable.filter((i) => !fromHere.has(i.slug));

  /**
   * Kişi sayısı değişince sepetteki miktarlar da değişiyor.
   *
   * Bu tarifin sepete koyduğu satırlar yeni gramla yeniden yazılıyor;
   * `addMany` aynı tarifin aynı malzemesini toplamıyor, değiştiriyor.
   * Yoksa ekranda "6 kişilik · 360 g soğan" yazarken sepette iki kişilik
   * 120 g duruyor ve satırdaki tik yalan söylüyor.
   *
   * Bağımlılık yalnızca `people`: `fromHere` her dokunuşta yeniden kuruluyor,
   * listeye konursa döngü oluyor. Gram gerçekten değişmediyse hiç yazmıyoruz.
   */
  useEffect(() => {
    const stale = buyable.filter((i) => {
      const source = basket
        .find((b) => b.slug === i.slug)
        ?.sources.find((s) => s.recipe === recipe.title);
      return source ? Math.abs(source.grams - i.grams) > 0.5 : false;
    });
    if (stale.length === 0) return;
    addGrocery(
      recipe.title,
      stale.map((i) => ({ slug: i.slug, grams: i.grams })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  const subtitle = multi
    ? `${recipe.components.map((c) => c.title).join(' + ')}`
    : `${category?.labelTr ?? ''} · ${CUISINE_LABELS_TR[recipe.cuisine]} mutfağı`;

  const onShare = () =>
    Share.share({
      message: `${recipe.title} — ${recipe.totalMinutes} dakika, ${people} kişilik.\n\n${recipe.summary}`,
    }).catch(() => {
      /* kullanıcı vazgeçti */
    });

  /**
   * Alt düğme her dokunuşta ilerliyor: eksik varsa ekliyor, hepsi sepetteyse
   * sepeti açıyor. "Listeye eklendi" yazıp orada donan bir düğme kullanıcıyı
   * çıkmaza sokuyordu — eklediği şeyi görebileceği bir yer yoktu.
   */
  const onAddGrocery = () => {
    if (missing.length === 0) {
      router.push('/sepet');
      return;
    }
    addGrocery(
      recipe.title,
      missing.map((i) => ({ slug: i.slug, grams: i.grams })),
    );
  };

  const onCooked = () => {
    const main = recipe.components[0]?.ingredients[0];
    if (main) {
      logDish({ mainSlug: main.slug, groupId: recipe.categoryId, archetypeId: '' });
    }
    // Yemek kitabındaki "daha önce yaptıkların" zaman çizelgesi buradan besleniyor.
    markCooked(recipe.slug);

    /**
     * Pişirdiysen almışsındır: bu tarifin sepetteki payı düşüyor.
     *
     * Yalnızca bu tarifin payı — aynı soğan başka bir tarif için de sepetteyse
     * satır kalıyor, gramı azalıyor. Kaynakları ayrı tutmanın asıl karşılığı bu.
     * Bir şey düştüyse aşağıda yazıyor; sessizce eksilen liste güven kaybettirir.
     */
    setBasketCleared(fromHere.size > 0);
    removeFromBasket(recipe.title);
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
            {/**
              * Bu simge artık ekleme yapmıyor, sepeti açıyor. Ekleme işi iki
              * yerde: malzeme satırının kendisinde ve alttaki geniş düğmede.
              * Üç ayrı ekleme yolu olması kullanıcıya bir şey kazandırmıyordu;
              * eklediğini görebileceği bir kapı kazandırıyor.
              */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                basket.length ? `Sepetim, ${basket.length} malzeme var` : 'Sepetim, boş'
              }
              onPress={() => router.push('/sepet')}
              style={styles.outlineIcon}>
              <ShoppingBasket size={18} color={INK} />
              {basket.length ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{String(basket.length)}</Text>
                </View>
              ) : null}
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
            {/**
              * Başlık iki ayrı düğme: solu bölümü açıp kapatıyor, sağdaki
              * "… kişilik" kişi sayısını değiştiriyor. Tek düğme olsaydı
              * sayıyı değiştirmek isteyen her dokunuşta bölüm kapanırdı.
              */}
            <View style={styles.ingredientsHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: openIngredients }}
                accessibilityLabel="Malzemeler bölümünü aç kapat"
                onPress={() => setOpenIngredients((v) => !v)}
                style={styles.ingredientsHeaderLeft}>
                <Text style={[styles.accordionTitle, styles.malzemelerTitle]}>Malzemeler</Text>
                {openIngredients ? (
                  <ChevronUp size={20} color={INK} />
                ) : (
                  <ChevronDown size={20} color={INK} />
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${people} kişilik. Kişi sayısını değiştirmek için dokun`}
                onPress={() => setPeopleOpen((v) => !v)}
                style={({ pressed }) => [styles.peopleChip, pressed && { opacity: 0.7 }]}>
                <Text variant="bodyStrong" style={styles.peopleChipText}>
                  {people} kişilik
                </Text>
                {peopleOpen ? (
                  <ChevronUp size={18} color={INK} />
                ) : (
                  <ChevronDown size={18} color={INK} />
                )}
              </Pressable>
            </View>

            {/**
              * Sayıyı değiştiren satır. Açılır menü ya da kaydırıcı yerine iki
              * büyük düğme: hedef kullanıcı telefona yeni alışıyor olabilir,
              * eksi–artı herkesin bildiği tek şey. Dokunma alanı 56×56.
              *
              * Güncelleme fonksiyonel biçimde: `people + 1` yazınca hızlı
              * arka arkaya dokunuşlarda kapanıştaki eski değer okunuyor ve
              * dört dokunuş bir artışa düşüyordu.
              */}
            {peopleOpen ? (
              <View style={styles.peopleEditor}>
                <View style={styles.peopleStepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Kişi sayısını azalt"
                    disabled={people <= 1}
                    onPress={() => setPeopleOverride((prev) => Math.max(1, (prev ?? housePeople) - 1))}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      people <= 1 && { opacity: 0.3 },
                      pressed && { backgroundColor: SAND_DEEP },
                    ]}>
                    <Minus size={24} color={INK} />
                  </Pressable>

                  <View style={styles.stepperValue}>
                    <Text variant="bodyStrong" style={styles.stepperNumber}>
                      {people}
                    </Text>
                    <Text variant="body" style={styles.stepperUnit}>
                      kişi
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Kişi sayısını artır"
                    disabled={people >= 20}
                    onPress={() => setPeopleOverride((prev) => Math.min(20, (prev ?? housePeople) + 1))}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      people >= 20 && { opacity: 0.3 },
                      pressed && { backgroundColor: SAND_DEEP },
                    ]}>
                    <Plus size={24} color={INK} />
                  </Pressable>
                </View>

                <Text variant="body" style={styles.peopleNote}>
                  {peopleOverride === null
                    ? `Hanende ${housePeople} kişi kayıtlı. Buradaki değişiklik yalnızca bu tarif için.`
                    : `Malzemeler ve alışveriş listesi ${people} kişiye göre yeniden hesaplandı.`}
                </Text>

                {peopleOverride !== null && peopleOverride !== housePeople ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Haneme dön, ${housePeople} kişi`}
                    onPress={() => setPeopleOverride(null)}
                    style={({ pressed }) => [styles.peopleReset, pressed && { opacity: 0.7 }]}>
                    <Text variant="bodyStrong" style={{ color: INK }}>
                      Haneme dön · {housePeople} kişi
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/**
              * Satırların dokunulabilir olduğu görünmüyor — kenarlık da yok,
              * düğmeye de benzemiyorlar. Tek cümlelik ipucu bunu söylüyor;
              * sağdaki artı işareti de aynı şeyi ikinci kez söylüyor.
              */}
            {openIngredients ? (
              <Text variant="body" style={styles.ingHint}>
                Malzemeye dokun, sepete girsin.
              </Text>
            ) : null}

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
                      const grams = scaled(ri.slug, ri.grams);
                      const added = fromHere.has(ri.slug);
                      const elsewhere = !added && inBasket.has(ri.slug);
                      return (
                        <Pressable
                          key={`${ri.slug}-${idx}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: added }}
                          accessibilityLabel={
                            added
                              ? `${ing.nameTr} sepette. Çıkarmak için dokun.`
                              : `${ing.nameTr}. Sepete eklemek için dokun.`
                          }
                          onPress={() =>
                            toggleGrocery(recipe.title, {
                              slug: ri.slug,
                              grams: totalOf.get(ri.slug) ?? grams,
                            })
                          }
                          style={({ pressed }) => [styles.ingRow, pressed && { opacity: 0.55 }]}>
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
                              {householdOf(ri.slug, ing.category, grams, tolerances.get(ri.slug))}
                              {ri.note ? ` · ${ri.note}` : ''}
                            </Text>
                            {elsewhere ? (
                              <Text variant="caption" style={styles.ingBasketNote}>
                                Sepetinde zaten var, başka bir tariften.
                              </Text>
                            ) : null}
                          </View>
                          <View style={[styles.ingBasket, added && styles.ingBasketOn]}>
                            {added ? (
                              <Check size={18} color="#fff" />
                            ) : (
                              <Plus size={18} color="#777" />
                            )}
                          </View>
                        </Pressable>
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
                {missing.length === 0 ? (
                  <Check size={18} color={INK} />
                ) : (
                  <ShoppingBasket size={18} color={INK} />
                )}
                <Text style={styles.wideButtonText}>
                  {missing.length === 0
                    ? 'Hepsi sepette — sepeti aç'
                    : missing.length === buyable.length
                      ? 'Tümünü sepete ekle'
                      : `Kalan ${missing.length} malzemeyi ekle`}
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

          {basketCleared ? (
            <Text variant="caption" style={styles.cookedNote}>
              Bu tarifin malzemeleri sepetten düşüldü.
            </Text>
          ) : null}
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
  /** Sepetteki malzeme sayısı — simgenin sağ üst köşesinde. */
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#e6103b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 16 },

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
  ingHint: { color: '#777', marginBottom: 16, marginTop: -4 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    minHeight: 52,
  },
  ingName: { fontSize: 16, color: INK, fontWeight: '800' },
  ingAmount: { color: '#555', fontSize: 15, marginTop: 2 },
  ingBasketNote: { color: '#9a7b57', marginTop: 3 },
  /** Satırın sağ ucundaki ekle/çıkar işareti. 44×44 — parmak ölçüsü. */
  ingBasket: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingBasketOn: { backgroundColor: '#e6103b', borderColor: '#e6103b' },

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
  cookedNote: { color: '#666', marginTop: 10, textAlign: 'center' },

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

  ingredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  ingredientsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  peopleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: TAG_BG,
  },
  peopleChipText: { color: INK, fontSize: 16 },

  peopleEditor: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: SAND,
    borderWidth: 1,
    borderColor: LINE,
  },
  peopleStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: LINE,
  },
  stepperValue: { alignItems: 'center', minWidth: 72 },
  stepperNumber: { fontSize: 30, color: INK, lineHeight: 34 },
  stepperUnit: { color: '#666', fontSize: 15 },
  peopleNote: { color: '#666', marginTop: 12, lineHeight: 20, textAlign: 'center' },
  peopleReset: {
    marginTop: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: SAND_DEEP,
  },

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
