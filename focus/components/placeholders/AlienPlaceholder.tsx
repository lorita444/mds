import { View, Text, Image } from 'react-native';
import { colors, radius, typography } from '../../utils/theme';
import { getAlienImage, type AlienRarity } from '../../utils/assets';
import type { Rarity } from '../../lib/types';

type AlienPlaceholderProps = {
  size?: number;
  rarity?: Rarity;
  name?: string;
  isRare?: boolean;
};

export function AlienPlaceholder({
  size = 96,
  rarity = 'common',
  name,
  isRare = false,
}: AlienPlaceholderProps) {
  const rarityStyle = colors.rarity[rarity];
  const image = getAlienImage(rarity as AlienRarity, name ?? rarity);

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {/* No overflow: 'hidden' so glow and badge are never clipped */}
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: rarityStyle.color,
          shadowOpacity: 0.5,
          shadowRadius: size * 0.2,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        }}
      >
        {/* Rarity ring behind the image */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius.lg,
            backgroundColor: rarityStyle.bg,
            borderWidth: 1.5,
            borderColor: rarityStyle.glow,
          }}
        />
        <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
        {isRare && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: colors.cosmic.gold,
              borderRadius: 10,
              width: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10 }}>★</Text>
          </View>
        )}
      </View>
      {name && (
        <Text
          style={{
            color: rarityStyle.color,
            fontSize: 11,
            fontWeight: typography.weights.semibold,
            textAlign: 'center',
          }}
        >
          {name}
        </Text>
      )}
    </View>
  );
}
