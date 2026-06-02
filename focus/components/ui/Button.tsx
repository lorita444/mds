import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';
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
  borderWidth?: number;
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
    border: 'rgba(196,181,253,0.72)',
    text: colors.text.primary,
    borderWidth: 1.5,
    shadow: {
      shadowColor: colors.cosmic.purple,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.42,
      shadowRadius: 14,
      elevation: 8,
    },
  },
  secondary: {
    bg: colors.bg.elevated,
    border: 'rgba(148,163,184,0.28)',
    text: colors.text.primary,
    shadow: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  ghost: {
    bg: 'rgba(124,58,237,0.10)',
    border: 'rgba(167,139,250,0.34)',
    text: colors.text.accent,
  },
  danger: {
    bg: colors.status.error,
    border: 'rgba(239,68,68,0.5)',
    text: colors.text.primary,
    borderWidth: 1.5,
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

const sizeStyles: Record<Size, { py: number; px: number; minHeight: number; fontSize: number; borderRadius: number }> = {
  sm: { py: 9, px: 16, minHeight: 38, fontSize: typography.sizes.sm, borderRadius: radius.sm },
  md: { py: 13, px: 22, minHeight: 48, fontSize: typography.sizes.base, borderRadius: radius.md },
  lg: { py: 16, px: 28, minHeight: 56, fontSize: typography.sizes.md, borderRadius: radius.lg },
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderWidth: v.borderWidth ?? 1,
          borderColor: v.border,
          borderRadius: s.borderRadius,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          minHeight: s.minHeight,
          minWidth: size === 'sm' ? 92 : 120,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          gap: spacing.sm,
          alignSelf: fullWidth ? ('stretch' as const) : ('auto' as const),
          opacity: isDisabled ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }, { translateY: pressed && !isDisabled ? 1 : 0 }],
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
          letterSpacing: typography.tracking.normal,
        }}
      >
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
