import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getUniverseItems,
  getRewardHistory,
  getRecentSessions,
  getStreaks,
} from '../../lib/db';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { CrystalIcon } from '../../components/placeholders/CrystalIcon';
import { PlanetPlaceholder } from '../../components/placeholders/PlanetPlaceholder';
import { AlienPlaceholder } from '../../components/placeholders/AlienPlaceholder';
import { CosmicStructurePlaceholder } from '../../components/placeholders/CosmicStructurePlaceholder';
import { HabitatPlaceholder } from '../../components/placeholders/HabitatPlaceholder';
import { RewardBoxPlaceholder } from '../../components/placeholders/RewardBoxPlaceholder';
import type { UniverseItem, Rarity, Reward, StudySession, Streak } from '../../lib/types';

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

const UNLOCK_HINTS = [
  { icon: '⏱️', label: 'Complete a 2h session', hint: 'Unlocks: alien or habitat' },
  { icon: '🎯', label: 'Pass a mission quiz', hint: 'Unlocks: rare alien or planet' },
  { icon: '🔥', label: '7-day study streak', hint: 'Unlocks: planet upgrade' },
  { icon: '🤝', label: 'Finish a co-op session', hint: 'Unlocks: co-op element' },
  { icon: '⚡', label: 'Reach 1.5x multiplier', hint: 'Rewards become rarer' },
];

function ItemRenderer({ item }: { item: UniverseItem }) {
  const rarity = item.rarity as Rarity;
  switch (item.item_type) {
    case 'planet':
      return <PlanetPlaceholder size={90} rarity={rarity} isStarter={item.earned_from === 'signup'} name={item.item_name} />;
    case 'alien':
    case 'rare_alien':
    case 'alien_type':
      return <AlienPlaceholder size={80} rarity={rarity} isRare={item.item_type === 'rare_alien'} name={item.item_name} />;
    case 'cosmic_structure':
    case 'civilization':
    case 'coop_element':
      return <CosmicStructurePlaceholder size={80} rarity={rarity} name={item.item_name} />;
    case 'habitat':
      return <HabitatPlaceholder size={80} rarity={rarity} name={item.item_name} />;
    default:
      return <RewardBoxPlaceholder size={80} rarity={rarity} />;
  }
}

const ITEM_TYPE_LABELS: Record<UniverseItem['item_type'], string> = {
  planet: 'Planets',
  alien: 'Aliens',
  rare_alien: 'Rare Aliens',
  alien_type: 'Alien Species',
  habitat: 'Habitats',
  cosmic_structure: 'Cosmic Structures',
  civilization: 'Civilizations',
  coop_element: 'Co-op Elements',
};

const SECTION_ORDER: UniverseItem['item_type'][] = [
  'planet', 'alien', 'rare_alien', 'alien_type',
  'habitat', 'cosmic_structure', 'civilization', 'coop_element',
];

export default function UniverseScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<UniverseItem[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [weekStreaks, setWeekStreaks] = useState<Streak[]>([]);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<UniverseItem['item_type']>('planet');
  const [showMissionModal, setShowMissionModal] = useState(false);

  const username = profile?.username ?? 'Explorer';
  const crystals = profile?.crystal_balance ?? 0;
  const streak = profile?.streak_days ?? 0;
  const multiplier = Number(profile?.consistency_multiplier ?? 1.0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [itemsData, rewardsData, sessionsData, streaksData] = await Promise.all([
          getUniverseItems(user.id),
          getRewardHistory(user.id, 10),
          getRecentSessions(user.id, 3),
          getStreaks(user.id, 7),
        ]);
        setItems(itemsData);
        setRewards(rewardsData);
        setRecentSessions(sessionsData);
        setWeekStreaks(streaksData);
        const today = new Date().toISOString().split('T')[0];
        setTodaySeconds(streaksData.find((s) => s.study_date === today)?.total_seconds ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load universe');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => { load(false); }, [load]);

  if (error) return <ErrorState message={error} onRetry={() => load(false)} fullscreen />;

  const grouped = SECTION_ORDER.reduce<Record<string, UniverseItem[]>>((acc, type) => {
    const group = items.filter((i) => i.item_type === type && i.is_active);
    if (group.length > 0) acc[type] = group;
    return acc;
  }, {});
  const hasItems = Object.keys(grouped).length > 0;

  const mainPlanet = items.find((i) => i.item_type === 'planet') ?? null;
  const totalActiveItems = items.filter((i) => i.is_active).length;
  const planetRarity = (mainPlanet?.rarity as Rarity) ?? 'common';
  const isStarter = !mainPlanet || mainPlanet.earned_from === 'signup';

  return (
    <>
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
            onRefresh={() => load(true)}
            tintColor={colors.cosmic.purpleLight}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, letterSpacing: typography.tracking.widest }}>
              COMMANDER
            </Text>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.bold }}>
              {username}
            </Text>
          </View>
          <CrystalIcon size={28} amount={crystals} />
        </View>

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
          </View>
        ) : (
          <>
            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[
                { icon: 'flame-outline' as const, iconActive: 'flame' as const, value: streak.toString(), label: 'Day streak', active: streak >= 7 },
                { icon: 'flash-outline' as const, iconActive: 'flash' as const, value: `${multiplier.toFixed(1)}x`, label: 'Multiplier', active: multiplier >= 1.5 },
                { icon: 'time-outline' as const, iconActive: 'time' as const, value: formatSeconds(todaySeconds), label: 'Today', active: todaySeconds >= 3600 },
              ].map((stat) => (
                <Card key={stat.label} variant="default" padding={spacing.md} style={{ flex: 1, gap: 6 }}>
                  <Ionicons
                    name={stat.active ? stat.iconActive : stat.icon}
                    size={20}
                    color={stat.active ? colors.cosmic.goldLight : colors.text.muted}
                  />
                  <Text style={{ color: stat.active ? colors.cosmic.goldLight : colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.bold }}>
                    {stat.value}
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>{stat.label}</Text>
                </Card>
              ))}
            </View>

            {/* Hero: Featured planet + civilization status + mission CTA */}
            <Card variant="glow" padding={spacing.xl}>
              <View style={{ alignItems: 'center', gap: spacing.lg }}>
                <PlanetPlaceholder
                  size={130}
                  rarity={planetRarity}
                  isStarter={isStarter}
                  name={mainPlanet?.item_name ?? 'Starter World'}
                />

                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                    Your Civilization
                  </Text>
                  <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold, textAlign: 'center' }}>
                    {totalActiveItems === 0
                      ? 'Waiting to be discovered'
                      : `${totalActiveItems} element${totalActiveItems !== 1 ? 's' : ''} discovered`}
                  </Text>
                  {recentSessions.length > 0 && (
                    <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                      {recentSessions.length} session{recentSessions.length !== 1 ? 's' : ''} completed
                    </Text>
                  )}
                </View>

                {multiplier > 1.0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                    <Ionicons name="flash" size={13} color={colors.cosmic.goldLight} />
                    <Text style={{ color: colors.cosmic.goldLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
                      {multiplier.toFixed(1)}x Boost Active
                    </Text>
                  </View>
                )}

                {/* Primary CTA */}
                <Pressable
                  onPress={() => setShowMissionModal(true)}
                  style={({ pressed }) => ({
                    width: '100%',
                    backgroundColor: pressed ? 'rgba(124,58,237,0.38)' : 'rgba(124,58,237,0.2)',
                    borderWidth: 2,
                    borderColor: pressed ? colors.cosmic.purpleLight : colors.cosmic.purple,
                    borderRadius: radius.xl,
                    paddingVertical: spacing.lg,
                    alignItems: 'center',
                    gap: spacing.xs,
                    shadowColor: colors.cosmic.purple,
                    shadowOpacity: pressed ? 0.75 : 0.45,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 16,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy, letterSpacing: 2 }}>
                    START MISSION
                  </Text>
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                    Grow Your Civilization
                  </Text>
                </Pressable>
              </View>
            </Card>

            {/* Weekly activity */}
            {weekStreaks.length > 0 && (
              <Card variant="flat" padding={spacing.md}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase', marginBottom: spacing.sm }}>
                  This Week
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
                        <Text style={{ color: active ? colors.text.primary : colors.text.dim, fontSize: typography.sizes.xs, fontWeight: active ? '700' : '400' }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            {/* Universe collection */}
            {hasItems && (
              <View style={{ gap: spacing.md }}>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                  Your Collection
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                  {SECTION_ORDER.filter((t) => grouped[t]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setActiveSection(type)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                        borderRadius: radius.full,
                        backgroundColor: activeSection === type ? colors.cosmic.purple : colors.bg.card,
                        borderWidth: 1,
                        borderColor: activeSection === type ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                      }}
                    >
                      <Text style={{ color: activeSection === type ? colors.text.primary : colors.text.secondary, fontSize: typography.sizes.sm, fontWeight: activeSection === type ? typography.weights.semibold : typography.weights.regular }}>
                        {ITEM_TYPE_LABELS[type]} ({grouped[type].length})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {grouped[activeSection] && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: 4 }}>
                    {grouped[activeSection].map((item) => (
                      <View key={item.id}>
                        <ItemRenderer item={item} />
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Empty universe */}
            {!hasItems && (
              <Card variant="flat" padding={spacing.xl}>
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold, textAlign: 'center' }}>
                    Your universe awaits
                  </Text>
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, textAlign: 'center', lineHeight: 20 }}>
                    Complete missions to populate your universe with planets, aliens, and cosmic structures.
                  </Text>
                </View>
              </Card>
            )}

            {/* Recent sessions */}
            {recentSessions.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                  Recent Sessions
                </Text>
                {recentSessions.map((s) => (
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
                      <View style={{ backgroundColor: s.completed ? colors.status.successFaint : colors.status.errorFaint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: s.completed ? colors.status.success : colors.status.error, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                          {s.completed ? 'Done' : 'Abandoned'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* Recent rewards */}
            {rewards.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                  Recent Rewards
                </Text>
                {rewards.slice(0, 4).map((r) => {
                  const rarityStyle = colors.rarity[r.rarity as Rarity];
                  return (
                    <Card key={r.id} variant="default" padding={spacing.md}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: rarityStyle.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 20 }}>{r.reward_type === 'crystals' ? '💎' : '✨'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: rarityStyle.color, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold }}>
                            {r.reward_type === 'crystals' ? `${r.crystal_amount} Crystals` : r.item_name}
                          </Text>
                          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, lineHeight: 16 }}>
                            {r.description}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}

            {/* How to grow — only when empty */}
            {!hasItems && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase' }}>
                  How to Grow
                </Text>
                {UNLOCK_HINTS.map((hint) => (
                  <Card key={hint.label} variant="flat" padding={spacing.md}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Text style={{ fontSize: 22 }}>{hint.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>{hint.label}</Text>
                        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>{hint.hint}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Stage 4 — Mission type selection modal */}
      <Modal visible={showMissionModal} onClose={() => setShowMissionModal(false)} title="Choose Mission Type">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
          <Pressable
            onPress={() => { setShowMissionModal(false); router.push('/casual-focus' as never); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(124,58,237,0.2)' : colors.cosmic.purpleFaint,
              borderWidth: 1.5,
              borderColor: colors.cosmic.purpleGlow,
              borderRadius: radius.xl,
              padding: spacing.lg,
              gap: spacing.sm,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 30 }}>⏱️</Text>
              <View style={{ backgroundColor: colors.cosmic.purple, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>Casual</Text>
              </View>
            </View>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }}>
              Casual Focus
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20 }}>
              Free timer. Earn crystals and universe elements based on session length.
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, marginTop: 2 }}>
              {'<'}30m: crystals · 30–60m: more · 60–120m: alien chance · 2h+: guaranteed element
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setShowMissionModal(false); router.push('/mission-setup' as never); }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(13,148,136,0.2)' : colors.cosmic.tealFaint,
              borderWidth: 1.5,
              borderColor: colors.cosmic.teal,
              borderRadius: radius.xl,
              padding: spacing.lg,
              gap: spacing.sm,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 30 }}>🎯</Text>
              <View style={{ backgroundColor: colors.cosmic.teal, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>Mission</Text>
              </View>
            </View>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }}>
              Mission Focus
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20 }}>
              Study from your portfolio with AI-estimated duration and an optional quiz wager for rarer rewards.
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
