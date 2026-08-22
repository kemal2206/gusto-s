import { useRouter } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';

import { CATEGORY_BY_ID, type Recipe } from '@/data/recipes';
import { gorselKaynagi } from '@/data/recipes/gorsel-yerel';
import { useFavorites } from '@/lib/store/favorites';
import { palette, radius, spacing, tabularNums, tintFor } from '@/theme/tokens';

import { Text } from './ui/text';

export const TILE_WIDTH = 168;

/**
 * Yatay raylardaki tarif kartı.
 *
 * Tarifin kendi fotoğrafı varsa (`Recipe.imageUrl`) o gösteriliyor. Yoksa
 * yer tutucuya düşüyoruz — o fotoğrafın tarifle ilgisi yok, sadece kartın
 * boş görünmemesi için duruyor.
 */
export function RecipeTile({ recipe, inverse, fluid, matchHint }: { recipe: Recipe; inverse?: boolean; fluid?: boolean; matchHint?: string }) {
  const router = useRouter();
  const saved = useFavorites((s) => s.slugs.includes(recipe.slug));
  const toggle = useFavorites((s) => s.toggle);

  const category = CATEGORY_BY_ID.get(recipe.categoryId);
  
  const imageSource = gorselKaynagi(recipe.slug, recipe.imageUrl, '400/400');

  return (
    <View style={[styles.tile, fluid && { width: '100%' }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${recipe.title}, ${recipe.totalMinutes} dakika`}
        onPress={() => router.push({ pathname: '/tarif/[slug]', params: { slug: recipe.slug } })}
        style={({ pressed }) => [styles.pressableContainer, pressed && styles.pressed]}>
        <View style={[styles.art, { backgroundColor: tintFor(recipe.categoryId), overflow: 'hidden' }, fluid && { width: '100%' }]}>
          <Image 
            source={imageSource}
            style={{ width: '100%', height: '100%', position: 'absolute' }} 
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.05)' }} />
          
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(0,0,0,0.65)' }}>
            <Text variant="bodyStrong" numberOfLines={2} ellipsizeMode="tail" style={[styles.title, { color: '#fff', marginTop: 0, fontSize: 14, lineHeight: 18 }]}>
              {recipe.title}
            </Text>
          </View>
        </View>

        <Text variant="caption" tone={inverse ? 'inverse' : 'muted'} numberOfLines={1} style={[tabularNums, inverse && { opacity: 0.8 }]}>
          {recipe.totalMinutes} dk · {recipe.components.length > 1
            ? `${recipe.components.length} bileşen`
            : ['Kolay', 'Orta', 'Zor'][recipe.difficulty - 1]}
        </Text>
        {matchHint ? (
          <Text variant="caption" tone={inverse ? 'inverse' : 'brand'} numberOfLines={1} style={{ fontSize: 13, marginTop: -2, fontWeight: '700' }}>
            {matchHint}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? `${recipe.title} kaydından çıkar` : `${recipe.title} kaydet`}
        accessibilityState={{ selected: saved }}
        hitSlop={10}
        onPress={() => toggle(recipe.slug)}
        style={styles.bookmark}>
        <Bookmark
          size={16}
          color={saved ? palette.brand : '#fff'}
          fill={saved ? palette.brand : 'transparent'}
          strokeWidth={2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE_WIDTH, gap: spacing.sm },
  pressableContainer: { gap: spacing.sm },
  art: {
    width: TILE_WIDTH,
    height: 250,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: palette.border,
  },
  emoji: { fontSize: 44, lineHeight: 54 },
  bookmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { marginTop: 2, fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
