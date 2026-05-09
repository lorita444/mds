import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { getUniverseItems, getRewardHistory } from '../../lib/db';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { CrystalIcon } from '../../components/placeholders/CrystalIcon';
import { PlanetPlaceholder } from '../../components/placeholders/PlanetPlaceholder';
import { AlienPlaceholder } from '../../components/placeholders/AlienPlaceholder';
import { CosmicStructurePlaceholder } from '../../components/placeholders/CosmicStructurePlaceholder';
import { HabitatPlaceholder } from '../../components/placeholders/HabitatPlaceholder';
import { RewardBoxPlaceholder } from '../../components/placeholders/RewardBoxPlaceholder';
import type { UniverseItem, Rarity, Reward } from '../../lib/types';

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
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<UniverseItem[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<UniverseItem['item_type']>('planet');

  const crystals = profile?.crystal_balance ?? 0;
  const multiplier = Number(profile?.consistency_multiplier ?? 1.0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [itemsData, rewardsData] = await Promise.all([
          getUniverseItems(user.id),
          getRewardHistory(user.id, 10),
        ]);
        setItems(itemsData);
        setRewards(rewardsData);
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

  // Group items by type
  const grouped = SECTION_ORDER.reduce<Record<string, UniverseItem[]>>((acc, type) => {
    const group = items.filter((i) => i.item_type === type && i.is_active);
    if (group.length > 0) acc[type] = group;
    return acc;
  }, {});

  const hasItems = Object.keys(grouped).length > 0;

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
          onRefresh={() => load(true)}
          tintColor={colors.cosmic.purpleLight}
        />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy }}>
          Your Universe
        </Text>
        <CrystalIcon size={28} amount={crystals} />
      </View>

      {loading ? (
        <>
          <SkeletonList count={3} />
        </>
      ) : (
        <>
          {/* Consistency banner */}
          {multiplier > 1.0 && (
            <View
              style={{
                backgroundColor: 'rgba(245,158,11,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(245,158,11,0.3)',
                borderRadius: radius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 20 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.cosmic.goldLight, fontSize: typography.sizes.sm, fontWeight: typography.weights.bold }}>
                  {multiplier.toFixed(1)}x Consistency Multiplier Active
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                  Your rewards are boosted. Keep studying daily.
                </Text>
              </View>
            </View>
          )}

          {/* Type filter tabs */}
          {hasItems && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              {SECTION_ORDER.filter((t) => grouped[t]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setActiveSection(type)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor:
                      activeSection === type ? colors.cosmic.purple : colors.bg.card,
                    borderWidth: 1,
                    borderColor:
                      activeSection === type ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      color: activeSection === type ? colors.text.primary : colors.text.secondary,
                      fontSize: typography.sizes.sm,
                      fontWeight: activeSection === type
                        ? typography.weights.semibold
                        : typography.weights.regular,
                    }}
                  >
                    {ITEM_TYPE_LABELS[type]} ({grouped[type].length})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Active section items */}
          {hasItems && grouped[activeSection] && (
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
                {ITEM_TYPE_LABELS[activeSection]}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.md, paddingVertical: 4 }}
              >
                {grouped[activeSection].map((item) => (
                  <View key={item.id}>
                    <ItemRenderer item={item} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Empty state */}
          {!hasItems && (
            <Card variant="flat" padding={spacing.xl}>
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <PlanetPlaceholder size={72} rarity="epic" isStarter />
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, textAlign: 'center' }}>
                  Your universe awaits
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base, textAlign: 'center', lineHeight: 22 }}>
                  Complete focus sessions to start populating your universe with planets, aliens, and cosmic structures.
                </Text>
              </View>
            </Card>
          )}

          {/* How to unlock more */}
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
              How to grow
            </Text>
            {UNLOCK_HINTS.map((hint) => (
              <Card key={hint.label} variant="flat" padding={spacing.md}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={{ fontSize: 22 }}>{hint.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
                      {hint.label}
                    </Text>
                    <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                      {hint.hint}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Recent rewards */}
          {rewards.length > 0 && (
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
                Recent Rewards
              </Text>
              {rewards.slice(0, 5).map((r) => {
                const rarityStyle = colors.rarity[r.rarity as Rarity];
                return (
                  <Card key={r.id} variant="default" padding={spacing.md}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.sm,
                          backgroundColor: rarityStyle.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {r.reward_type === 'crystals' ? '💎' : '✨'}
                        </Text>
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
        </>
      )}
    </ScrollView>
  );
}
