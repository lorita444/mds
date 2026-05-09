import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { createCoopRoom, joinCoopRoom } from '../../lib/db';
import { toast } from '../../store/useAppStore';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CoopBadgePlaceholder } from '../../components/placeholders/CoopBadgePlaceholder';

const DURATION_OPTIONS = [
  { label: '30m', seconds: 1800 },
  { label: '45m', seconds: 2700 },
  { label: '1h', seconds: 3600 },
  { label: '1.5h', seconds: 5400 },
  { label: '2h', seconds: 7200 },
];

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CoopScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[2]);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async () => {
    if (!user?.id) return;
    setCreating(true);
    try {
      const code = generateCode();
      const room = await createCoopRoom(user.id, selectedDuration.seconds, code);
      if (!room) throw new Error('Failed to create room');
      setShowCreate(false);
      router.push({ pathname: '/coop-room/[roomId]' as never, params: { roomId: room.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create room', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.id || !joinCode.trim()) return;
    setJoining(true);
    try {
      const room = await joinCoopRoom(joinCode.trim().toUpperCase(), user.id);
      if (!room) throw new Error('Room not found');
      setShowJoin(false);
      setJoinCode('');
      router.push({ pathname: '/coop-room/[roomId]' as never, params: { roomId: room.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Room not found or already started', 'error');
    } finally {
      setJoining(false);
    }
  };

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
      >
        {/* Header */}
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.heavy,
          }}
        >
          Co-op Study
        </Text>

        {/* Hero */}
        <View
          style={{
            backgroundColor: colors.cosmic.tealFaint,
            borderWidth: 1.5,
            borderColor: colors.cosmic.teal,
            borderRadius: radius.xl,
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <CoopBadgePlaceholder size={80} memberCount={2} />
          <Text
            style={{
              color: colors.text.primary,
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.bold,
              textAlign: 'center',
            }}
          >
            Study Together,{'\n'}Earn More Together
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.sm,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            When everyone completes the session, the whole group earns a bonus reward and exclusive
            co-op universe elements.
          </Text>
        </View>

        {/* Actions */}
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Create a Room"
            onPress={() => setShowCreate(true)}
            size="lg"
            fullWidth
            variant="crystal"
          />
          <Button
            label="Join with Code"
            onPress={() => setShowJoin(true)}
            size="lg"
            fullWidth
            variant="secondary"
          />
        </View>

        {/* How it works */}
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
            How it works
          </Text>
          {[
            {
              icon: '🚪',
              title: 'Create or Join',
              body: "Create a room and share the code, or enter a friend's code to join.",
            },
            {
              icon: '⏱️',
              title: 'Sync Timer',
              body: 'The creator picks a duration. Everyone starts at the same time.',
            },
            {
              icon: '✅',
              title: 'Complete Together',
              body: 'If everyone finishes, the group earns a bonus reward.',
            },
            {
              icon: '🌌',
              title: 'Exclusive Rewards',
              body: 'Long co-op sessions unlock special elements no solo session can get.',
            },
          ].map((rule) => (
            <Card key={rule.title} variant="flat" padding={spacing.md}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 24 }}>{rule.icon}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.sizes.base,
                      fontWeight: typography.weights.semibold,
                    }}
                  >
                    {rule.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontSize: typography.sizes.sm,
                      lineHeight: 19,
                    }}
                  >
                    {rule.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Create Room Modal */}
      <Modal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Study Room"
        scrollable
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.md }}>
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
              Session Duration
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {DURATION_OPTIONS.map((d) => {
                const active = selectedDuration.label === d.label;
                return (
                  <Button
                    key={d.label}
                    label={d.label}
                    onPress={() => setSelectedDuration(d)}
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                  />
                );
              })}
            </View>
          </View>

          <Card variant="flat" padding={spacing.md}>
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: typography.sizes.xs,
                textAlign: 'center',
              }}
            >
              A random 6-character code will be generated for your friends to join.
            </Text>
          </Card>

          <Button
            label="Create Room"
            onPress={handleCreate}
            loading={creating}
            size="lg"
            fullWidth
            variant="crystal"
          />
        </View>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        visible={showJoin}
        onClose={() => { setShowJoin(false); setJoinCode(''); }}
        title="Join a Room"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                }}
              >
                Room Code
              </Text>
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: joinCode ? colors.crystal.primary : colors.bg.cardBorder,
                  borderRadius: radius.md,
                  backgroundColor: colors.bg.card,
                  padding: spacing.md,
                }}
              >
                <TextInput
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor={colors.text.muted}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    color: colors.text.primary,
                    fontSize: typography.sizes.xxl,
                    fontWeight: typography.weights.heavy,
                    letterSpacing: 8,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  }}
                />
              </View>
            </View>

            <Button
              label="Join Room"
              onPress={handleJoin}
              loading={joining}
              disabled={joinCode.length !== 6}
              size="lg"
              fullWidth
              variant="crystal"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
