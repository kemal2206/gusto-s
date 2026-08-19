import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Bookmark,
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  NotebookPen,
  Play,
  Plus,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { RecipeTile, TILE_WIDTH } from '@/components/recipe-tile';
import { Text } from '@/components/ui/text';
import {
  recipeOf,
  relativeDay,
  useCookbookItems,
  type CookbookItem,
} from '@/lib/cookbook';
import { PLATFORM_LABELS } from '@/lib/cookbook/video';
import { useTabReset } from '@/lib/use-tab-reset';
import { fontFamily, palette, radius, spacing, tabularNums } from '@/theme/tokens';

/**
 * Gusto's — kullanıcının yemek kitabı.
 *
 * Her bölüm kendi başlığıyla ve kendi **yatay şeridiyle** duruyor: daha önce
 * yaptıkların, videoların, sonra kaydettiklerin cinsine göre. Sekmeli düzende
 * "Yaptıkların" ve "Videolar" ancak sekmeye basınca görünüyordu; burada hepsi
 * tek akışta ve kaydırarak.
 *
 * Video kartı kasten "oynatıcı" değil: kapak, başlık ve hesap adı gösterip
 * dokununca platformun kendi uygulamasını açıyor. Videoyu biz barındırmıyor,
 * yeniden yayınlamıyoruz — bağlantı veriyoruz.
 */

const SAND = '#fbf9f6';
/**
 * Kart zemini sayfadan bir ton koyu.
 *
 * Sayfa açık, kartlar ondan koyu bej, kartın içindeki satırlar beyaz. Üç
 * kademe göz için net bir derinlik sırası kuruyor.
 */
const CARD = '#f4f1ea';

export default function CookbookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fabOpen, setFabOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const view = useCookbookItems();

  const videoItems = view.all.filter((i) => i.kind === 'video');

  const isKendiDone = view.counts.kendi > 0;
  const isTarifDone = view.counts.tarif > 0;
  const isCookedDone = view.cooked.length > 0;
  /** Üç görevden kaçı bitti — akordeon başlığındaki halka ve sayaç. */
  const completedCount = [isKendiDone, isTarifDone, isCookedDone].filter(Boolean).length;
  const showOnboarding = !(isKendiDone && isTarifDone && isCookedDone);

  // Sekmeye basınca açık alt sayfayı kapat.
  useTabReset(() => setFabOpen(false));

  return (
    /**
     * Sayfa `Screen` yerine elle kuruluyor. `Screen` içeriği bir ScrollView'e
     * sarıyor ve "+" düğmesi de o kaydırma alanının içinde kalıyordu — aşağı
     * inince ekrandan çıkıyordu. Burada kaydırılan katman ile sabit katman
     * ayrı: düğme her zaman görünür.
     */
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* ── Başlık ───────────────────────────────────────────── */}
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text variant="display" style={styles.title}>
              Gusto&apos;s
            </Text>
            <Text variant="caption" tone="muted" style={tabularNums}>
              {`${view.counts.tarif} tarif · ${view.counts.video} video · ${view.counts.kendi} kendi tarifin`}
            </Text>
          </View>
        </View>

        {/* ── Başlangıç akordeonu ──────────────────────────────── */}
        {showOnboarding && (
          <View style={styles.accordionBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hadi yemek yapalım, ${completedCount} / 3 tamamlandı`}
              accessibilityState={{ expanded: accordionOpen }}
              onPress={() => setAccordionOpen(!accordionOpen)}
              style={styles.accordionHeader}>
              <View style={styles.accordionHeaderLeft}>
                <ProgressRing done={completedCount} total={3} />
                <View>
                  <Text variant="bodyStrong" style={styles.accordionTitle}>
                    Hadi Yemek Yapalım!
                  </Text>
                  <Text variant="caption" tone="muted">{`${completedCount} / 3 tamamlandı`}</Text>
                </View>
              </View>
              {accordionOpen ? (
                <ChevronUp size={18} color={palette.inkMuted} />
              ) : (
                <ChevronDown size={18} color={palette.inkMuted} />
              )}
            </Pressable>

            {accordionOpen && (
              <View style={styles.accordionBody}>
                <Text style={styles.accWelcome}>Hoş geldin</Text>
                <Text style={styles.accTitle}>Hadi yemek yapalım!</Text>

                <View style={styles.taskList}>
                  <TaskRow
                    title="İlk Tarifini Yap"
                    icon={<NotebookPen size={16} color={palette.brand} />}
                    done={isKendiDone}
                    onPress={() => router.push('/gustos-ekle/tarif')}
                  />
                  <TaskRow
                    title="Tarif Kaydet"
                    icon={<Bookmark size={16} color={palette.brand} />}
                    done={isTarifDone}
                    onPress={() => router.push('/ara')}
                  />
                  <TaskRow
                    title="Bunu Pişirdim İşaretle"
                    icon={<ChefHat size={16} color={palette.brand} />}
                    done={isCookedDone}
                    onPress={() => router.push('/ara')}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Bölümler ─────────────────────────────────────────── */}
        {!view.all.length ? (
          <View style={styles.emptyContainer}>
            <Text variant="body" tone="muted" style={styles.emptyLead}>
              Henüz tarif eklenmedi
            </Text>

            <View style={styles.emptyCard}>
              <Image
                source={require('../../../assets/images/gustos_collage_noborder.png')}
                style={styles.emptyImage}
                contentFit="contain"
              />
              <Text variant="display" style={styles.emptyTitle}>
                Hadi yemek
              </Text>
              <Text style={styles.emptyScript}>yapalım!</Text>
              <Text variant="body" tone="muted" style={{ marginTop: spacing.md }}>
                İlk tarifini ekleyerek başla
              </Text>
            </View>

            {/* Ok sağ alttaki "+" düğmesini işaret ediyor. */}
            <View style={styles.arrowRow}>
              <Text style={styles.handArrow}>→</Text>
            </View>
          </View>
        ) : (
          <>
            {view.cooked.length ? (
              <Rail title="Daha önce yaptıkların">
                {view.cooked.map((entry) => (
                  <Pressable
                    key={entry.item.id}
                    accessibilityRole="button"
                    accessibilityLabel={titleOf(entry.item)}
                    onPress={() => openItem(entry.item, router)}
                    style={({ pressed }) => [styles.cookedCard, pressed && styles.pressed]}>
                    <View style={styles.cookedBadge}>
                      <ChefHat size={16} color={palette.surface} />
                    </View>
                    <Text variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>
                      {titleOf(entry.item)}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {entry.count > 1
                        ? `${relativeDay(entry.at)} · ${entry.count} kez`
                        : relativeDay(entry.at)}
                    </Text>
                  </Pressable>
                ))}
              </Rail>
            ) : null}

            {videoItems.length ? (
              <Rail title="Videolar">
                {videoItems.map((item) => (
                  <View key={item.id} style={{ width: TILE_WIDTH }}>
                    <ItemCard item={item} />
                  </View>
                ))}
              </Rail>
            ) : null}

            {view.sections.map((sec) => (
              <Rail key={sec.id} title={`${sec.emoji}  ${sec.labelTr}`}>
                {sec.items.map((item) => (
                  <View key={item.id} style={{ width: TILE_WIDTH }}>
                    <ItemCard item={item} />
                  </View>
                ))}
              </Rail>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Sabit "+" düğmesi ve menüsü ──────────────────────────── */}
      {/**
        * Karartma katmanına `accessibilityRole="button"` VERİLMİYOR: web'de
        * `<button>` olarak çiziliyor ve içindeki satır düğmeleri ona gömülü
        * kalıyordu — iç içe `<button>` geçersiz HTML. Kapatma erişimi alt
        * sayfanın tutamağına taşındı.
        */}
      {fabOpen && (
        <Pressable style={styles.fabOverlay} onPress={() => setFabOpen(false)}>
          {/* Alt sayfa yalnızca iki satır kadar; altında boşluk bırakmıyor. */}
          <View
            style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menüyü kapat"
              onPress={() => setFabOpen(false)}
              hitSlop={12}
              style={styles.sheetHandle}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tarif ekleme, kendi tarifini oluştur"
              style={styles.sheetItem}
              onPress={() => {
                setFabOpen(false);
                router.push('/gustos-ekle/tarif');
              }}>
              <View style={styles.sheetIconWrap}>
                <NotebookPen size={20} color={palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                  Tarif Ekleme
                </Text>
                <Text variant="caption" tone="muted">
                  Kendi tarifini oluştur
                </Text>
              </View>
              <ChevronRight size={20} color={palette.inkMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sosyal medyadan yükle, bağlantı ile tarif aktar"
              style={[styles.sheetItem, styles.sheetItemLast]}
              onPress={() => {
                setFabOpen(false);
                router.push('/gustos-ekle/video');
              }}>
              <View style={styles.sheetIconWrap}>
                <Bookmark size={20} color={palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16 }}>
                  Sosyal Medyadan Yükle
                </Text>
                <Text variant="caption" tone="muted">
                  Bağlantı ile tarif aktar
                </Text>
              </View>
              <ChevronRight size={20} color={palette.inkMuted} />
            </Pressable>
          </View>
        </Pressable>
      )}

      {!fabOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tarif ekle"
          style={[styles.fabButton, { bottom: insets.bottom + 20 }]}
          onPress={() => setFabOpen(true)}>
          <Plus size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

// ── Parçalar ─────────────────────────────────────────────────────

/**
 * Başlıklı yatay şerit.
 *
 * Ekranın kenarına kadar uzanıyor (`marginHorizontal` yok, iç boşluk
 * kaydırma içeriğinde): kartların kenardan taşması şeridin kaydırılabilir
 * olduğunu kendiliğinden anlatıyor.
 */
function Rail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.rail}>
      <Text variant="h3" tone="brandDeep" style={styles.sectionTitle}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railStrip}>
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * Tamamlanan görevleri gösteren ilerleme halkası.
 *
 * Kontur sabit bir çerçeve değil, dolan bir çubuk: üç görevin kaçı bittiyse
 * halkanın o kadarı marka rengine boyanıyor. SVG kullanılıyor çünkü yay
 * çizmenin başka yolu yok — `borderWidth` ile kısmi daire olmuyor.
 */
function ProgressRing({ done, total, size = 34 }: { done: number; total: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={palette.brandSoftBorder}
          strokeWidth={stroke}
          fill={palette.brandSoft}
        />
        {ratio > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={palette.brand}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            strokeLinecap="round"
            // Yay saat 12'den başlasın; SVG varsayılanı saat 3.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Check size={14} color={palette.brand} strokeWidth={3} />
    </View>
  );
}

function titleOf(item: CookbookItem): string {
  if (item.kind === 'video' || item.kind === 'kendi') return item.title;
  return recipeOf(item)?.title ?? item.recipeSlug;
}

function openItem(item: CookbookItem, router: ReturnType<typeof useRouter>) {
  if (item.kind === 'tarif') {
    router.push({ pathname: '/tarif/[slug]', params: { slug: item.recipeSlug } });
  } else if (item.kind === 'kendi') {
    router.push({ pathname: '/kendi-tarif/[id]', params: { id: item.id } });
  } else {
    // Platformun kendi uygulaması açılsın; kurulu değilse tarayıcı devralır.
    void Linking.openURL(item.url).catch(() => {});
  }
}

function ItemCard({ item }: { item: CookbookItem }) {
  const router = useRouter();

  if (item.kind === 'tarif') {
    const recipe = recipeOf(item);
    if (!recipe) return null;
    return <RecipeTile recipe={recipe} fluid />;
  }

  const isVideo = item.kind === 'video';

  return (
    <Pressable
      accessibilityRole={isVideo ? 'link' : 'button'}
      accessibilityLabel={
        isVideo ? `${item.title}, ${PLATFORM_LABELS[item.platform]}'ta aç` : item.title
      }
      onPress={() => openItem(item, router)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.art}>
        {isVideo && item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.artBlank]}>
            <NotebookPen size={30} color={palette.brandDeep} />
          </View>
        )}

        {isVideo ? (
          <View style={styles.playBadge}>
            <Play size={14} color="#fff" fill="#fff" />
          </View>
        ) : null}

        <View style={styles.artFoot}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.artTitle}>
            {item.title}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {isVideo ? (
          <>
            <ExternalLink size={12} color={palette.inkMuted} />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.author
                ? `${PLATFORM_LABELS[item.platform]} · ${item.author}`
                : PLATFORM_LABELS[item.platform]}
            </Text>
          </>
        ) : (
          <Text variant="caption" tone="muted" numberOfLines={1} style={tabularNums}>
            {item.kind === 'kendi' && item.minutes ? `${item.minutes} dk · ` : ''}
            Senin tarifin
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function TaskRow({
  title,
  icon,
  done,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? `${title}, tamamlandı` : title}
      style={({ pressed }) => [styles.taskRow, pressed && styles.pressed]}
      onPress={onPress}>
      <View style={styles.taskIconWrap}>
        {done ? <Check size={16} color={palette.brand} /> : icon}
      </View>
      <Text
        variant="bodyStrong"
        style={[styles.taskTitle, done && styles.taskTitleDone]}>
        {title}
      </Text>
      {done ? null : <ChevronRight size={18} color={palette.borderStrong} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: SAND },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  title: { fontSize: 32, lineHeight: 38, fontFamily: 'ShadowsIntoLight_400Regular', color: '#111' },

  // ── Akordeon ───────────────────────────────────────────────────
  accordionBox: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    backgroundColor: CARD,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  accordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accordionTitle: { fontSize: 15, color: '#111' },
  accordionBody: { paddingBottom: spacing.md },
  accWelcome: {
    fontFamily: 'ShadowsIntoLight_400Regular',
    fontSize: 22,
    lineHeight: 26,
    color: palette.brand,
    alignSelf: 'center',
  },
  // "Hoş geldin" el yazısı, altındaki başlık düz — referanstaki ikili.
  // Özel yazı tipinde `fontWeight` işlemiyor, kalın aile doğrudan veriliyor.
  accTitle: {
    fontSize: 20,
    lineHeight: 26,
    alignSelf: 'center',
    color: '#111',
    fontFamily: fontFamily.bold,
  },
  taskList: { gap: spacing.xs, marginTop: spacing.md },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radius.md,
  },
  taskIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { flex: 1, fontSize: 15 },
  taskTitleDone: { color: palette.inkMuted, textDecorationLine: 'line-through' },

  // ── Bölüm şeritleri ────────────────────────────────────────────
  rail: { gap: spacing.md, marginTop: spacing['2xl'] },
  sectionTitle: { fontFamily: 'ShadowsIntoLight_400Regular', fontSize: 24, paddingHorizontal: spacing.xl },
  railStrip: { paddingHorizontal: spacing.xl, gap: spacing.md },

  cookedCard: {
    width: TILE_WIDTH,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.border,
  },
  cookedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
    marginBottom: spacing.xs,
  },

  // ── Boş durum ──────────────────────────────────────────────────
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl },
  emptyLead: { fontSize: 15, marginBottom: spacing.lg, paddingHorizontal: spacing.xl, textAlign: 'center' },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    width: '86%',
    alignItems: 'center',
  },
  emptyImage: { width: 128, height: 128 },
  emptyTitle: { fontSize: 26, lineHeight: 32, color: '#111', marginTop: spacing.md },
  emptyScript: {
    fontSize: 38,
    lineHeight: 44,
    marginTop: -4,
    fontFamily: 'ShadowsIntoLight_400Regular',
    color: palette.brand,
  },
  arrowRow: { width: '100%', alignItems: 'flex-end', paddingRight: 88, marginTop: spacing.sm },
  handArrow: {
    fontSize: 32,
    color: palette.brand,
    fontFamily: 'ShadowsIntoLight_400Regular',
    transform: [{ rotate: '12deg' }],
  },

  // ── Sabit düğme ve alt sayfa ───────────────────────────────────
  fabOverlay: {
    // `StyleSheet.absoluteFillObject` bu React Native sürümünün tiplerinde
    // yok; birebir karşılığı olan dört özellik açıkça yazıldı.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: SAND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  /**
   * Satırlar ayraç çizgisiyle değil, aralarında boşluk olan ayrı beyaz
   * kartlar hâlinde — her satırın kendi dokunma alanı olduğu böyle belli.
   */
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  // Son satırın altında boşluk yok: sayfa iki kutu kadar yer kaplasın.
  sheetItemLast: { marginBottom: 0 },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 11,
  },

  // ── Kart ───────────────────────────────────────────────────────
  card: { gap: spacing.sm },
  art: {
    width: '100%',
    height: 250,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  artBlank: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.brandSoft },
  artFoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  artTitle: { color: '#fff', fontSize: 14, lineHeight: 18 },
  playBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  pressed: { opacity: 0.85 },
});
