import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { useHomeData } from '../../hooks/useHomeData';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { HomeSkeleton } from '../../components/ui/HomeSkeleton';
import { CrystalIcon } from '../../components/placeholders/CrystalIcon';
import { PlanetPlaceholder } from '../../components/placeholders/PlanetPlaceholder';
import type { Rarity } from '../../lib/types';

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planet, recentSessions, todaySeconds, weekStreaks, loading, refreshing, error, refresh } =
    useHomeData();

  const username = profile?.username ?? 'Explorer';
  const crystals = profile?.crystal_balance ?? 0;
  const streak = profile?.streak_days ?? 0;
  const multiplier = Number(profile?.consistency_multiplier ?? 1.0);

  if (error) return <ErrorState message={error} onRetry={refresh} fullscreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 88,
        paddingHorizontal: spacing.md,
        gap: spacing.md,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.cosmic.purpleLight}
        />
      }
    >
      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: typography.sizes.sm,
                  letterSpacing: typography.tracking.wide,
                }}
              >
                GOOD TO SEE YOU
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.xl,
                  fontWeight: typography.weights.bold,
                }}
              >
                {username}
              </Text>
            </View>
            <CrystalIcon size={28} amount={crystals} />
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[
              { icon: '🔥', value: streak.toString(), label: 'Day streak', highlight: streak >= 7 },
              {
                icon: '⚡',
                value: `${multiplier.toFixed(1)}x`,
                label: 'Multiplier',
                highlight: multiplier >= 1.5,
              },
              {
                icon: '📖',
                value: formatSeconds(todaySeconds),
                label: 'Today',
                highlight: todaySeconds >= 3600,
              },
            ].map((stat) => (
              <Card key={stat.label} variant="default" padding={spacing.md} style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 22 }}>{stat.icon}</Text>
                <Text
                  style={{
                    color: stat.highlight ? colors.cosmic.goldLight : colors.text.primary,
                    fontSize: typography.sizes.xl,
                    fontWeight: typography.weights.bold,
                  }}
                >
                  {stat.value}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  {stat.label}
                </Text>
              </Card>
            ))}
          </View>

          {/* Weekly activity strip */}
          {weekStreaks.length > 0 && (
            <Card variant="flat" padding={spacing.md}>
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  letterSpacing: typography.tracking.widest,
                  textTransform: 'uppercase',
                  marginBottom: spacing.sm,
                }}
              >
                This week
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  const dateStr = d.toISOString().split('T')[0];
                  const dayStreak = weekStreaks.find((s) => s.study_date === dateStr);
                  const active = !!dayStreak && dayStreak.total_seconds > 0;
                  return (
                    <View
                      key={dateStr}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: radius.sm,
                        backgroundColor: active ? colors.cosmic.purple : colors.bg.card,
                        borderWidth: 1,
                        borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.text.primary : colors.text.dim,
                          fontSize: typography.sizes.xs,
                          fontWeight: active ? '700' : '400',
                        }}
                      >
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}

          {/* Featured planet */}
          <Card variant="glow" padding={spacing.lg}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <PlanetPlaceholder
                size={72}
                rarity={(planet?.rarity as Rarity) ?? 'common'}
                isStarter={!planet || planet.earned_from === 'signup'}
              />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: typography.sizes.xs,
                    letterSpacing: typography.tracking.widest,
                    textTransform: 'uppercase',
                  }}
                >
                  Your Universe
                </Text>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.bold,
                  }}
                >
                  {planet?.item_name ?? 'Starter Planet'}
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                  {recentSessions.length === 0
                    ? 'Study to unlock more elements'
                    : `${recentSessions.length} session${recentSessions.length !== 1 ? 's' : ''} completed`}
                </Text>
              </View>
            </View>
          </Card>

          {/* Start studying */}
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              letterSpacing: typography.tracking.widest,
              textTransform: 'uppercase',
            }}
          >
            Start Studying
          </Text>

          <Pressable
            onPress={() => router.push('/casual-focus' as never)}
            style={({ pressed }) => ({
              backgroundColor: colors.cosmic.purpleFaint,
              borderWidth: 1.5,
              borderColor: colors.cosmic.purpleGlow,
              borderRadius: radius.xl,
              padding: spacing.lg,
              opacity: pressed ? 0.85 : 1,
              gap: spacing.sm,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 32 }}>⏱️</Text>
              <View
                style={{
                  backgroundColor: colors.cosmic.purple,
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
                  Casual
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold }}>
              Casual Focus Mode
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20 }}>
              Free study timer. Earn crystals and universe elements based on session length.
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, marginTop: 2 }}>
              &lt;30 min: crystals · 30–60 min: more crystals · 60–120 min: alien chance · 2h+: guaranteed element
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/mission-setup' as never)}
            style={({ pressed }) => ({
              backgroundColor: colors.cosmic.tealFaint,
              borderWidth: 1.5,
              borderColor: colors.cosmic.teal,
              borderRadius: radius.xl,
              padding: spacing.lg,
              opacity: pressed ? 0.85 : 1,
              gap: spacing.sm,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 32 }}>🎯</Text>
              <View
                style={{
                  backgroundColor: colors.cosmic.teal,
                  borderRadius: radius.full,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
                  Mission
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold }}>
              Mission Focus Mode
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20 }}>
              Study from your portfolio with AI-estimated duration and an optional quiz wager for rarer rewards.
            </Text>
          </Pressable>

          {/* Quick shortcuts */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[
              { icon: '📚', label: 'Portfolio', route: '/(tabs)/portfolio' },
              { icon: '🌌', label: 'Universe', route: '/(tabs)/universe' },
              { icon: '🤝', label: 'Co-op', route: '/(tabs)/coop' },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.route as never)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.bg.card,
                  borderWidth: 1,
                  borderColor: colors.bg.cardBorder,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: 'center',
                  gap: spacing.xs,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
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
                Recent Sessions
              </Text>
              {recentSessions.slice(0, 3).map((s) => (
                <Card key={s.id} variant="flat" padding={spacing.md}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Text style={{ fontSize: 20 }}>{s.session_type === 'mission' ? '🎯' : '⏱️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold }}>
                        {s.session_type === 'mission' ? 'Mission' : 'Casual'} · {formatSeconds(s.duration_seconds)}
                      </Text>
                      <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: s.completed ? colors.status.successFaint : colors.status.errorFaint,
                        borderRadius: radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          color: s.completed ? colors.status.success : colors.status.error,
                          fontSize: typography.sizes.xs,
                          fontWeight: typography.weights.semibold,
                        }}
                      >
                        {s.completed ? 'Done' : 'Abandoned'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
