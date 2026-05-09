import { View, Text, Image } from 'react-native';
import { colors, radius, typography } from '../../utils/theme';
import { getStructureImage, type StructureRarity } from '../../utils/assets';
import type { Rarity } from '../../lib/types';

type CosmicStructurePlaceholderProps = {
  size?: number;
  rarity?: Rarity;
  name?: string;
};

export function CosmicStructurePlaceholder({
  size = 96,
  rarity = 'rare',
  name,
}: CosmicStructurePlaceholderProps) {
  const rarityStyle = colors.rarity[rarity];
  const image = getStructureImage(rarity as StructureRarity, name ?? rarity);

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {/* No overflow: 'hidden' so glow ring is never clipped */}
      <View
        style={{
          width: size,
          height: size * 1.2,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: rarityStyle.color,
          shadowOpacity: 0.5,
          shadowRadius: size * 0.2,
          shadowOffset: { width: 0, height: 0 },
          elevation: 10,
        }}
      >
        {/* Rarity ring behind the image */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size * 1.2,
            borderRadius: radius.md,
            backgroundColor: rarityStyle.bg,
            borderWidth: 1.5,
            borderColor: rarityStyle.glow,
          }}
        />
        <Image
          source={image}
          style={{ width: size, height: size * 1.2 }}
          resizeMode="contain"
        />
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
