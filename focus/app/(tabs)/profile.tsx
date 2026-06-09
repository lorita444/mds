import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth-context';
import { getStreaks } from '../../lib/db';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { CrystalIcon } from '../../components/placeholders/CrystalIcon';
import type { Streak } from '../../lib/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];


function getStreakColor(seconds: number): string {
  if (seconds >= 7200) return colors.cosmic.purple;
  if (seconds >= 3600) return colors.cosmic.teal;
  if (seconds >= 1800) return '#3b82f6';
  if (seconds > 0) return '#10b981';
  return colors.bg.elevated;
}

function StreakCalendar({ streaks }: { streaks: Streak[] }) {
  const today = new Date();
  const streakMap = new Map(streaks.map((s) => [s.study_date, s]));

  // Build 28-day grid (4 weeks), starting from 28 days ago
  const days: { date: Date; dateStr: string; streak: Streak | null }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({ date: d, dateStr, streak: streakMap.get(dateStr) ?? null });
  }

  // Group into weeks (rows of 7)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const todayStr = today.toISOString().split('T')[0];

  return (
    <View style={{ gap: spacing.xs }}>
      {/* Day labels */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {DAY_LABELS.map((l, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.text.dim, fontSize: 10 }}>{l}</Text>
          </View>
        ))}
      </View>
      {/* Grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: 4 }}>
          {week.map(({ dateStr, streak }) => {
            const isToday = dateStr === todayStr;
            const hasStudied = !!(streak && streak.total_seconds > 0);
            const bg = hasStudied ? getStreakColor(streak.total_seconds) : 'transparent';
            return (
              <View
                key={dateStr}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 4,
                  backgroundColor: bg,
                  borderWidth: isToday ? 1.5 : (hasStudied ? 0 : 1),
                  borderColor: isToday ? colors.cosmic.purpleLight : colors.bg.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isToday && (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.text.primary,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          flexWrap: 'wrap',
          marginTop: spacing.xs,
        }}
      >
        {[
          { color: '#10b981', label: '< 30m' },
          { color: '#3b82f6', label: '30–60m' },
          { color: colors.cosmic.teal, label: '1–2h' },
          { color: colors.cosmic.purple, label: '2h+' },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
            <Text style={{ color: colors.text.dim, fontSize: typography.sizes.xs }}>
              {l.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MultiplierProgress({ streakDays, multiplier }: { streakDays: number; multiplier: number }) {
  const maxDays = 40;
  const maxMultiplier = 3.0;
  const progress = Math.min(1, streakDays / maxDays);
  const daysToMax = Math.max(0, maxDays - streakDays);
  const nextMilestone =
    streakDays < 10 ? 10 : streakDays < 20 ? 20 : streakDays < 30 ? 30 : 40;
  const daysToNext = nextMilestone - streakDays;
  const nextMultiplier = Math.min(3.0, 1.0 + nextMilestone * 0.05).toFixed(1);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text
            style={{
              color: colors.cosmic.goldLight,
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.heavy,
            }}
          >
            {multiplier.toFixed(2)}x
          </Text>
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
            Consistency multiplier
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: typography.sizes.xs,
            }}
          >
            {streakDays >= maxDays
              ? 'Max reached! 🏆'
              : `${daysToNext}d → ${nextMultiplier}x`}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 8,
          backgroundColor: colors.bg.input,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            borderRadius: radius.full,
            backgroundColor:
              multiplier >= 3.0 ? colors.cosmic.gold : colors.cosmic.goldLight,
          }}
        />
      </View>

      {/* Milestone ticks */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[0, 10, 20, 30, 40].map((d) => (
          <Text
            key={d}
            style={{
              color: streakDays >= d ? colors.cosmic.goldLight : colors.text.dim,
              fontSize: typography.sizes.xs,
              fontWeight:
                streakDays >= d ? typography.weights.semibold : typography.weights.regular,
            }}
          >
            {d === 0 ? '1.0x' : `${(1 + d * 0.05).toFixed(1)}x`}
          </Text>
        ))}
      </View>

      {multiplier < maxMultiplier && (
        <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
          Study every day to increase your multiplier — rewards scale with your consistency.
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loadingStreaks, setLoadingStreaks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStreaks = useCallback(async () => {
    if (!profile?.id) return;
    const data = await getStreaks(profile.id, 30);
    setStreaks(data);
    setLoadingStreaks(false);
  }, [profile?.id]);

  useEffect(() => { loadStreaks(); }, [loadStreaks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadStreaks()]).finally(() => setRefreshing(false));
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ],
    );
  };

  const totalStudyMinutes = Math.floor((profile?.total_study_seconds ?? 0) / 60);
  const activeStreakDays = profile?.streak_days ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 88,
        paddingHorizontal: spacing.md,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.cosmic.purpleLight}
        />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.heavy,
          }}
        >
          Profile
        </Text>
        <Pressable
          onPress={() => router.push('/settings' as never)}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: colors.bg.card,
            borderWidth: 1,
            borderColor: colors.bg.cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="settings-sharp" size={20} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* User card */}
      <Card variant="glow" padding={spacing.lg}>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.cosmic.purpleFaint,
                borderWidth: 2,
                borderColor: colors.cosmic.purpleGlow,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{profile?.avatar_url ?? '🧑‍🚀'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {profile?.username ?? 'Explorer'}
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
                StudyVerse member
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.bg.cardBorder }} />

          {/* Stats row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <CrystalIcon size={22} fontSize={typography.sizes.lg} amount={profile?.crystal_balance ?? 0} />
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Crystals
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {activeStreakDays}🔥
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Day streak
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  color: colors.cosmic.goldLight,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {Number(profile?.consistency_multiplier ?? 1).toFixed(2)}x
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Multiplier
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                }}
              >
                {totalStudyMinutes}m
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Total study
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Streak Calendar */}
      <Card variant="elevated" padding={spacing.md}>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                letterSpacing: typography.tracking.widest,
                textTransform: 'uppercase',
              }}
            >
              Study Activity · 28 Days
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
              {streaks.filter((s) => s.total_seconds > 0).length} active days
            </Text>
          </View>
          {!loadingStreaks ? (
            <StreakCalendar streaks={streaks} />
          ) : (
            <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
                Loading…
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* Multiplier progress */}
      <Card variant="elevated" padding={spacing.md}>
        <View style={{ gap: spacing.md }}>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              letterSpacing: typography.tracking.widest,
              textTransform: 'uppercase',
            }}
          >
            Consistency Multiplier
          </Text>
          <MultiplierProgress
            streakDays={activeStreakDays}
            multiplier={Number(profile?.consistency_multiplier ?? 1)}
          />
        </View>
      </Card>

      {/* Longest streak */}
      <Card variant="flat" padding={spacing.md}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 3 }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
              }}
            >
              🏆 Longest Streak
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
              Personal record
            </Text>
          </View>
          <Text
            style={{
              color: colors.cosmic.goldLight,
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.heavy,
            }}
          >
            {profile?.longest_streak ?? 0} days
          </Text>
        </View>
      </Card>

      {/* Settings & Logs */}
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.semibold,
            letterSpacing: typography.tracking.widest,
            textTransform: 'uppercase',
          }}
        >
          Cosmic Log
        </Text>
        
        <Pressable
          onPress={() => router.push('/rewards-history' as never)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.9 : 1,
          })}
        >
          {({ pressed }) => (
            <View
              style={{
                backgroundColor: pressed ? '#1b2540' : '#151f36',
                borderWidth: 1.5,
                borderColor: pressed ? colors.cosmic.goldLight : 'rgba(167,139,250,0.36)',
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 72,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                shadowColor: colors.cosmic.gold,
                shadowOpacity: pressed ? 0.18 : 0.08,
                shadowRadius: pressed ? 12 : 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: pressed ? 4 : 2,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: 'rgba(217,119,6,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(251,191,36,0.38)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trophy-outline" size={22} color={colors.cosmic.goldLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.bold }}>
                  Reward History
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }} numberOfLines={1}>
                  Istoric premii si deblocari
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.text.muted} />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings' as never)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.9 : 1,
          })}
        >
          {({ pressed }) => (
            <View
              style={{
                backgroundColor: pressed ? '#1b2540' : '#151f36',
                borderWidth: 1.5,
                borderColor: pressed ? colors.cosmic.purpleLight : 'rgba(167,139,250,0.36)',
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 72,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                shadowColor: colors.cosmic.purple,
                shadowOpacity: pressed ? 0.18 : 0.08,
                shadowRadius: pressed ? 12 : 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: pressed ? 4 : 2,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: colors.cosmic.purpleFaint,
                  borderWidth: 1,
                  borderColor: colors.cosmic.purpleGlow,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="settings-outline" size={22} color={colors.cosmic.purpleLight} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.bold }}>
                  Cosmic Settings
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }} numberOfLines={1}>
                  Setari aplicatie
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.text.muted} />
            </View>
          )}
        </Pressable>
      </View>

      {/* Sign out */}
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => ({
          opacity: pressed ? 0.88 : 1,
        })}
      >
        {({ pressed }) => (
          <View
            style={{
              backgroundColor: pressed ? 'rgba(239,68,68,0.18)' : 'rgba(127,29,29,0.18)',
              borderWidth: 1.5,
              borderColor: pressed ? 'rgba(248,113,113,0.58)' : 'rgba(239,68,68,0.32)',
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              minHeight: 72,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: colors.status.errorFaint,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.status.error} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.bold }}>
                Sign Out
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                Leave this account
              </Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* App info */}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
          StudyVerse v1.0.0
        </Text>
        <Text style={{ color: colors.text.dim, fontSize: typography.sizes.xs }}>
          Study the universe
        </Text>
      </View>
    </ScrollView>
  );
}
