import { useEffect, useRef, type ComponentType } from 'react';
import { Animated, View } from 'react-native';
import { colors, radius, spacing } from '../../utils/theme';

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: object;
};

export function SkeletonBox({ width = '100%', height, borderRadius, style }: SkeletonBoxProps) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? radius.md,
          backgroundColor: colors.bg.elevated,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View
      style={{
        backgroundColor: colors.bg.card,
        borderRadius: radius.xl,
        padding: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.bg.cardBorder,
      }}
    >
      <SkeletonBox height={16} width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} height={12} width={i === lines - 1 ? '40%' : '100%'} />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 4, CardComponent = SkeletonCard }: { count?: number; CardComponent?: ComponentType }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardComponent key={i} />
      ))}
    </View>
  );
}
