import { View } from 'react-native';
import { colors, spacing, radius } from '../../utils/theme';
import { SkeletonBox } from './Skeleton';

export function HomeSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 6 }}>
          <SkeletonBox width={80} height={11} />
          <SkeletonBox width={140} height={20} />
        </View>
        <SkeletonBox width={70} height={28} borderRadius={radius.full} />
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: colors.bg.card,
              borderRadius: radius.xl,
              padding: spacing.md,
              gap: 6,
              borderWidth: 1,
              borderColor: colors.bg.cardBorder,
            }}
          >
            <SkeletonBox width={28} height={28} borderRadius={radius.sm} />
            <SkeletonBox width="70%" height={22} />
            <SkeletonBox width="50%" height={11} />
          </View>
        ))}
      </View>

      {/* Weekly bar */}
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
        <SkeletonBox width={80} height={11} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={{ flex: 1, height: 32, borderRadius: radius.sm, backgroundColor: colors.bg.elevated }} />
          ))}
        </View>
      </View>

      {/* Planet card */}
      <View
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: radius.xl,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.bg.cardBorder,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <SkeletonBox width={72} height={72} borderRadius={36} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width={80} height={11} />
          <SkeletonBox width={140} height={18} />
          <SkeletonBox width={100} height={14} />
        </View>
      </View>

      {/* Action cards */}
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.bg.elevated,
            borderRadius: radius.xl,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <SkeletonBox width={44} height={44} borderRadius={radius.sm} />
            <SkeletonBox width={60} height={22} borderRadius={radius.full} />
          </View>
          <SkeletonBox width="60%" height={18} />
          <SkeletonBox width="100%" height={13} />
          <SkeletonBox width="80%" height={13} />
        </View>
      ))}
    </View>
  );
}
