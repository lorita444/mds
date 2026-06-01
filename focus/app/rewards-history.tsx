import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth-context';
import { getRewardHistory } from '../lib/db';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui/LoadingState';
import type { Reward, Rarity } from '../lib/types';

export default function RewardsHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRewards = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch up to 100 rewards for a comprehensive history
      const data = await getRewardHistory(user.id, 100);
      setRewards(data);
    } catch (e) {
      console.error('Failed to load rewards history', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRewardIcon = (type: Reward['reward_type']) => {
    switch (type) {
      case 'crystals':
        return '💎';
      case 'alien':
      case 'rare_alien':
      case 'alien_type':
        return '👽';
      case 'planet':
        return '🪐';
      case 'habitat':
        return '🏠';
      case 'cosmic_structure':
        return '🏛️';
      case 'civilization':
        return '🌌';
      case 'coop_element':
        return '🤝';
      default:
        return '✨';
    }
  };

  if (loading) return <LoadingState message="Loading your cosmic archives..." />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.secondary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Cosmic Rewards</Text>
          <Text style={styles.headerSubtitle}>Istoric premii deblocate în StudyVerse</Text>
        </View>
        <View style={{ width: 40 }} /> {/* balance spacing */}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRewards(true)}
            tintColor={colors.cosmic.purpleLight}
          />
        }
      >
        {rewards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌌</Text>
            <Text style={styles.emptyText}>No rewards unlocked yet.</Text>
            <Text style={styles.emptySubtext}>
              Complete your study sessions or mission challenges to earn crystals, planets, aliens, and more.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {rewards.map((r) => {
              const rarityStyle = colors.rarity[r.rarity as Rarity] ?? colors.rarity.common;
              const isCrystals = r.reward_type === 'crystals';
              const rewardTitle = isCrystals ? `${r.crystal_amount} Crystals` : r.item_name;

              return (
                <Card
                  key={r.id}
                  variant={r.rarity === 'legendary' || r.rarity === 'epic' ? 'glow' : 'default'}
                  padding={spacing.md}
                  style={[styles.rewardCard, { borderColor: rarityStyle.color }]}
                >
                  <View style={styles.rewardRow}>
                    {/* Icon container with rarity tinted background */}
                    <View style={[styles.iconContainer, { backgroundColor: rarityStyle.bg }]}>
                      <Text style={styles.iconEmoji}>{getRewardIcon(r.reward_type)}</Text>
                    </View>

                    {/* Reward info */}
                    <View style={styles.infoContainer}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.rewardTitle, { color: isCrystals ? colors.crystal.primary : colors.text.primary }]}>
                          {rewardTitle}
                        </Text>
                        <View style={[styles.rarityBadge, { backgroundColor: rarityStyle.color + '22', borderColor: rarityStyle.color }]}>
                          <Text style={[styles.rarityText, { color: rarityStyle.color }]}>
                            {r.rarity.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.descriptionText}>{r.description}</Text>
                      
                      <Text style={styles.dateText}>{formatDate(r.created_at)}</Text>

                      {/* Bonus badges list */}
                      {(r.consistency_bonus || r.quiz_bonus || r.coop_bonus) && (
                        <View style={styles.badgesContainer}>
                          {r.consistency_bonus && (
                            <View style={[styles.bonusBadge, styles.streakBadge]}>
                              <Text style={styles.bonusText}>🔥 Streak Bonus</Text>
                            </View>
                          )}
                          {r.quiz_bonus && (
                            <View style={[styles.bonusBadge, styles.quizBadge]}>
                              <Text style={styles.bonusText}>📝 Quiz Pass</Text>
                            </View>
                          )}
                          {r.coop_bonus && (
                            <View style={[styles.bonusBadge, styles.coopBadge]}>
                              <Text style={styles.bonusText}>🤝 Co-op Bonus</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.cardBorder,
    backgroundColor: colors.bg.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.cardBorder,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.text.muted,
    fontSize: 10,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyText: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  emptySubtext: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
  },
  rewardCard: {
    borderLeftWidth: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconEmoji: {
    fontSize: 24,
  },
  infoContainer: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rewardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.heavy,
    flex: 1,
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  descriptionText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
  dateText: {
    color: colors.text.dim,
    fontSize: 10,
    marginTop: 2,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.sm,
  },
  bonusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
  bonusText: {
    fontSize: 9,
    fontWeight: typography.weights.semibold,
  },
  streakBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    color: '#22c55e',
  },
  quizBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    color: '#3b82f6',
  },
  coopBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    color: '#a855f7',
  },
});
