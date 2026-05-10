import { View, Text } from 'react-native';
import { colors, spacing, typography } from '../../utils/theme';

type DividerProps = {
  label?: string;
  glow?: boolean;
};

export function Divider({ label, glow = false }: DividerProps) {
  const lineColor = glow ? colors.cosmic.purpleGlow : 'rgba(139,92,246,0.12)';

  if (!label) {
    return (
      <View
        style={{
          height: 1,
          backgroundColor: lineColor,
          marginVertical: spacing.xs,
        }}
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1, height: 1, backgroundColor: lineColor }} />
      <Text
        style={{
          color: colors.text.muted,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: lineColor }} />
    </View>
  );
}
