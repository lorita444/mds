import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography } from '../../utils/theme';

const RING_SIZE = 224;
const STROKE = 18;
const INNER_SIZE = RING_SIZE - STROKE * 2;

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

type TimerDisplayProps = {
  remainingSeconds: number;
  totalSeconds: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  paused?: boolean;
};

export function TimerDisplay({
  remainingSeconds,
  totalSeconds,
  label = 'Remaining',
  size = 'lg',
  paused = false,
}: TimerDisplayProps) {
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const accent = paused ? colors.text.muted : progressColor(progress);
  const progressPct = Math.round(progress * 100);

  const animProg = useRef(new Animated.Value(progress)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.timing(animProg, {
      toValue: progress,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (paused) {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
      return;
    }
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();
    return () => { pulseRef.current?.stop(); };
  }, [paused]);

  // Right half: sweeps 12→6 o'clock as progress 0→50%
  const rightRotation = animProg.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '0deg', '0deg'],
    extrapolate: 'clamp',
  });

  // Left half: sweeps 6→12 o'clock as progress 50→100%
  const leftRotation = animProg.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '180deg', '360deg'],
    extrapolate: 'clamp',
  });

  const clockFontSize = size === 'lg' ? 52 : size === 'md' ? 42 : 34;
  const glowBaseOpacity = paused ? 0.06 : 0.15 + progress * 0.25;
  const glowInnerOpacity = paused ? 0.10 : 0.22 + progress * 0.3;

  return (
    <View style={styles.wrapper}>
      {/* Outer atmospheric glow */}
      <Animated.View
        style={[
          styles.glowOuter,
          {
            backgroundColor: accent,
            opacity: glowBaseOpacity,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      {/* Inner glow */}
      <Animated.View
        style={[
          styles.glowInner,
          {
            backgroundColor: accent,
            opacity: glowInnerOpacity,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Ring */}
      <View style={{ width: RING_SIZE, height: RING_SIZE }}>
        {/* Track (dim background ring) */}
        <View
          style={[
            styles.ringTrack,
            { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: STROKE },
          ]}
        />

        {/* Right half clip — reveals first 50% of arc */}
        <View style={[styles.halfClipRight, { width: RING_SIZE / 2, height: RING_SIZE }]}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: -(RING_SIZE / 2),
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: STROKE,
              borderColor: accent,
              transform: [{ rotate: rightRotation }],
            }}
          />
        </View>

        {/* Left half clip — reveals 50-100% of arc */}
        <View style={[styles.halfClipLeft, { width: RING_SIZE / 2, height: RING_SIZE }]}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderWidth: STROKE,
              borderColor: accent,
              transform: [{ rotate: leftRotation }],
            }}
          />
        </View>

        {/* Inner mask — creates the donut hole */}
        <View
          style={[
            styles.innerMask,
            { width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_SIZE / 2 },
          ]}
        />

        {/* Center content */}
        <View
          style={[
            styles.centerContent,
            { width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_SIZE / 2 },
          ]}
        >
          <Text style={styles.label}>{paused ? 'PAUSED' : label.toUpperCase()}</Text>
          <Text
            style={[
              styles.clock,
              { fontSize: clockFontSize, color: paused ? colors.text.muted : colors.text.primary },
            ]}
          >
            {formatClock(remainingSeconds)}
          </Text>
          <Text style={[styles.pct, { color: accent }]}>{progressPct}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: RING_SIZE + 88,
    height: RING_SIZE + 88,
    borderRadius: (RING_SIZE + 88) / 2,
  },
  glowInner: {
    position: 'absolute',
    width: RING_SIZE + 36,
    height: RING_SIZE + 36,
    borderRadius: (RING_SIZE + 36) / 2,
  },
  ringTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  halfClipRight: {
    position: 'absolute',
    top: 0,
    left: RING_SIZE / 2,
    overflow: 'hidden',
  },
  halfClipLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  innerMask: {
    position: 'absolute',
    top: STROKE,
    left: STROKE,
    backgroundColor: colors.bg.primary,
  },
  centerContent: {
    position: 'absolute',
    top: STROKE,
    left: STROKE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  clock: {
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  pct: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
