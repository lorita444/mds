import { View, Text, Image } from 'react-native';
import { colors, typography } from '../../utils/theme';
import { getPlanetImage, type PlanetRarity } from '../../utils/assets';
import type { Rarity } from '../../lib/types';

type PlanetPlaceholderProps = {
  size?: number;
  rarity?: Rarity;
  name?: string;
  isStarter?: boolean;
};

export function PlanetPlaceholder({
  size = 120,
  rarity = 'common',
  name,
  isStarter = false,
}: PlanetPlaceholderProps) {
  const effectiveRarity: PlanetRarity = isStarter ? 'starter' : rarity;
  const rarityStyle = isStarter
    ? { bg: 'rgba(124,58,237,0.2)', glow: 'rgba(124,58,237,0.45)', color: colors.cosmic.purpleLight }
    : colors.rarity[rarity];
  const image = getPlanetImage(effectiveRarity, name ?? rarity);

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {/* No overflow: 'hidden' — glow ring must never be clipped */}
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: rarityStyle.color,
          shadowOpacity: 0.7,
          shadowRadius: size * 0.25,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        }}
      >
        {/* Rarity ring behind the image */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: rarityStyle.bg,
            borderWidth: 2,
            borderColor: rarityStyle.glow,
          }}
        />
        <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
      {name && (
        <Text
          style={{
            color: rarityStyle.color,
            fontSize: 12,
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
