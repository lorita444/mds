import { View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '../../utils/theme';

type CardVariant = 'default' | 'elevated' | 'glow' | 'flat';

type CardProps = ViewProps & {
  variant?: CardVariant;
  padding?: number;
  glowColor?: string;
};

const variantStyles: Record<CardVariant, { bg: string; border: string }> = {
  default: { bg: colors.bg.card, border: colors.bg.cardBorder },
  elevated: { bg: colors.bg.elevated, border: colors.bg.cardBorder },
  glow: { bg: colors.bg.card, border: colors.cosmic.purpleGlow },
  flat: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
};

export function Card({
  variant = 'default',
  padding = spacing.md,
  glowColor,
  style,
  children,
  ...props
}: CardProps) {
  const v = variantStyles[variant];

  return (
    <View
      style={[
        {
          backgroundColor: v.bg,
          borderWidth: 1,
          borderColor: glowColor ?? v.border,
          borderRadius: radius.lg,
          padding,
        },
        style as object,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
