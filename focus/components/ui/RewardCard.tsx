import { View, Text, Pressable } from 'react-native';
import type { Rarity, RewardType } from '../../lib/types';
import { colors, radius, spacing, typography } from '../../utils/theme';

type RewardCardProps = {
  rewardType: RewardType;
  itemName: string | null;
  crystalAmount: number | null;
  rarity: Rarity;
  consistencyBonus?: boolean;
  coopBonus?: boolean;
  quizBonus?: boolean;
  description?: string;
  onPress?: () => void;
};

const REWARD_ICONS: Record<RewardType, string> = {
  crystals: '💎',
  alien: '👾',
  rare_alien: '✨',
  alien_type: '🌀',
  planet: '🪐',
  habitat: '🏛️',
  cosmic_structure: '🔮',
  civilization: '🌌',
  coop_element: '🤝',
};

export function RewardCard({
  rewardType,
  itemName,
  crystalAmount,
  rarity,
  consistencyBonus = false,
  coopBonus = false,
  quizBonus = false,
  description,
  onPress,
}: RewardCardProps) {
  const rarityStyle = colors.rarity[rarity];
  const icon = REWARD_ICONS[rewardType];
  const title =
    rewardType === 'crystals'
      ? `${crystalAmount ?? 0} Crystals`
      : itemName ?? 'Unknown Reward';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bg.card,
        borderWidth: 1.5,
        borderColor: rarityStyle.glow,
        borderRadius: radius.lg,
        padding: spacing.md,
        opacity: pressed ? 0.85 : 1,
        shadowColor: rarityStyle.color,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      })}
    >
      {/* Rarity badge */}
      <View
        style={{
          position: 'absolute',
          top: spacing.sm,
          right: spacing.sm,
          backgroundColor: rarityStyle.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            color: rarityStyle.color,
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.bold,
            letterSpacing: typography.tracking.wider,
            textTransform: 'uppercase',
          }}
        >
          {rarity}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: 40 }}>{icon}</Text>

        <View style={{ gap: 2 }}>
          <Text
            style={{
              color: rarityStyle.color,
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.bold,
            }}
          >
            {title}
          </Text>
          {description && (
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: typography.sizes.sm,
                lineHeight: 18,
              }}
            >
              {description}
            </Text>
          )}
        </View>

        {(consistencyBonus || coopBonus || quizBonus) && (
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            {consistencyBonus && (
              <View
                style={{
                  backgroundColor: colors.status.warningFaint,
                  borderRadius: radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    color: colors.status.warning,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.semibold,
                  }}
                >
                  🔥 Streak Bonus
                </Text>
              </View>
            )}
            {coopBonus && (
              <View
                style={{
                  backgroundColor: colors.cosmic.tealFaint,
                  borderRadius: radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    color: colors.cosmic.tealLight,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.semibold,
                  }}
                >
                  🤝 Co-op Bonus
                </Text>
              </View>
            )}
            {quizBonus && (
              <View
                style={{
                  backgroundColor: colors.cosmic.purpleFaint,
                  borderRadius: radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    color: colors.cosmic.purpleLight,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.semibold,
                  }}
                >
                  🧠 Quiz Bonus
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}
