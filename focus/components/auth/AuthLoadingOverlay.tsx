import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { APP_ICON } from '../../utils/assets';
import { colors, spacing, typography } from '../../utils/theme';

const { width: W } = Dimensions.get('window');

type Props = {
  visible: boolean;
  message: string;
  subtitle?: string;
};

export function AuthLoadingOverlay({ visible, message, subtitle }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible, breathe]);

  const r1 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.08] });
  const r2 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.18] });
  const r3 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.38] });
  const r4 = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.30, 0.70] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.overlay, { opacity }]}
    >
      {/* Atmospheric bloom */}
      <Animated.View style={[styles.ring, { width: W * 0.80, height: W * 0.80, borderRadius: W * 0.40, opacity: r1 }]} />
      <Animated.View style={[styles.ring, { width: W * 0.58, height: W * 0.58, borderRadius: W * 0.29, opacity: r2 }]} />
      <Animated.View style={[styles.ring, { width: W * 0.36, height: W * 0.36, borderRadius: W * 0.18, opacity: r3 }]} />
      <Animated.View style={[styles.innerRing, { width: W * 0.22, height: W * 0.22, borderRadius: W * 0.11, opacity: r4 }]} />

      <View style={styles.iconWrapper}>
        <Image source={APP_ICON} style={styles.icon} resizeMode="contain" />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.subtitle}>
          {subtitle ?? 'Please wait a moment...'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,7,18,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    gap: spacing.xl,
  },
  ring: {
    position: 'absolute',
    backgroundColor: colors.cosmic.purple,
  },
  innerRing: {
    position: 'absolute',
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.55)',
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
