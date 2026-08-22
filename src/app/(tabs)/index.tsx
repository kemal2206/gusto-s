import { useRouter } from 'expo-router';
import { FlaskConical, Refrigerator, Search, ShoppingBasket, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';

import { RecipeRail } from '@/components/recipe-rail';
import { Eyebrow } from '@/components/ui/eyebrow';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BY_SLUG, CATALOG_STATS, INGREDIENTS } from '@/data/catalog';
import {
  DISH_CATEGORIES,
  RECIPES,
  RECIPE_BY_SLUG,
  RECIPE_STATS,
  recipesByCategory,
  recipesWithIngredient,
} from '@/data/recipes';
import { YEREL_GORSEL } from '@/data/recipes/gorsel-yerel';
import { applyProfile } from '@/lib/profile-filter';
import { recipesForTerm } from '@/lib/recipe-filter';
import { useFavorites } from '@/lib/store/favorites';
import { useGrocery } from '@/lib/store/grocery';
import { favouriteMain, useHistory } from '@/lib/store/history';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { topTerms, useSearchLog } from '@/lib/store/search-log';
import { MIN_TOUCH, palette, radius, spacing, tabularNums, tintFor } from '@/theme/tokens';

/**
 * Ana sayfa.
 *
 * Düzen referans tasarımdan: üstte arama, sonra kategori şeridi, sonra
 * arka arkaya **yatay tarif rayları**. Kullanıcıya seçim yaptırmıyoruz —
 * doğrudan tarifleri gösteriyoruz; kategori başlığına dokunmak isteyen
 * tüm listeye gidiyor.
 */
export default function HomeScreen() {
  const router = useRouter();

  const email = useProfile((s) => s.email);
  const basketCount = useGrocery((s) => s.items.length);
  const profileFilter = useProfileFilter();

  const logs = useHistory((s) => s.logs);
  const hydrated = useHistory((s) => s.hydrated);
  const savedSlugs = useFavorites((s) => s.slugs);

  const favourite = useMemo(() => favouriteMain(logs), [logs]);
  const fallbackFavourite = { slug: 'tavuk-but', count: 5, total: 10 };
  const currentFavourite = favourite || fallbackFavourite;
  const currentFavouriteIngredient = BY_SLUG.get(currentFavourite.slug);

  const suggested = useMemo(
    () =>
      currentFavourite
        ? applyProfile(recipesWithIngredient(currentFavourite.slug), profileFilter).slice(0, 10)
        : [],
    [currentFavourite, profileFilter],
  );

  /** En çok aradığı terim — ana sayfada kendi ilgisine göre bir ray açıyor. */
  const searchTerms = useSearchLog((s) => s.terms);
  const searched = useMemo(() => {
    const term = topTerms(searchTerms, 1)[0];
    if (!term) return null;
    const list = applyProfile(recipesForTerm(term, 12), profileFilter);
    return list.length >= 3 ? { term, list } : null;
  }, [searchTerms, profileFilter]);

  const saved = useMemo(
    () => savedSlugs.map((s) => RECIPE_BY_SLUG.get(s)).filter((r) => r !== undefined),
    [savedSlugs],
  );

  /**
   * "En popüler" — beğeni verimiz yok.
   *
   * Önce **kendi ürettiğimiz görseli olan** tarifler geliyor: ray uygulamanın
   * ilk ekranı ve orada rastgele bir internet fotoğrafı yerine tarifin
   * gerçek karesinin durması en çok fark edilen yer.
   *
   * Arkasını eski ölçüt dolduruyor — makul sürede pişen, adımı yazılmış
   * tarifler. Sıra her açılışta sabit kalsın diye rastgele değil.
   */
  const quick = useMemo(() => {
    const gorselli = applyProfile(
      Object.keys(YEREL_GORSEL)
        .map((s) => RECIPE_BY_SLUG.get(s))
        .filter((r) => r !== undefined),
      profileFilter,
    );

    const gorselliSluglar = new Set(gorselli.map((r) => r.slug));
    const kalan = applyProfile(
      RECIPES.filter(
        (r) =>
          !gorselliSluglar.has(r.slug) && r.totalMinutes >= 15 && r.totalMinutes <= 45,
      ).sort(
        (a, b) =>
          b.components[0].steps.length - a.components[0].steps.length ||
          a.totalMinutes - b.totalMinutes,
      ),
      profileFilter,
    );

    return [...gorselli, ...kalan].slice(0, 16);
  }, [profileFilter]);

  /** Listenin sonundan gelen tarifler — "topluluktan" rayı. */
  const community = useMemo(
    () => applyProfile([...RECIPES].reverse(), profileFilter).slice(0, 5),
    [profileFilter],
  );

  /** Kilerde en çok işe yarayan malzemeler — "elinde ne var" kısayolu. */
  const quickPantry = useMemo(
    () =>
      ['kuru-sogan', 'domates', 'yumurta', 'yogurt', 'tavuk-but', 'pirinc', 'patates', 'sarimsak']
        .map((s) => BY_SLUG.get(s))
        .filter((i) => i !== undefined),
    [],
  );

  const goCategory = (id: string) =>
    router.push({ pathname: '/kategori/[id]', params: { id } });

  return (
    <Screen bleed>
      <View style={{ flex: 1, backgroundColor: '#fbf9f6' }}>
        {/* ── Başlık ve arama ─────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: '#fbf9f6', paddingTop: spacing.xl, paddingBottom: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Text
            variant="display"
            tone="default"
            style={{ flex: 1, fontSize: 34, lineHeight: 34, fontFamily: 'ZalandoSans_SemiExpanded_Bold', letterSpacing: -0.5 }}>
            İlham mı arıyorsun?
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sepetim, ${basketCount} malzeme`}
            onPress={() => router.push('/sepet')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <ShoppingBasket size={20} color={basketCount ? palette.brand : palette.inkMuted} />
            {basketCount > 0 && (
              <View style={styles.basketBadge}>
                <RNText style={styles.basketBadgeText}>{String(basketCount)}</RNText>
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={email ? 'Hesabın' : 'Giriş yap'}
            onPress={() => router.push('/hesap')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <UserRound size={20} color={email ? palette.brand : palette.inkMuted} />
          </Pressable>
        </View>
        <Text variant="body" tone="default" style={{ fontSize: 16, marginTop: 4 }}>
          İstediğin tarifi daha sonra pişirmek için yemek kitabına kaydet.
        </Text>

        <Pressable
          accessibilityRole="search"
          accessibilityLabel="Tarif ara"
          onPress={() => router.push('/ara')}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
          <Search size={20} color={palette.inkMuted} />
          <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
            10.000+ tarif ara
          </Text>
        </Pressable>
      </View>

      {/* ── Kategori şeridi ─────────────────────────────────────── */}
      <View style={{ backgroundColor: '#fbf9f6', paddingBottom: spacing.xl }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catStrip}>
          {DISH_CATEGORIES.map((c, index) => {
            const PASTEL_COLORS = ['#f5e6d3', '#ebd5c1', '#f0e6d2', '#e8e0d5', '#eaddd7', '#dcdacb'];
            const bgColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
            const n = RECIPE_STATS.byCategory[c.id] ?? 0;
            if (!n) return null;
            return (
                <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`${c.labelTr}, ${n} tarif`}
                onPress={() => goCategory(c.id)}
                style={({ pressed }) => [
                  {
                    width: 100,
                    height: 120,
                    backgroundColor: palette.brand,
                    borderRadius: 16,
                    overflow: 'hidden',
                    alignItems: 'center',
                    paddingTop: 14,
                  },
                  pressed && styles.pressed,
                ]}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#fff', zIndex: 2, paddingHorizontal: 4 }}>
                  {c.labelTr}
                </Text>
                <Image 
                  source={{ uri: `https://loremflickr.com/200/200/food,recipe?random=${c.id}` }} 
                  style={{ position: 'absolute', bottom: -20, width: 80, height: 80, borderRadius: 40 }} 
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Raylar ve Bloklar ───────────────────────────────────── */}
      <View style={{ gap: 48, paddingBottom: 48, paddingTop: 16 }}>
        <RecipeRail
          title="En popüler tarifler"
          recipes={quick}
          onSeeAll={() => router.push('/ara')}
        />

        {saved.length ? (
          <RecipeRail title="Kaydettiklerin" recipes={saved} />
        ) : null}

        {searched ? (
          <RecipeRail
            title="Aradıklarına göre"
            hint={`En çok “${searched.term}” aradın`}
            recipes={searched.list}
            onSeeAll={() => router.push('/ara')}
          />
        ) : null}

        {currentFavourite && currentFavouriteIngredient ? (
          <View style={{ backgroundColor: palette.brand, paddingVertical: spacing.xl }}>
            <RecipeRail
              title="Senin mutfağın"
              hint={`Kurduğun ${currentFavourite.total} tabağın ${currentFavourite.count}'ı ${currentFavouriteIngredient.nameTr.toLocaleLowerCase('tr-TR')}`}
              recipes={suggested}
              inverse={true}
            />
          </View>
        ) : null}

        {/* ── Elinde ne varsa ─────────────────────────────────────── */}
        <View style={[styles.pantryBlock, { backgroundColor: '#f4ede4', borderWidth: 0, borderRadius: 16, marginTop: 0 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text variant="display" tone="default" style={{ fontSize: 24, lineHeight: 28, marginBottom: 6, fontFamily: 'ZalandoSans_SemiExpanded_Bold' }}>
                Elinde ne var?
              </Text>
              <Text variant="body" tone="default" style={{ fontSize: 15 }}>
                Buzdolabındaki malzemeleri seç, bu akşam ne pişirebileceğini gör.
              </Text>
            </View>
            <Image source={require('../../../assets/images/fridge.png')} style={{ width: 64, height: 84, resizeMode: 'contain', marginTop: -10 }} />
          </View>

          <Text variant="caption" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' }}>
            Popüler
          </Text>

          <Pressable
            accessibilityRole="search"
            onPress={() => router.push('/ara')}
            style={({ pressed }) => [styles.search, { backgroundColor: '#fff', borderRadius: radius.control, height: 44, marginTop: 0, marginBottom: spacing.md, borderWidth: 1, borderColor: '#dcdcdc' }, pressed && styles.pressed]}>
            <Search size={16} color={palette.ink} />
            <Text variant="body" tone="default" style={{ fontSize: 15 }}>
              Yeni malzeme ekle
            </Text>
          </Pressable>

          <View style={styles.pantryChips}>
            {quickPantry.slice(0, 5).map((i) => (
              <Pressable
                key={i.slug}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/dolap-sonuc', params: { slugs: i.slug } })
                }
                style={({ pressed }) => [styles.pantryChip, { backgroundColor: '#fff', borderRadius: radius.control, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#dcdcdc' }, pressed && styles.pressed]}>
                <Text style={{ fontSize: 16, color: palette.ink, marginRight: 4, marginTop: -2 }}>+</Text>
                <Text variant="bodyStrong" style={{ fontSize: 14 }}>{i.nameTr}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Kategori rayları ────────────────────────────────────── */}
        {DISH_CATEGORIES.slice(0, 1).map((c) => {
          const list = applyProfile(recipesByCategory(c.id), profileFilter);
          if (list.length < 2) return null;
          return (
            <RecipeRail
              key={c.id}
              title={c.labelTr}
              recipes={list}
              onSeeAll={() => goCategory(c.id)}
            />
          );
        })}

        <RecipeRail
          title="Topluluktan"
          recipes={community}
          onSeeAll={() => router.push('/ara')}
        />

        <View style={{ backgroundColor: palette.brand, borderRadius: 16, marginHorizontal: spacing.xl, padding: spacing.xl, overflow: 'hidden' }}>
          <Text style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 12, overflow: 'hidden' }}>YENİ</Text>
          <Text variant="display" style={{ fontSize: 28, lineHeight: 32, fontFamily: 'ZalandoSans_SemiExpanded_Bold', marginBottom: 8, color: '#fff', width: '70%' }}>
            Bana menü hazırla
          </Text>
          <Text variant="body" style={{ fontSize: 16, marginBottom: 20, color: 'rgba(255, 255, 255, 0.9)', width: '65%' }}>
            Birkaç soru sor, ara sıcaktan içeceğe kadar birbirine uyan komple bir sofra kur.
          </Text>
          <Pressable onPress={() => router.push('/menu')} style={{ backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, alignSelf: 'flex-start' }}>
            <Text variant="button" style={{ color: palette.brand, fontWeight: '700', fontSize: 15 }}>Hemen Başla</Text>
          </Pressable>
          <Image source={{ uri: 'https://loremflickr.com/200/400/food,cookbook?random=cookbook' }} style={{ position: 'absolute', right: -30, top: 20, width: 140, height: 280, resizeMode: 'contain', transform: [{ rotate: '5deg' }] }} />
        </View>

        {DISH_CATEGORIES.slice(1, 3).map((c) => {
          const list = applyProfile(recipesByCategory(c.id), profileFilter);
          if (list.length < 2) return null;
          return (
            <RecipeRail
              key={c.id}
              title={c.labelTr}
              recipes={list}
              onSeeAll={() => goCategory(c.id)}
            />
          );
        })}

        {/* ── Lezzet Lab ──────────────────────────────────────────── */}
        <View style={styles.labBlock}>
          <Eyebrow tone="brand">Lezzet Lab</Eyebrow>
          <Text variant="h2" tone="brandDeep" style={{ fontFamily: 'ZalandoSans_SemiExpanded_Bold' }}>
            Kendi tarifini kur
          </Text>
          <Text variant="body" tone="muted">
            Ana malzemeni seç, bileşen bileşen ilerle. Her adımda önerilen malzemenin
            seçtiklerinle neden uyduğunu — hangi aroma bileşiğini paylaştığını — gösteriyoruz.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/lab')}
            style={({ pressed }) => [styles.labButton, pressed && styles.pressed]}>
            <FlaskConical size={18} color={palette.surface} />
            <Text variant="button" tone="inverse">
              Laboratuvarı aç
            </Text>
          </Pressable>
        </View>
      </View>

        {/* ── Sayılar ─────────────────────────────────────────────── */}
        <View style={styles.stats}>
          <Stat value={String(RECIPE_STATS.total)} label="tarif" />
          <View style={styles.divider} />
          <Stat value={String(INGREDIENTS.length)} label="malzeme" />
          <View style={styles.divider} />
          <Stat value={String(CATALOG_STATS.compounds)} label="aroma bileşiği" />
        </View>
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h2" tone="brandDeep" style={tabularNums}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: spacing.md,
  },
  pressed: { opacity: 0.85 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  basketBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basketBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 16 },

  catStrip: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  cat: { width: 80, gap: spacing.sm, alignItems: 'center' },
  catArt: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efeae2',
  },
  catEmoji: { fontSize: 28, lineHeight: 34 },
  catLabel: { lineHeight: 18, fontWeight: '600', color: '#444' },

  pantryBlock: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  pantryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pantryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pantryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: palette.surface,
  },

  labBlock: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    gap: spacing.sm,
  },
  labButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: palette.brand,
    marginTop: spacing.sm,
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  stat: { flex: 1, gap: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: palette.border },
});
