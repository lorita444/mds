import { View, Text } from 'react-native';
import { colors, typography, spacing, radius } from '../../utils/theme';

type TimerDisplayProps = {
  remainingSeconds: number;
  totalSeconds: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerDisplay({
  remainingSeconds,
  totalSeconds,
  label = 'Remaining',
  size = 'lg',
}: TimerDisplayProps) {
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const progressPercent = Math.round(progress * 100);

  const clockSize =
    size === 'lg'
      ? typography.sizes.display
      : size === 'md'
      ? typography.sizes.xxl
      : typography.sizes.xl;

  return (
    <View
      style={{
        backgroundColor: colors.bg.card,
        borderWidth: 1,
        borderColor: colors.cosmic.purpleFaint,
        borderRadius: radius.xxl,
        padding: spacing.xl,
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {/* Glow ring */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: colors.cosmic.purple,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          opacity: 0.6 + progress * 0.4,
        }}
      />

      <Text
        style={{
          color: colors.text.muted,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
          letterSpacing: typography.tracking.widest,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: colors.text.primary,
          fontSize: clockSize,
          fontWeight: typography.weights.heavy,
          letterSpacing: typography.tracking.tight,
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatClock(remainingSeconds)}
      </Text>

      {/* Progress bar */}
      <View
        style={{
          width: '100%',
          height: 4,
          backgroundColor: colors.bg.input,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: colors.cosmic.purple,
            borderRadius: radius.full,
          }}
        />
      </View>

      <Text
        style={{
          color: colors.text.muted,
          fontSize: typography.sizes.xs,
        }}
      >
        {progressPercent}% complete
      </Text>
    </View>
  );
}
