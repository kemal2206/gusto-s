import { useRouter } from 'expo-router';
import { ChefHat, ChevronRight, Search, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeRail } from '@/components/recipe-rail';
import { Button } from '@/components/ui/button';
import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { OptionCard } from '@/components/ui/option-card';
import { RecipeTile } from '@/components/recipe-tile';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { filterRecipes, type FilterAnswers } from '@/lib/recipe-filter';
import { COLLECTIONS } from '@/lib/koleksiyon';
import { applyProfile } from '@/lib/profile-filter';
import { useProfile, useProfileFilter } from '@/lib/store/profile';
import { answerKey, useDiscovery } from '@/lib/store/discovery';
import { useTabReset } from '@/lib/use-tab-reset';
import { RECIPES } from '@/data/recipes';
import { palette, radius, spacing } from '@/theme/tokens';

interface Step {
  id: string;
  question: string;
  hint?: string;
  options: { value: string; label: string; description?: string; slug?: string }[];
  /**
   * Bu adım hangi durumda sorulacak. Yoksa her zaman sorulur.
   *
   * Dallanmanın sebebi: çorba seçen birine "fırın mı ocak mı" sormak boş bir
   * adım; tatlı isteyene acılık sormak saçma. Soru sayısını artırmadan
   * isabeti artırmanın yolu, sormayacağımız soruyu hiç göstermemek.
   */
  showIf?: (a: Record<string, string>) => boolean;
}

/**
 * Ana malzemeye özel ayrıntı sorusu.
 *
 * "Tavuk" seçen birine tavuğa dair, "çorba" seçene çorbaya dair soru
 * soruluyor. Tek bir adım kimliği (`detay`) kullanılıyor, seçenekler
 * ana malzemeye göre değişiyor — yoksa altı ayrı adım tanımlamak gerekirdi.
 */
const DETAIL_OPTIONS: Record<
  string,
  { question: string; options: { value: string; label: string; description?: string }[] }
> = {
  tavuk: {
    question: 'Tavuğun hangi parçası?',
    options: [
      { value: 'tavuk-but', label: 'But', description: 'Daha lezzetli, kurumaz' },
      { value: 'tavuk-gogus', label: 'Göğüs', description: 'Yağsız, protein ağırlıklı' },
    ],
  },
  'kirmizi-et': {
    question: 'Kıyma mı, parça et mi?',
    options: [
      { value: 'et-kiyma', label: 'Kıyma', description: 'Köfte, sulu yemek, hamur işi' },
      { value: 'et-parca', label: 'Parça et', description: 'Kuşbaşı, pirzola, antrikot' },
    ],
  },
  balik: {
    question: 'Hangi tür deniz ürünü?',
    options: [
      { value: 'balik-kucuk', label: 'Küçük balık', description: 'Hamsi, uskumru, palamut' },
      { value: 'balik-beyaz', label: 'Beyaz balık', description: 'Levrek, çipura, alabalık' },
      { value: 'deniz-kabuklu', label: 'Kabuklu', description: 'Karides, midye, kalamar' },
    ],
  },
  sebze: {
    question: 'Hangi sebze öne çıksın?',
    options: [
      { value: 'sebze-patlican', label: 'Patlıcan' },
      { value: 'sebze-yesil', label: 'Yeşillik', description: 'Ispanak, fasulye, bakla' },
      { value: 'sebze-kok', label: 'Kök sebze', description: 'Patates, havuç, kereviz' },
      { value: 'sebze-mantar', label: 'Mantar' },
    ],
  },
  corba: {
    question: 'Nasıl bir çorba?',
    options: [
      { value: 'corba-mercimek', label: 'Mercimekli' },
      { value: 'corba-yogurtlu', label: 'Yoğurtlu', description: 'Tarhana, yayla, düğün' },
      { value: 'corba-etli', label: 'Etli' },
      { value: 'corba-sebze', label: 'Sebzeli' },
    ],
  },
  hamur: {
    question: 'Makarna mı, pilav mı?',
    options: [
      { value: 'hamur-makarna', label: 'Makarna ve erişte' },
      { value: 'hamur-pilav', label: 'Pilav' },
    ],
  },
};

/** Ana malzemeye göre yöntem seçenekleri — hepsi her yemekte anlamlı değil. */
const METHOD_OPTIONS: Record<string, { value: string; label: string; description?: string }[]> = {
  tavuk: [
    { value: 'tek-tencere', label: 'Tek tencerede', description: 'Bulaşık çıkmasın' },
    { value: 'firin', label: 'Fırında' },
    { value: 'ocak', label: 'Tavada' },
    { value: 'izgara', label: 'Izgarada' },
  ],
  'kirmizi-et': [
    { value: 'tek-tencere', label: 'Tek tencerede', description: 'Bulaşık çıkmasın' },
    { value: 'ocak', label: 'Tavada' },
    { value: 'firin', label: 'Fırında' },
    { value: 'izgara', label: 'Izgarada' },
  ],
  balik: [
    { value: 'firin', label: 'Fırında' },
    { value: 'izgara', label: 'Izgarada' },
    { value: 'ocak', label: 'Tavada' },
  ],
  sebze: [
    { value: 'tek-tencere', label: 'Tek tencerede', description: 'Bulaşık çıkmasın' },
    { value: 'firin', label: 'Fırında' },
    { value: 'ocak', label: 'Tavada' },
  ],
};

const STEPS: Step[] = [
  {
    id: 'ana-malzeme',
    question: 'Ne yemek istersin?',
    hint: 'Birini seç, istersen sonra değiştirirsin.',
    options: [
      { value: 'tavuk', label: 'Tavuk', slug: 'tavuk-but' },
      { value: 'kirmizi-et', label: 'Kırmızı et', slug: 'kuzu-but' },
      { value: 'balik', label: 'Balık', slug: 'levrek' },
      { value: 'sebze', label: 'Sebze', slug: 'patlican' },
      { value: 'hamur', label: 'Makarna ve pilav', slug: 'pirinc' },
      { value: 'corba', label: 'Çorba', slug: 'sogan' },
    ],
  },
  {
    id: 'detay',
    question: 'Ayrıntı',
    // Metni ve seçenekleri ana malzemeye göre değişiyor.
    showIf: (a) => Boolean(a['ana-malzeme'] && DETAIL_OPTIONS[a['ana-malzeme']]),
    options: [],
  },
  {
    id: 'tat',
    question: 'Nasıl bir tat olsun?',
    options: [
      { value: 'hafif', label: 'Hafif ve taze', description: 'Az yağlı, ekşiliği olan', slug: 'limon' },
      { value: 'doyurucu', label: 'Doyurucu', description: 'Tok tutan, dolgun', slug: 'domates-salcasi' },
      { value: 'baharatli', label: 'Acılı', description: 'Yakan, keskin', slug: 'pul-biber' },
      { value: 'tatli', label: 'Tatlımsı', description: 'Şekerli ya da meyveli', slug: 'bal' },
    ],
  },
  {
    id: 'acilik',
    question: 'Ne kadar acı?',
    hint: 'Acılığı tarifin kendi baharat miktarından hesaplıyoruz.',
    // Yalnızca acılı isteyene soruluyor; diğerlerine anlamsız bir adım olurdu.
    showIf: (a) => a.tat === 'baharatli',
    options: [
      { value: 'az-aci', label: 'Hafif yaksın', description: 'Çocuk da yiyebilsin' },
      { value: 'cok-aci', label: 'İyice acı', description: 'Acıyı seviyorum' },
    ],
  },
  {
    id: 'hedef',
    question: 'Beslenmene dair bir hedefin var mı?',
    hint: 'Yoksa geç. Değerler malzemelerden hesaplanan tahmindir.',
    // Tatlı isteyene "hafif olsun mu" diye sormak anlamsız.
    showIf: (a) => a.tat !== 'tatli',
    options: [
      { value: 'hafif', label: 'Hafif olsun', description: 'Porsiyonu 450 kalorinin altında' },
      { value: 'yuksek-protein', label: 'Protein ağırlıklı', description: 'Porsiyonda 25 gramdan çok' },
      { value: 'dusuk-karbonhidrat', label: 'Az karbonhidrat', description: 'Ekmek, pirinç, makarna az' },
    ],
  },
  {
    id: 'emek',
    question: 'Tarif ne kadar uzun olsun?',
    hint: 'Fark etmezse geç.',
    /**
     * Buradan "tek tencerede olsun" seçeneğini çıkardık: bir sonraki adımda
     * "fırında mı ızgarada mı" diye sormak onunla çelişiyordu. Tek tencere
     * bir *pişirme biçimi*, uzunluk ölçüsü değil — pişirme sorusuna taşındı.
     */
    options: [
      { value: 'az-malzeme', label: 'Az malzemeli', description: 'Altı malzemeyi geçmesin' },
      { value: 'az-adim', label: 'Kısa tarif', description: 'Beş adımda bitsin' },
      { value: 'uzun-tarif', label: 'Uğraşmayı severim', description: 'Adımı çok olsun, sorun değil' },
    ],
  },
  {
    id: 'sure',
    question: 'Ne kadar vaktin var?',
    options: [
      { value: '20', label: '20 dakika' },
      { value: '45', label: 'Yarım saat kadar' },
      { value: '999', label: 'Acelem yok' },
    ],
  },
  {
    id: 'yontem',
    question: 'Nasıl pişsin?',
    hint: 'Fark etmezse geç butonuna bas.',
    /**
     * Çorba ve makarna zaten ocakta pişiyor; onlara sormak boş adım.
     * Kalanlarda seçenekler ana malzemeye göre değişiyor — balığa "tencerede"
     * demek yerine "tavada" demek daha doğru.
     */
    showIf: (a) => a['ana-malzeme'] !== 'corba' && a['ana-malzeme'] !== 'hamur',
    options: [
      { value: 'tek-tencere', label: 'Tek tencerede', description: 'Bulaşık çıkmasın' },
      { value: 'firin', label: 'Fırında' },
      { value: 'ocak', label: 'Tavada' },
      { value: 'izgara', label: 'Izgarada' },
    ],
  },
];

/**
 * Cevaplara göre gerçekten sorulacak adımlar.
 *
 * Üç adımın içeriği seçime göre değişiyor: yöntem seçenekleri ana malzemeye,
 * ayrıntı sorusu ana malzemeye, seçki sorusu da seçilen seçkiye göre.
 */
function visibleSteps(answers: Record<string, string>): Step[] {
  return STEPS.filter((s) => !s.showIf || s.showIf(answers)).map((s) => {
    if (s.id === 'yontem') {
      return { ...s, options: METHOD_OPTIONS[answers['ana-malzeme'] ?? ''] ?? s.options };
    }
    if (s.id === 'detay') {
      const d = DETAIL_OPTIONS[answers['ana-malzeme'] ?? ''];
      return d ? { ...s, question: d.question, options: d.options } : s;
    }
    return s;
  });
}

const WINDOW_WIDTH = Dimensions.get('window').width;
const HALF_WIDTH = (WINDOW_WIDTH - spacing.xl * 2 - 12) / 2;

export default function CravingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const profileFilter = useProfileFilter();

  const shown = useDiscovery((s) => s.shown);
  const nextRun = useDiscovery((s) => s.nextRun);
  const markShown = useDiscovery((s) => s.markShown);

  /**
   * Aynı cevaplarla ikinci kez gelindiğinde tohum değişiyor, liste tazeleniyor.
   * Tohum cevap birleşimine bağlı: farklı sorulara farklı sayaç.
   */
  const [seed, setSeed] = useState(1);
  const key = answerKey(answers);

  useEffect(() => {
    if (!key) return;
    setSeed(nextRun(key));
    // Cevaplar değiştiğinde yeni tur; her açılışta bir öncekinden farklı sıra.
  }, [key, nextRun]);

  /**
   * Cevaplar puanlanarak tarife çevriliyor; sert filtre boş liste üretiyordu.
   * Puanlamadan sonra profil süzgeci geçiyor: diyet ve sevmediği malzeme
   * eleniyor, ekipmanı tutan tarifler öne alınıyor.
   */
  const results = useMemo(() => {
    const scored = filterRecipes(answers as FilterAnswers, 40, { seed, shown });
    const kept = new Set(
      applyProfile(
        scored.map((r) => r.recipe),
        profileFilter,
      ).map((r) => r.slug),
    );
    return scored.filter((r) => kept.has(r.recipe.slug));
    // `shown` kasten bağımlılık değil: işaretleme sonucu listeyi anında
    // yeniden dizip kullanıcının gözü önünde kaydırırdı. Sonraki turda etkili.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, profileFilter, seed]);

  /**
   * Görünen adımlar cevaplara göre değişiyor, o yüzden her seferinde
   * yeniden hesaplanıyor: "acılı" seçilince acılık adımı beliriyor,
   * çorba seçilince yöntem adımı kayboluyor.
   */
  const steps = useMemo(() => visibleSteps(answers), [answers]);

  const finished = index >= steps.length;
  const step = finished ? null : steps[index];
  const selected = step ? answers[step.id] : undefined;

  const next = () => setIndex((i) => i + 1);
  const back = () => setIndex((i) => Math.max(0, i - 1));
  const restart = () => {
    setAnswers({});
    setIndex(0);
  };

  // Alttaki sekmeye basınca sihirbazın başına dön.
  useTabReset(restart);

  /**
   * Cevabı yaz ve **görünmez kalan adımların cevabını sil**.
   *
   * Kullanıcı "acılı" deyip acılık kademesini seçtikten sonra geri dönüp
   * "hafif" derse, eski acılık cevabı ortada kalıyor ve sonucu sessizce
   * bozuyordu. Artık soru ekrandan kalkınca cevabı da kalkıyor.
   */
  const answer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      const visible = new Set(visibleSteps(next).map((s) => s.id));
      for (const key of Object.keys(next)) {
        if (!visible.has(key)) delete next[key];
      }
      return next;
    });
  };

  const handleSelectFirstStep = (val: string) => {
    answer(steps[0].id, val);
    setIndex(1);
  };

  /**
   * Seçki kartı doğrudan tarif listesine gidiyor.
   *
   * Önce sihirbaza sokuyordu; "15 dakikadan az" diyen kişiye dört soru
   * sormak seçkinin bütün anlamını ortadan kaldırıyordu. Başlık ne diyorsa
   * liste o.
   */
  const handleSelectCollection = (id: string) => {
    router.push({ pathname: '/secki/[id]', params: { id } });
  };

  /** Uzun süren, emek isteyen tarifler — profil süzgecinden geçmiş hâli. */
  const trending = useMemo(
    () =>
      applyProfile(
        [...RECIPES].sort((a, b) => b.totalMinutes - a.totalMinutes),
        profileFilter,
      ).slice(0, 5),
    [profileFilter],
  );

  /* Sonuç ekranına gelindiğinde ilk sıradakileri "görüldü" say. */
  const topSlugs = results.slice(0, 10).map((r) => r.recipe.slug).join(',');
  useEffect(() => {
    if (finished && topSlugs) markShown(topSlugs.split(','));
  }, [finished, topSlugs, markShown]);

  if (finished) {
    return (
      <Screen progress={1}>
        <View style={styles.head}>
          <Text variant="display" tone="brandDeep" style={{ fontSize: 32, lineHeight: 36, marginBottom: 8 }}>
            Seçimlerine göre tarifleri süzeceğiz
          </Text>
        </View>

        <View style={styles.card}>
          {steps.map((s) => (
            <View key={s.id} style={styles.summaryRow}>
              <Text variant="label" tone="muted">
                {s.question}
              </Text>
              <Text variant="bodyStrong" tone="brandDeep">
                {s.options.find((o) => o.value === answers[s.id])?.label ?? 'Fark etmez'}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3" tone="brandDeep">
            {`${results.length} tarif bulundu`}
          </Text>
          {results.length === 0 ? (
            <Text variant="body" tone="muted">
              Bu birleşimde tarif çıkmadı. Bir adımı &quot;fark etmez&quot; bırakıp tekrar dene.
            </Text>
          ) : null}
          <View style={styles.grid}>
            {results.slice(0, 25).map((r) => (
              <View key={r.recipe.slug} style={{ width: '48%' }}>
                <RecipeTile
                  recipe={r.recipe}
                  fluid
                  matchHint={r.matched.length ? `Eşleşen: ${r.matched.join(', ')}` : undefined}
                />
              </View>
            ))}
          </View>
        </View>

        <Button label="Baştan seç" variant="secondary" onPress={restart} />
      </Screen>
    );
  }

  // Dashboard (Keşfet) layout for the first step
  if (index === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fbf9f6' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: insets.top + 20 }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <Text variant="display" style={{ fontSize: 32, fontWeight: '800', color: '#111', marginBottom: 24 }}>
              Keşfet
            </Text>

            {/* Search Bar */}
            <Pressable
              accessibilityRole="search"
              accessibilityLabel="Tarif ara"
              onPress={() => router.push('/ara')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingLeft: 16,
                paddingRight: 6,
                paddingVertical: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <Text style={{ flex: 1, fontSize: 16, color: '#888' }}>Tatbilim'de Ara</Text>
              <View style={{ backgroundColor: '#00b14f', width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Search size={20} color="#fff" />
              </View>
            </Pressable>

            {/* Popular Categories */}
            <Text variant="h2" style={{ fontSize: 22, fontWeight: '700', marginTop: 36, marginBottom: 16, color: '#222' }}>
              Popüler Kategoriler
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {step!.options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.label} tarifleri`}
                  onPress={() => handleSelectFirstStep(o.value)}
                  style={({ pressed }) => [
                    {
                      width: HALF_WIDTH,
                      height: 84,
                      backgroundColor: '#f5efe8',
                      borderRadius: 8,
                      padding: 12,
                      overflow: 'hidden',
                      justifyContent: 'center'
                    },
                    pressed && { opacity: 0.85 }
                  ]}>
                  <Text variant="bodyStrong" style={{ fontSize: 15, width: '60%', zIndex: 2, color: '#111' }}>{o.label}</Text>
                  <Image 
                    source={{ uri: `https://loremflickr.com/200/200/food,dish?random=${o.slug}` }} 
                    style={{ position: 'absolute', right: -25, width: 84, height: 84, borderRadius: 42 }} 
                  />
                </Pressable>
              ))}
            </View>

            {/* ── Özel seçkiler ────────────────────────────────── */}
            <Text variant="h2" style={{ fontSize: 22, fontWeight: '700', marginTop: 36, marginBottom: 4, color: '#222' }}>
              Özel Seçkiler
            </Text>
            <Text variant="caption" tone="muted" style={{ marginBottom: 16 }}>
              Ne yiyeceğine değil, nasıl bir gün geçirdiğine göre
            </Text>

            <View style={{ gap: 10 }}>
              {COLLECTIONS.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.labelTr}. ${c.hintTr}`}
                  onPress={() => handleSelectCollection(c.id)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#e8e2d8',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                    },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <RNText allowFontScaling={false} style={{ fontSize: 26, lineHeight: 32 }}>
                    {c.emoji}
                  </RNText>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" style={{ fontSize: 16, color: '#111' }}>
                      {c.labelTr}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {c.hintTr}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={palette.inkFaint} />
                </Pressable>
              ))}
            </View>

            {/* Bana menü hazırla — tek tarif değil, komple sofra */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bana menü hazırla"
              onPress={() => router.push('/menu')}
              style={({ pressed }) => [
                {
                  marginTop: 16,
                  backgroundColor: palette.brand,
                  borderRadius: 16,
                  padding: spacing.xl,
                  gap: 6,
                  overflow: 'hidden',
                },
                pressed && { opacity: 0.9 },
              ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#fff" />
                <Text variant="eyebrow" tone="inverse">
                  YENİ
                </Text>
              </View>
              <Text variant="display" tone="inverse" style={{ fontSize: 24, lineHeight: 28, fontWeight: '800' }}>
                Bana menü hazırla
              </Text>
              <Text variant="body" tone="inverse" style={{ fontSize: 15, width: '80%', opacity: 0.95 }}>
                Birkaç soru sor, ara sıcaktan içeceğe kadar birbirine uyan komple bir sofra kur.
              </Text>
              <ChefHat
                size={96}
                color="rgba(255,255,255,0.18)"
                style={{ position: 'absolute', right: -12, bottom: -18 }}
              />
            </Pressable>
          </View>

          {/* Trend Recipes */}
          <View style={{ marginTop: 36, marginLeft: -spacing.xl }}>
            <RecipeRail
              title="Trend Tarifler"
              recipes={trending}
              onSeeAll={() => router.push('/ara')}
            />
          </View>

          {/* Quick Selections (Grid) */}
          <View style={{ paddingHorizontal: spacing.xl, marginTop: 16 }}>
            <Text variant="h2" style={{ fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#222' }}>
              Hızlı Seçimler
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {['Hamburger', 'Pizza', 'Tatlı', 'Salata'].map((cat, i) => (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat} tarifleri`}
                  style={{ width: HALF_WIDTH, height: HALF_WIDTH, borderRadius: 12, overflow: 'hidden' }}>
                  <Image source={{ uri: `https://loremflickr.com/400/400/food,${cat}?random=${i + 10}` }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', padding: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{cat}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Wizard layout for steps > 0
  return (
    <Screen
      progress={(index + 1) / steps.length}
      footer={
        <View style={styles.footer}>
          {index > 0 ? (
            <View style={styles.footerBack}>
              <Button label="Geri" variant="quiet" onPress={back} />
            </View>
          ) : null}
          <View style={styles.footerNext}>
            <Button
              label={selected ? 'Devam et' : 'Fark etmez, geç'}
              variant={selected ? 'primary' : 'secondary'}
              onPress={next}
            />
          </View>
        </View>
      }>
      <View style={styles.head}>
        <Text variant="display" tone="brandDeep" style={{ fontSize: 32, lineHeight: 36, marginBottom: 8 }}>
          {step!.question}
        </Text>
      </View>

      <View style={styles.options}>
        {step!.options.map((o) => {
          const ingredient = o.slug ? BY_SLUG.get(o.slug) : undefined;
          return (
            <OptionCard
              key={o.value}
              title={o.label}
              description={o.description}
              /**
               * Fotoğraf yalnızca bir yiyeceği temsil eden seçenekte.
               * "20 dakika" ya da "az malzemeli" için yemek fotoğrafı koymak
               * hem bilgi taşımıyor hem yanıltıyor.
               */
              imageUrl={o.slug ? `https://loremflickr.com/300/300/food,dish?random=${o.slug}` : undefined}
              selected={selected === o.value}
              onPress={() => answer(step!.id, o.value)}
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingBottom: spacing.xs },
  options: { gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
  footerBack: { width: 104 },
  footerNext: { flex: 1 },
  card: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryRow: { gap: 2 },
  pending: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.brandSoftBorder,
    backgroundColor: palette.brandSoft,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    rowGap: spacing.xl,
  },
});
