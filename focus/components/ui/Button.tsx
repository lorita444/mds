import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';
import { colors, radius, typography, spacing } from '../../utils/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'crystal';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantStyles: Record<Variant, { bg: string; border: string; text: string }> = {
  primary: {
    bg: colors.cosmic.purple,
    border: colors.cosmic.purpleGlow,
    text: colors.text.primary,
  },
  secondary: {
    bg: colors.bg.elevated,
    border: colors.bg.cardBorder,
    text: colors.text.primary,
  },
  ghost: {
    bg: 'transparent',
    border: colors.bg.cardBorder,
    text: colors.text.accent,
  },
  danger: {
    bg: colors.status.error,
    border: 'rgba(239,68,68,0.4)',
    text: colors.text.primary,
  },
  crystal: {
    bg: 'rgba(56,189,248,0.15)',
    border: colors.crystal.glow,
    text: colors.crystal.primary,
  },
};

const sizeStyles: Record<Size, { py: number; px: number; fontSize: number; radius: number }> = {
  sm: { py: 10, px: 16, fontSize: typography.sizes.sm, radius: radius.md },
  md: { py: 14, px: 24, fontSize: typography.sizes.base, radius: radius.lg },
  lg: { py: 18, px: 32, fontSize: typography.sizes.md, radius: radius.xl },
};

export function Button({
  label,
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
          borderRadius: s.radius,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          gap: spacing.sm,
          opacity: pressed ? 0.75 : isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? ('stretch' as const) : ('auto' as const),
        },
        style as object,
      ]}
      {...props}
    >
      {loading && (
        <ActivityIndicator size="small" color={v.text} />
      )}
      <Text
        style={{
          color: v.text,
          fontSize: s.fontSize,
          fontWeight: typography.weights.semibold,
          letterSpacing: typography.tracking.wide,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
