import { View, Text, Image } from 'react-native';
import { colors } from '../../utils/theme';
import { CRYSTAL_ICON } from '../../utils/assets';

type CrystalIconProps = {
  size?: number;
  amount?: number;
  showAmount?: boolean;
  fontSize?: number;
};

export function CrystalIcon({ size = 24, amount, showAmount = true, fontSize }: CrystalIconProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Image source={CRYSTAL_ICON} style={{ width: size, height: size }} resizeMode="contain" />
      {showAmount && amount !== undefined && (
        <Text
          style={{
            color: colors.crystal.primary,
            fontSize: fontSize ?? (size * 0.6),
            fontWeight: '700',
          }}
        >
          {amount.toLocaleString()}
        </Text>
      )}
    </View>
  );
}
