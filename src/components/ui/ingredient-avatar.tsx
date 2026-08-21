import { Image } from 'expo-image';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { CATEGORY_EMOJI, INGREDIENT_EMOJI } from '@/data/catalog/gorseller';
import type { Ingredient } from '@/engine';
import { MAX_FONT_SCALE, palette } from '@/theme/tokens';

export interface IngredientAvatarProps {
  ingredient: Pick<Ingredient, 'slug' | 'category' | 'nameTr' | 'imageUrl'>;
  size?: number;
}

/**
 * Malzemenin küçük görseli.
 *
 * Fotoğraf varsa onu, yoksa emoji katmanını gösterir. İkisi de aynı daire
 * içinde çizildiği için liste karışık veriyle de tutarlı görünüyor.
 *
 * Emoji `RNText` ile basılıyor: uygulamanın `Text` bileşeni Inter dayatıyor,
 * emoji ise sistem emoji fontundan gelmeli.
 */
export function IngredientAvatar({ ingredient, size = 40 }: IngredientAvatarProps) {
  const emoji = INGREDIENT_EMOJI[ingredient.slug] ?? CATEGORY_EMOJI[ingredient.category];

  return (
    <View
      // Görsel dekoratif; malzeme adı zaten yanında yazıyor.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {ingredient.imageUrl ? (
        <Image
          source={{ uri: ingredient.imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <Image
          source={{ uri: `https://loremflickr.com/100/100/ingredient,food?random=${ingredient.slug}` }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={120}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
});
