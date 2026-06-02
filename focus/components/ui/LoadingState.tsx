import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { APP_ICON } from '../../utils/assets';
import { colors, typography, spacing } from '../../utils/theme';

const { width: W } = Dimensions.get('window');

type LoadingStateProps = {
  message?: string;
  subtitle?: string;
  fullscreen?: boolean;
};

export function LoadingState({
  message = 'Loading...',
  subtitle,
  fullscreen = true,
}: LoadingStateProps) {
  const breathe = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeIn, breathe]);

  // Each ring interpolates at different intensities — outer rings stay subtle,
  // inner rings pulse more strongly, creating natural atmospheric depth
  const r1 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.025, 0.07] });
  const r2 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.13] });
  const r3 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.09, 0.22] });
  const r4 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const r5 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.68] });

  return (
    <Animated.View style={[styles.container, fullscreen && styles.fullscreen, { opacity: fadeIn }]}>
      {/* Rings in absolute fill so they center properly without affecting flex layout */}
      <View style={styles.ringsContainer}>
        <Animated.View style={[styles.ring, { width: W * 0.94, height: W * 0.94, borderRadius: W * 0.47, opacity: r1 }]} />
        <Animated.View style={[styles.ring, { width: W * 0.72, height: W * 0.72, borderRadius: W * 0.36, opacity: r2 }]} />
        <Animated.View style={[styles.ring, { width: W * 0.52, height: W * 0.52, borderRadius: W * 0.26, opacity: r3 }]} />
        <Animated.View style={[styles.ring, { width: W * 0.32, height: W * 0.32, borderRadius: W * 0.16, opacity: r4 }]} />
        <Animated.View style={[styles.innerRing, { width: W * 0.21, height: W * 0.21, borderRadius: W * 0.105, opacity: r5 }]} />
      </View>

      {/* Icon — fixed size, never scales */}
      <View style={styles.iconWrapper}>
        <Image source={APP_ICON} style={styles.icon} resizeMode="contain" />
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        <Text style={styles.message}>{message}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  ringsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: colors.cosmic.purple,
  },
  innerRing: {
    position: 'absolute',
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.6)',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  icon: {
    width: 80,
    height: 80,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 1,
  },
  message: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    letterSpacing: typography.tracking.wide,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
});
