import { View, Image } from 'react-native';
import { colors, radius } from '../../utils/theme';
import { REWARD_CAPSULE } from '../../utils/assets';
import type { Rarity } from '../../lib/types';

type RewardBoxPlaceholderProps = {
  size?: number;
  rarity?: Rarity;
  locked?: boolean;
};

export function RewardBoxPlaceholder({
  size = 80,
  rarity = 'common',
  locked = false,
}: RewardBoxPlaceholderProps) {
  const rarityStyle = locked
    ? { bg: 'rgba(71,85,105,0.2)', glow: 'rgba(71,85,105,0.3)', color: colors.text.muted }
    : colors.rarity[rarity];

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: rarityStyle.color,
        shadowOpacity: locked ? 0 : 0.5,
        shadowRadius: size * 0.2,
        shadowOffset: { width: 0, height: 0 },
        elevation: locked ? 0 : 8,
      }}
    >
      {/* Rarity ring behind the capsule */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: rarityStyle.bg,
          borderWidth: 1.5,
          borderColor: rarityStyle.glow,
        }}
      />
      <Image
        source={REWARD_CAPSULE}
        style={{ width: size, height: size, opacity: locked ? 0.4 : 1 }}
        resizeMode="contain"
      />
    </View>
  );
}
