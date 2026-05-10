import { Pressable, Text, ActivityIndicator, View, type PressableProps } from 'react-native';
import { colors, radius, typography, spacing } from '../../utils/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'crystal';
type Size = 'sm' | 'md' | 'lg';

type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

type VariantStyle = {
  bg: string;
  border: string;
  text: string;
  shadow?: ShadowStyle;
};

type ButtonProps = PressableProps & {
  label: string;
  loadingLabel?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantStyles: Record<Variant, VariantStyle> = {
  primary: {
    bg: colors.cosmic.purple,
    border: 'rgba(167,139,250,0.6)',
    text: colors.text.primary,
    shadow: {
      shadowColor: colors.cosmic.purple,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.55,
      shadowRadius: 18,
      elevation: 12,
    },
  },
  secondary: {
    bg: colors.bg.elevated,
    border: 'rgba(139,92,246,0.35)',
    text: colors.text.primary,
  },
  ghost: {
    bg: 'transparent',
    border: 'rgba(139,92,246,0.45)',
    text: colors.text.accent,
  },
  danger: {
    bg: colors.status.error,
    border: 'rgba(239,68,68,0.5)',
    text: colors.text.primary,
    shadow: {
      shadowColor: colors.status.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  crystal: {
    bg: 'rgba(56,189,248,0.14)',
    border: 'rgba(56,189,248,0.5)',
    text: colors.crystal.primary,
    shadow: {
      shadowColor: colors.crystal.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
  },
};

const sizeStyles: Record<Size, { py: number; px: number; fontSize: number; borderRadius: number }> = {
  sm: { py: 10, px: 18, fontSize: typography.sizes.sm, borderRadius: radius.md },
  md: { py: 15, px: 26, fontSize: typography.sizes.base, borderRadius: radius.lg },
  lg: { py: 20, px: 36, fontSize: typography.sizes.md, borderRadius: radius.xl },
};

export function Button({
  label,
  loadingLabel,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderWidth: 1,
          borderColor: v.border,
          borderRadius: s.borderRadius,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          gap: spacing.sm,
          alignSelf: fullWidth ? ('stretch' as const) : ('auto' as const),
          opacity: isDisabled ? 0.45 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
          // Glow shadow (only when not disabled, not pressed)
          ...(v.shadow && !isDisabled && !pressed ? v.shadow : {}),
        },
        style as object,
      ]}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color={v.text} />}
      <Text
        style={{
          color: v.text,
          fontSize: s.fontSize,
          fontWeight: typography.weights.semibold,
          letterSpacing: typography.tracking.wide,
        }}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
