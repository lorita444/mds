import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, Pressable } from 'react-native';
import { REWARD_CAPSULE, CRYSTAL_ICON, FRAME_LEGENDARY } from '../utils/assets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Button } from '../components/ui/Button';

const RARITY_CONFIG: Record<
  string,
  { color: string; glow: string; label: string; emoji: string }
> = {
  legendary: {
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    label: 'LEGENDARY',
    emoji: '👑',
  },
  epic: { color: '#a855f7', glow: 'rgba(168,85,247,0.3)', label: 'EPIC', emoji: '💜' },
  rare: { color: '#3b82f6', glow: 'rgba(59,130,246,0.3)', label: 'RARE', emoji: '💙' },
  uncommon: {
    color: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    label: 'UNCOMMON',
    emoji: '💚',
  },
  common: { color: colors.text.muted, glow: 'transparent', label: 'COMMON', emoji: '⬜' },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  return `${s}s`;
}

export default function RewardRevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { durationSeconds, sessionType, result } = useLocalSearchParams<{
    sessionId: string;
    durationSeconds: string;
    sessionType: string;
    result: string;
  }>();

  const boxScale = useRef(new Animated.Value(0)).current;
  const boxOpacity = useRef(new Animated.Value(0)).current;
  const crystalSlide = useRef(new Animated.Value(40)).current;
  const crystalOpacity = useRef(new Animated.Value(0)).current;
  const itemSlide = useRef(new Animated.Value(40)).current;
  const itemOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.4)).current;

  const parsed = (() => {
    try { return JSON.parse(result ?? '{}'); } catch { return {}; }
  })();

  const crystals: number = parsed.crystals_awarded ?? 0;
  const hasItem: boolean = !!parsed.item_earned;
  const itemName: string = parsed.item_name ?? 'Unknown Element';
  const itemRarity: string = parsed.item_rarity ?? 'common';
  const multiplier: number = parsed.multiplier ?? 1;
  const quizBonus: boolean = !!parsed.quiz_bonus;
  const consistencyBonus: boolean = !!parsed.consistency_bonus;
  const elapsed = parseInt(durationSeconds ?? '0', 10);

  const rarityConf = RARITY_CONFIG[itemRarity] ?? RARITY_CONFIG.common;

  useEffect(() => {
    // Entrance sequence
    Animated.sequence([
      // Box pops in
      Animated.parallel([
        Animated.spring(boxScale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(boxOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Crystal slides up
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(crystalSlide, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(crystalOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      // Item slides up (if any)
      Animated.parallel([
        Animated.timing(itemSlide, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(itemOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      // Actions fade in
      Animated.timing(actionsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse loop (for items)
    if (hasItem) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, []);

  const isMission = sessionType === 'mission';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingTop: insets.top + spacing.xl,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
      }}
    >
      {/* Main content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
        {/* Reward box */}
        <Animated.View
          style={{
            transform: [{ scale: boxScale }],
            opacity: boxOpacity,
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <Image source={REWARD_CAPSULE} style={{ width: 120, height: 120 }} resizeMode="contain" />
            {hasItem && itemRarity === 'legendary' && (
              <Image
                source={FRAME_LEGENDARY}
                style={{ position: 'absolute', width: 140, height: 140 }}
                resizeMode="contain"
              />
            )}
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text
              style={{
                color: colors.text.muted,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                letterSpacing: typography.tracking.widest,
                textTransform: 'uppercase',
              }}
            >
              {isMission ? 'Mission Complete' : 'Session Complete'}
            </Text>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.heavy,
                textAlign: 'center',
              }}
            >
              {isMission ? 'Mission Accomplished!' : 'Focus Complete!'}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
              {formatDuration(elapsed)} studied
            </Text>
          </View>

          {/* Bonus badges */}
          {(quizBonus || consistencyBonus || multiplier > 1) && (
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
              {quizBonus && (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(59,130,246,0.4)',
                  }}
                >
                  <Text style={{ color: '#3b82f6', fontSize: typography.sizes.xs }}>
                    📝 Quiz Bonus
                  </Text>
                </View>
              )}
              {consistencyBonus && (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: 'rgba(16,185,129,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(16,185,129,0.4)',
                  }}
                >
                  <Text style={{ color: '#10b981', fontSize: typography.sizes.xs }}>
                    🔥 Streak ×{multiplier.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Crystals */}
        {crystals > 0 && (
          <Animated.View
            style={{
              transform: [{ translateY: crystalSlide }],
              opacity: crystalOpacity,
              width: '100%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.bg.card,
                borderWidth: 1,
                borderColor: colors.bg.cardBorder,
                borderRadius: radius.lg,
                padding: spacing.md,
              }}
            >
              <Image source={CRYSTAL_ICON} style={{ width: 36, height: 36 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: typography.sizes.lg,
                    fontWeight: typography.weights.heavy,
                  }}
                >
                  +{crystals}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  Crystals added to your balance
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Universe item */}
        {hasItem && (
          <Animated.View
            style={{
              transform: [{ translateY: itemSlide }],
              opacity: itemOpacity,
              width: '100%',
            }}
          >
            <Animated.View
              style={{
                backgroundColor: rarityConf.glow,
                borderWidth: 1.5,
                borderColor: rarityConf.color,
                borderRadius: radius.lg,
                padding: spacing.md,
                opacity: glowPulse,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.bg.card,
                borderWidth: 1.5,
                borderColor: rarityConf.color,
                borderRadius: radius.lg,
                padding: spacing.md,
              }}
            >
              <Image source={REWARD_CAPSULE} style={{ width: 40, height: 40 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: rarityConf.color,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.bold,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                  }}
                >
                  {rarityConf.label} UNLOCKED
                </Text>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: typography.sizes.lg,
                    fontWeight: typography.weights.heavy,
                  }}
                >
                  {itemName}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  Added to your universe
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* No reward case */}
        {crystals === 0 && !hasItem && (
          <Animated.View style={{ opacity: crystalOpacity, width: '100%' }}>
            <View
              style={{
                backgroundColor: colors.bg.card,
                borderWidth: 1,
                borderColor: colors.bg.cardBorder,
                borderRadius: radius.lg,
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                Session recorded — keep building your streak!
              </Text>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Actions */}
      <Animated.View style={{ opacity: actionsOpacity, gap: spacing.sm }}>
        {hasItem && (
          <Button
            label="View in Universe"
            onPress={() => router.replace('/(tabs)/universe' as never)}
            size="lg"
            fullWidth
          />
        )}
        <Button
          label={hasItem ? 'Back to Home' : 'Continue'}
          variant={hasItem ? 'ghost' : 'primary'}
          onPress={() => router.replace('/(tabs)' as never)}
          size="lg"
          fullWidth
        />
      </Animated.View>
    </View>
  );
}
