import { View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '../../utils/theme';

type CardVariant = 'default' | 'elevated' | 'glow' | 'flat';

type CardProps = ViewProps & {
  variant?: CardVariant;
  padding?: number;
  glowColor?: string;
};

type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

const variantStyles: Record<CardVariant, { bg: string; border: string; shadow?: Shadow }> = {
  default: { bg: colors.bg.card, border: colors.bg.cardBorder },
  elevated: {
    bg: colors.bg.elevated,
    border: colors.bg.cardBorder,
    shadow: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },
  },
  glow: {
    bg: colors.bg.card,
    border: colors.cosmic.purpleGlow,
    shadow: {
      shadowColor: colors.cosmic.purple,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
  },
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
          ...(v.shadow ?? {}),
        },
        style as object,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
