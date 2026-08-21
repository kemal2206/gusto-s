import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Share2, ShoppingBasket, Trash2, X } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IngredientAvatar } from '@/components/ui/ingredient-avatar';
import { Text } from '@/components/ui/text';
import { BY_SLUG } from '@/data/catalog';
import { formatAmount } from '@/data/catalog/ev-olcusu';
import type { IngredientCategory } from '@/engine';
import { CATEGORY_LABELS_TR } from '@/engine';
import { gramsOf, recipesOf, useGrocery, type GroceryItem } from '@/lib/store/grocery';
import { spacing } from '@/theme/tokens';

/**
 * Sepet.
 *
 * Liste market reyonlarına göre gruplu, çünkü kullanılacağı yer mutfak değil
 * market: tarif sırasıyla yazılmış bir liste insanı manavla kasap arasında
 * dört kez gezdiriyor. Gruplar reyon sırasında — manavdan başlayıp kasaba,
 * oradan rafa.
 *
 * Satırlar alınınca silinmiyor, üstü çiziliyor ve yerinde kalıyor. Silinseydi
 * liste elin altında kısalır, "bunu almış mıydım" sorusunun cevabı kaybolurdu.
 *
 * Alışverişi bitiren "Alınanları sil" diyor; alınmayanlar bir sonraki sefere
 * kalıyor.
 */

const SAND = '#fbf9f6';
const SAND_DEEP = '#f5f0e6';
const LINE = '#ddd';
const INK = '#111';
const BRAND = '#e6103b';

/**
 * Market içinde yürüme sırası. Alfabetik ya da katalog sırası değil —
 * mağazanın kendi düzeni: manav, kasap, şarküteri, süt reyonu, kuru gıda,
 * raf. Listenin işe yaraması bu sıraya bağlı.
 */
const AISLE_ORDER: IngredientCategory[] = [
  'sebze',
  'ot',
  'mantar',
  'meyve',
  'protein',
  'deniz',
  'sarkuteri',
  'sut',
  'tahil',
  'baklagil',
  'kuruyemis',
  'yag',
  'asit',
  'baharat',
  'tatlandirici',
  'icecek',
  'diger',
];

/** Katalogda karşılığı olmayan satırların reyonu — hep en sonda. */
const OWN_LINES = 'kendi';

/** Satırın ekranda görünen adı. Kendi yazdığı satırda yazdığı hâliyle. */
function nameText(item: GroceryItem): string {
  return BY_SLUG.get(item.slug)?.nameTr ?? item.label ?? item.slug;
}

/**
 * Satırın miktar yazısı: varsa ev ölçüsü, yanında gram.
 *
 * Miktarı olmayan satırda boş dönüyor ve miktar satırı hiç çizilmiyor —
 * "0 g maydanoz" yazmaktansa hiçbir şey yazmamak doğru.
 */
function amountText(item: GroceryItem): string {
  const ing = BY_SLUG.get(item.slug);
  const grams = gramsOf(item);
  if (!ing || grams <= 0) return '';
  return formatAmount(item.slug, ing.category, grams);
}

export default function BasketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useGrocery((s) => s.items);
  const toggleBought = useGrocery((s) => s.toggleBought);
  const remove = useGrocery((s) => s.remove);
  const clearBought = useGrocery((s) => s.clearBought);
  const clear = useGrocery((s) => s.clear);

  const boughtCount = items.filter((i) => i.bought).length;
  const recipeCount = new Set(items.flatMap(recipesOf)).size;

  /**
   * Reyona göre grupla, boş reyonu atla. Katalogda karşılığı olmayan satırlar
   * (kendi tarifinden gelen serbest metin) hiçbir reyona düşmüyor; onlar
   * listenin sonunda kendi başlığı altında duruyor — yoksa ekranda hiç
   * görünmezlerdi.
   */
  const aisles = [
    ...AISLE_ORDER.flatMap((key) => {
      const list = items
        .filter((i) => BY_SLUG.get(i.slug)?.category === key)
        .sort((a, b) => a.addedAt - b.addedAt);
      return list.length ? [{ key, title: CATEGORY_LABELS_TR[key], list }] : [];
    }),
    ...(() => {
      const list = items
        .filter((i) => !BY_SLUG.has(i.slug))
        .sort((a, b) => a.addedAt - b.addedAt);
      return list.length ? [{ key: OWN_LINES, title: 'Kendi yazdıkların', list }] : [];
    })(),
  ];

  const onShare = () => {
    const body = aisles
      .map(
        ({ title, list }) =>
          title.toLocaleUpperCase('tr-TR') +
          '\n' +
          list
            .map((i) => {
              const amount = amountText(i);
              return '• ' + nameText(i) + (amount ? ' — ' + amount : '');
            })
            .join('\n'),
      )
      .join('\n\n');

    Share.share({ message: 'Alışveriş listesi\n\n' + body }).catch(() => {
      /* kullanıcı vazgeçti */
    });
  };

  const onClear = () =>
    Alert.alert('Sepeti boşalt', 'Listedeki her şey silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Boşalt', style: 'destructive', onPress: clear },
    ]);

  return (
    <View style={styles.root}>
      {/* ── Başlık ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <Text style={styles.title}>Sepetim</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <ShoppingBasket size={34} color={INK} />
          </View>
          <Text variant="bodyStrong" style={styles.emptyTitle}>
            Sepetin boş.
          </Text>
          <Text variant="body" style={styles.emptyBody}>
            Bir tarif aç, malzeme satırlarına dokun. Dokunduğun her malzeme
            buraya düşer ve market reyonlarına göre sıralanır.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/ara')}
            style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.8 }]}>
            <Text variant="button" style={{ color: '#fff' }}>
              Tarif ara
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing['3xl'] }}>
            <Text variant="body" style={styles.summary}>
              {items.length + ' malzeme · ' + recipeCount + ' tarif için' +
                (boughtCount ? ' · ' + boughtCount + ' tanesini aldın' : '')}
            </Text>

            {aisles.map(({ key, title, list }) => (
              <View key={key} style={styles.aisle}>
                <Text variant="eyebrow" style={styles.aisleTitle}>
                  {title.toLocaleUpperCase('tr-TR')}
                </Text>

                {list.map((item) => {
                  const ing = BY_SLUG.get(item.slug);
                  const name = nameText(item);
                  const amount = amountText(item);
                  const from = recipesOf(item);

                  return (
                    <View key={item.slug} style={styles.row}>
                      {/**
                       * Satırın tamamı işaretleme düğmesi. Markette telefonu
                       * tek elle tutan biri küçük bir kutucuğa nişan alamaz;
                       * dokunma alanı satırın kendisi kadar geniş.
                       */}
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.bought }}
                        accessibilityLabel={amount ? name + ', ' + amount : name}
                        onPress={() => toggleBought(item.slug)}
                        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]}>
                        <View style={[styles.check, item.bought && styles.checkOn]}>
                          {item.bought ? <Check size={16} color="#fff" /> : null}
                        </View>

                        {/* Katalogda yoksa simgesi de yok; yerini kesik çizgili daire tutuyor. */}
                        {ing ? (
                          <IngredientAvatar ingredient={ing} size={40} />
                        ) : (
                          <View style={styles.rawDot} />
                        )}

                        <View style={{ flex: 1 }}>
                          <Text
                            variant="bodyStrong"
                            style={[styles.name, item.bought && styles.done]}>
                            {name}
                          </Text>
                          {amount ? (
                            <Text
                              variant="body"
                              style={[styles.amount, item.bought && styles.done]}>
                              {amount}
                            </Text>
                          ) : null}
                          {/**
                           * Tarif adı yalnızca sepette birden fazla tarif
                           * varken görünüyor. Tek tariflik listede her satıra
                           * aynı adı yazmak gürültü; karışık listede ise
                           * "maydanozu neden almıştım" sorusunun cevabı.
                           */}
                          {recipeCount > 1 ? (
                            <Text variant="caption" style={styles.source} numberOfLines={1}>
                              {from.join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={name + ' satırını sepetten çıkar'}
                        onPress={() => remove(item.slug)}
                        style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.5 }]}>
                        <X size={18} color="#888" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* ── Alt çubuk ────────────────────────────────────────── */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Listeyi paylaş"
              onPress={onShare}
              style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.85 }]}>
              <Share2 size={18} color="#fff" />
              <Text variant="button" style={{ color: '#fff' }}>
                Listeyi paylaş
              </Text>
            </Pressable>

            <View style={styles.footerRow}>
              {boughtCount ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={clearBought}
                  style={({ pressed }) => [styles.quietButton, pressed && { opacity: 0.6 }]}>
                  <Check size={16} color={INK} />
                  <Text variant="bodyStrong" style={{ color: INK }}>
                    {'Alınanları sil (' + boughtCount + ')'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={onClear}
                style={({ pressed }) => [styles.quietButton, pressed && { opacity: 0.6 }]}>
                <Trash2 size={16} color={INK} />
                <Text variant="bodyStrong" style={{ color: INK }}>
                  Sepeti boşalt
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SAND },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'ShadowsIntoLight_400Regular',
    fontSize: 34,
    lineHeight: 40,
    color: INK,
  },

  summary: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    color: '#666',
  },

  aisle: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  aisleTitle: { color: '#8a6a4a', marginBottom: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 8,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: BRAND, borderColor: BRAND },
  /** Katalogda karşılığı olmayan satırın simge yeri. */
  rawDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c9c9c9',
  },
  name: { fontSize: 16, color: INK, fontWeight: '800' },
  amount: { color: '#555', fontSize: 15, marginTop: 2 },
  source: { color: '#999', marginTop: 2 },
  done: { color: '#aaa', textDecorationLine: 'line-through' },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: SAND,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: BRAND,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  quietButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: SAND_DEEP,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SAND_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, color: INK },
  emptyBody: { color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyButton: {
    marginTop: 24,
    minHeight: 56,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
