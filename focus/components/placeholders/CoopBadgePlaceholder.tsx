import { View, Text, Image } from 'react-native';
import { colors } from '../../utils/theme';
import { BADGE_COOP } from '../../utils/assets';

type CoopBadgePlaceholderProps = {
  size?: number;
  memberCount?: number;
};

export function CoopBadgePlaceholder({ size = 64, memberCount = 2 }: CoopBadgePlaceholderProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.cosmic.teal,
        shadowOpacity: 0.5,
        shadowRadius: size * 0.2,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }}
    >
      <Image source={BADGE_COOP} style={{ width: size, height: size }} resizeMode="contain" />
      {memberCount > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            backgroundColor: colors.cosmic.teal,
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: colors.text.primary, fontSize: 10, fontWeight: '700' }}>
            {memberCount}
          </Text>
        </View>
      )}
    </View>
  );
}
