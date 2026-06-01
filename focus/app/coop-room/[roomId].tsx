import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Share,
  Pressable,
  AppState,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getCoopRoom,
  getCoopMembers,
  startCoopRoom,
  completeCoopRoom,
  updateCoopMemberStatus,
  createStudySession,
  completeSession,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, radius } from '../../utils/theme';
import {
  scheduleActiveSessionTimer,
  cancelActiveSessionNotifications,
  scheduleUnfinishedSessionReminder,
  cancelUnfinishedSessionReminder,
} from '../../lib/notifications';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TimerDisplay } from '../../components/ui/TimerDisplay';
import { LoadingState } from '../../components/ui/LoadingState';
import { CoopBadgePlaceholder } from '../../components/placeholders/CoopBadgePlaceholder';
import type { CoopRoom, CoopRoomMember } from '../../lib/types';

type MemberWithUser = CoopRoomMember & {
  users?: { username: string; avatar_url: string | null };
};

function formatCode(code: string): string {
  return code.slice(0, 3) + '-' + code.slice(3);
}

const STATUS_EMOJI: Record<string, string> = {
  joined: '🕐',
  ready: '✅',
  active: '🔥',
  completed: '🏆',
  abandoned: '💀',
};

export default function CoopRoomScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  const [room, setRoom] = useState<CoopRoom | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Timer state
  const [remaining, setRemaining] = useState(0);
  const endTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const completingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCreator = room?.created_by === user?.id;
  const myMember = members.find((m) => m.user_id === user?.id);
  const myStatus = myMember?.status ?? 'joined';
  const allCompleted = members.length > 0 && members.every((m) => m.status === 'completed');

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    const [r, m] = await Promise.all([getCoopRoom(roomId), getCoopMembers(roomId)]);
    if (r) setRoom(r);
    setMembers(m as MemberWithUser[]);
    setLoading(false);

    // If room is already active, compute remaining
    if (r?.status === 'active' && r.started_at) {
      const end = new Date(r.started_at).getTime() + r.duration_seconds * 1000;
      endTimeRef.current = end;
      const rem = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(rem);
    }
  }, [roomId]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // Realtime subscription for room + members
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`coop:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coop_rooms', filter: `id=eq.${roomId}` },
        (payload: any) => {
          const updated = payload.new as CoopRoom;
          setRoom(updated);
          if (updated.status === 'active' && updated.started_at) {
            const end = new Date(updated.started_at).getTime() + updated.duration_seconds * 1000;
            endTimeRef.current = end;
            const rem = Math.max(0, Math.round((end - Date.now()) / 1000));
            setRemaining(rem);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coop_room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          getCoopMembers(roomId).then((m) => setMembers(m as MemberWithUser[]));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Countdown interval (only when room is active)
  useEffect(() => {
    if (room?.status !== 'active') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem === 0) {
        clearInterval(intervalRef.current!);
        handleTimerEnd();
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [room?.status]);

  // App foreground: resync timer and schedule background notification
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        cancelActiveSessionNotifications().catch(() => {});
        cancelUnfinishedSessionReminder().catch(() => {});
        if (room?.status === 'active') {
          const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          setRemaining(rem);
          if (rem === 0) handleTimerEnd();
        }
      } else if (state === 'background') {
        if (room?.status === 'active' && myStatus === 'active') {
          const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          scheduleActiveSessionTimer(rem).catch(() => {});
        }
      }
    });
    return () => {
      sub.remove();
      cancelActiveSessionNotifications().catch(() => {});
      cancelUnfinishedSessionReminder().catch(() => {});
    };
  }, [room?.status, myStatus]);

  const handleTimerEnd = useCallback(async () => {
    if (completingRef.current || !user?.id || !roomId) return;
    completingRef.current = true;
    setCompleting(true);

    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);

    try {
      await updateCoopMemberStatus(roomId, user.id, 'completed');
      if (sessionIdRef.current) {
        await completeSession(sessionIdRef.current, elapsed, false, true);
      }
      // If all done, complete the room
      const latestMembers = await getCoopMembers(roomId);
      const everyoneDone = latestMembers.every((m) => m.status === 'completed');
      if (everyoneDone) {
        await completeCoopRoom(roomId);
      }
    } catch {}

    router.replace({
      pathname: '/reward-reveal' as never,
      params: {
        sessionId: sessionIdRef.current ?? '',
        durationSeconds: String(elapsed),
        sessionType: 'casual',
        result: JSON.stringify({ crystals_awarded: 50, coop_bonus: true }),
      },
    });
  }, [user?.id, roomId, router]);

  const handleStart = async () => {
    if (!user?.id || !room || !isCreator || starting) return;
    setStarting(true);
    try {
      // Create a study session for this user tied to co-op
      const session = await createStudySession({
        user_id: user.id,
        session_type: 'casual',
        planned_seconds: room.duration_seconds,
      });
      sessionIdRef.current = session?.id ?? null;
      sessionStartRef.current = Date.now();

      await updateCoopMemberStatus(roomId!, user.id, 'active');
      await startCoopRoom(roomId!);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const handleMemberComplete = async () => {
    if (!user?.id || !roomId || completingRef.current) return;
    Alert.alert(
      'Complete Session?',
      'Mark yourself as done. Other members can still continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            completingRef.current = true;
            setCompleting(true);
            const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
            await updateCoopMemberStatus(roomId, user.id, 'completed');
            if (sessionIdRef.current) {
              const result = await completeSession(sessionIdRef.current, elapsed, false, true);
              router.replace({
                pathname: '/reward-reveal' as never,
                params: {
                  sessionId: sessionIdRef.current,
                  durationSeconds: String(elapsed),
                  sessionType: 'casual',
                  result: JSON.stringify(result ?? {}),
                },
              });
            }
          },
        },
      ],
    );
  };

  const copyCode = () => {
    if (room?.join_code) {
      Share.share({ message: `Join my StudyVerse room! Code: ${room.join_code}` });
    }
  };

  if (loading) return <LoadingState message="Loading room…" />;
  if (!room) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text.muted }}>Room not found.</Text>
      </View>
    );
  }

  const isActive = room.status === 'active';
  const isWaiting = room.status === 'waiting';
  const elapsedPct = room.duration_seconds > 0
    ? Math.round((1 - remaining / room.duration_seconds) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.md,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.lg }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.heavy,
              }}
            >
              Study Room
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
              {isWaiting ? 'Waiting for members' : isActive ? 'Session active' : 'Session ended'}
            </Text>
          </View>
          <CoopBadgePlaceholder size={40} memberCount={members.length} />
        </View>

        {/* Room code (waiting state) */}
        {isWaiting && (
          <Pressable onPress={copyCode}>
            <Card variant="elevated" padding={spacing.md}>
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
                  Room Code · Tap to Copy
                </Text>
                <Text
                  style={{
                    color: colors.crystal.primary,
                    fontSize: typography.sizes.display,
                    fontWeight: typography.weights.heavy,
                    letterSpacing: 8,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatCode(room.join_code)}
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  Duration: {Math.round(room.duration_seconds / 60)}m
                </Text>
              </View>
            </Card>
          </Pressable>
        )}

        {/* Timer (active state) */}
        {isActive && (
          <TimerDisplay
            remainingSeconds={remaining}
            totalSeconds={room.duration_seconds}
            label="Remaining"
            size="lg"
          />
        )}

        {/* Members */}
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
            Members · {members.length}
          </Text>
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const username =
              (m as MemberWithUser).users?.username ?? (isMe ? 'You' : 'Member');
            return (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.sm + 4,
                  borderRadius: radius.md,
                  backgroundColor: isMe ? colors.cosmic.purpleFaint : colors.bg.card,
                  borderWidth: 1,
                  borderColor: isMe ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.bg.elevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {STATUS_EMOJI[m.status] ?? '👤'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.sizes.sm,
                      fontWeight: isMe ? typography.weights.semibold : typography.weights.regular,
                    }}
                  >
                    {username} {isMe ? '(you)' : ''} {m.user_id === room.created_by ? '👑' : ''}
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                    {m.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.bg.cardBorder,
          gap: spacing.sm,
          backgroundColor: colors.bg.primary,
        }}
      >
        {/* Waiting: start button (creator only) */}
        {isWaiting && isCreator && (
          <Button
            label={`Start Session · ${Math.round(room.duration_seconds / 60)}m`}
            onPress={handleStart}
            loading={starting}
            size="lg"
            fullWidth
            variant="crystal"
          />
        )}
        {isWaiting && !isCreator && (
          <Card variant="flat" padding={spacing.sm}>
            <Text
              style={{
                color: colors.text.muted,
                fontSize: typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Waiting for the room creator to start…
            </Text>
          </Card>
        )}

        {/* Active: complete early / abandon */}
        {isActive && myStatus === 'active' && (
          <>
            {elapsedPct >= 50 && (
              <Button
                label="Complete Session"
                onPress={handleMemberComplete}
                loading={completing}
                size="lg"
                fullWidth
              />
            )}
            <Button
              label="Leave Room"
              variant="danger"
              onPress={() => {
                Alert.alert('Leave Room?', 'You will be marked as abandoned.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                      await updateCoopMemberStatus(roomId!, user!.id, 'abandoned');
                      router.back();
                    },
                  },
                ]);
              }}
              disabled={completing}
              size="lg"
              fullWidth
            />
          </>
        )}

        {/* Completed */}
        {myStatus === 'completed' && (
          <Card variant="glow" padding={spacing.sm}>
            <Text
              style={{
                color: colors.cosmic.purpleLight,
                fontSize: typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              🏆 You finished! Waiting for others… {members.filter((m) => m.status === 'completed').length}/{members.length} done
            </Text>
          </Card>
        )}

        {/* All done */}
        {allCompleted && (
          <Button
            label="View Reward"
            onPress={() => router.replace('/(tabs)/studyverse' as never)}
            size="lg"
            fullWidth
          />
        )}
      </View>
    </View>
  );
}
