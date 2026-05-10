import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../utils/theme';

type TimerDisplayProps = {
  remainingSeconds: number;
  totalSeconds: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  paused?: boolean;
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

function progressColor(p: number): string {
  if (p < 0.5) return colors.cosmic.purpleLight;
  if (p < 0.8) return colors.cosmic.tealLight;
  return colors.cosmic.goldLight;
}

function progressBg(p: number): string {
  if (p < 0.5) return 'rgba(124,58,237,0.09)';
  if (p < 0.8) return 'rgba(13,148,136,0.09)';
  return 'rgba(217,119,6,0.09)';
}

export function TimerDisplay({
  remainingSeconds,
  totalSeconds,
  label = 'Remaining',
  size = 'lg',
  paused = false,
}: TimerDisplayProps) {
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const progressPercent = Math.round(progress * 100);
  const accent = paused ? colors.text.muted : progressColor(progress);
  const bg = paused ? 'rgba(71,85,105,0.07)' : progressBg(progress);

  const clockSize =
    size === 'lg' ? typography.sizes.display
    : size === 'md' ? typography.sizes.xxl
    : typography.sizes.xl;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderColor: `${accent}28`,
          shadowColor: accent,
          shadowOpacity: paused ? 0.04 : 0.16 + progress * 0.2,
          shadowRadius: 22,
          elevation: 10,
        },
      ]}
    >
      {/* Top edge glow — brightens as progress increases */}
      <View
        style={[
          styles.topEdge,
          { backgroundColor: accent, opacity: paused ? 0.2 : 0.45 + progress * 0.55 },
        ]}
      />

      {/* Status label */}
      <Text style={styles.label}>
        {paused ? 'PAUSED' : label.toUpperCase()}
      </Text>

      {/* Clock digits */}
      <Text
        style={[
          styles.clock,
          { fontSize: clockSize, color: paused ? colors.text.muted : colors.text.primary },
        ]}
      >
        {formatClock(remainingSeconds)}
      </Text>

      {/* Progress track */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progressPercent}%`, backgroundColor: accent }]} />
      </View>

      {/* Percentage badge */}
      <View style={[styles.pctBadge, { borderColor: `${accent}28`, backgroundColor: `${accent}12` }]}>
        <Text style={[styles.pctText, { color: accent }]}>
          {progressPercent}% complete
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    paddingVertical: spacing.xl + 4,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  label: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.tracking.widest,
  },
  clock: {
    fontWeight: typography.weights.heavy,
    letterSpacing: typography.tracking.tight,
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  pctBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  pctText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
