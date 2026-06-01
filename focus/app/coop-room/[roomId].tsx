import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Share,
  Pressable,
  AppState,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getCoopRoom,
  getCoopMembers,
  completeCoopRoom,
  updateCoopMemberStatus,
  createStudySession,
  completeSession,
  addCoopMaterial,
  getCoopMaterials,
  getAllUserMaterials,
  kickCoopMember,
  toggleCoopReady,
  startCoopTimer,
  pauseCoopTimer,
  resumeCoopTimer,
  abandonCoopSession,
} from '../../lib/db';
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
import type { CoopRoom, CoopRoomMember, Material } from '../../lib/types';

type MemberWithUser = CoopRoomMember & {
  users?: { username: string; avatar_url: string | null };
};

function formatCode(code: string): string {
  return code.slice(0, 3) + '-' + code.slice(3);
}

const STATUS_EMOJI: Record<string, string> = {
  joined: '🕐',
  ready: '✅',
  accepted: '✅',
  active: '🔥',
  completed: '🏆',
  abandoned: '💀',
};

export default function CoopRoomScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();

  const [room, setRoom] = useState<CoopRoom | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const [kickingUser, setKickingUser] = useState<string | null>(null);
  const [wasKicked, setWasKicked] = useState(false);

  // Shared materials states
  const [sharedMaterials, setSharedMaterials] = useState<Material[]>([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [userMaterials, setUserMaterials] = useState<Material[]>([]);
  const [addingMaterial, setAddingMaterial] = useState(false);

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
  const isMyself = (userId: string) => userId === user?.id;

  // Ready check: all non-creator members must have status 'accepted'
  const nonCreatorMembers = members.filter((m) => m.user_id !== room?.created_by);
  const allReady = nonCreatorMembers.length > 0 && nonCreatorMembers.every((m) => m.status === 'accepted');
  const allCompleted = members.length > 0 && members.every((m) => m.status === 'completed');
  const myReady = myStatus === 'accepted';

  // Compute timer remaining considering pause state
  const computeRemaining = useCallback((r: CoopRoom): number => {
    if (!r.started_at) return 0;
    const started = new Date(r.started_at).getTime();
    const pausedSecs = r.paused_seconds ?? 0;

    if (r.is_paused && r.paused_at) {
      // Frozen — return what was left when paused
      const pausedAtMs = new Date(r.paused_at).getTime();
      const elapsed = Math.round((pausedAtMs - started) / 1000) - pausedSecs;
      return Math.max(0, r.duration_seconds - elapsed);
    } else {
      // Running — subtract elapsed (net of pauses)
      const elapsed = Math.round((Date.now() - started) / 1000) - pausedSecs;
      return Math.max(0, r.duration_seconds - elapsed);
    }
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const [r, m, mats] = await Promise.all([
        getCoopRoom(roomId),
        getCoopMembers(roomId),
        getCoopMaterials(roomId),
      ]);
      if (r) {
        setRoom(r);
        if (r.status === 'active' && r.started_at) {
          const rem = computeRemaining(r);
          setRemaining(rem);
          const end = new Date(r.started_at).getTime() + r.duration_seconds * 1000;
          endTimeRef.current = end;
        }
      }
      setMembers(m as MemberWithUser[]);
      setSharedMaterials(mats);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [roomId, computeRemaining]);

  const loadUserMaterials = async () => {
    if (!user?.id) return;
    try {
      const mats = await getAllUserMaterials(user.id);
      setUserMaterials(mats);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareMaterial = async (materialId: string) => {
    if (!roomId) return;
    setAddingMaterial(true);
    try {
      await addCoopMaterial(roomId, materialId);
      const mats = await getCoopMaterials(roomId);
      setSharedMaterials(mats);
      setShowMaterialModal(false);
      Alert.alert('Succes', 'Materialul a fost partajat în cameră!');
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut partaja materialul.');
    } finally {
      setAddingMaterial(false);
    }
  };

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // Realtime sync via polling every 3 seconds
  useEffect(() => {
    if (!roomId) return;

    const pollInterval = setInterval(async () => {
      try {
        const [r, m, mats] = await Promise.all([
          getCoopRoom(roomId),
          getCoopMembers(roomId),
          getCoopMaterials(roomId),
        ]);

        if (r) {
          setRoom(r);

          if (r.status === 'active' && r.started_at) {
            const end = new Date(r.started_at).getTime() + r.duration_seconds * 1000;
            endTimeRef.current = end;

            // Synchronize the countdown when not paused
            if (!r.is_paused) {
              const rem = computeRemaining(r);
              setRemaining(rem);
            } else {
              // Paused — freeze the timer
              const rem = computeRemaining(r);
              setRemaining(rem);
            }

            // Auto-create study session if we're a member and room became active
            const myCurrentMember = (m as MemberWithUser[]).find((mb) => mb.user_id === user?.id);
            if (myCurrentMember?.status === 'active' && !sessionIdRef.current) {
              const session = await createStudySession({
                user_id: user!.id,
                session_type: 'casual',
                planned_seconds: r.duration_seconds,
              });
              sessionIdRef.current = session?.id ?? null;
              sessionStartRef.current = Date.now();
            }
          }

          // Check if kicked (was in members but no longer present)
          const myCurrentMember = (m as MemberWithUser[]).find((mb) => mb.user_id === user?.id);
          if (!myCurrentMember && !wasKicked && r.status === 'waiting') {
            setWasKicked(true);
          }
        }

        setMembers(m as MemberWithUser[]);
        setSharedMaterials(mats);
      } catch (e) {
        console.error('Co-op polling error', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [roomId, user?.id, wasKicked, computeRemaining]);

  // Navigate back if kicked
  useEffect(() => {
    if (wasKicked) {
      Alert.alert('Ai fost exclus', 'Ai fost exclus din cameră de către creator!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/studyverse' as never) },
      ]);
    }
  }, [wasKicked, router]);

  // Countdown interval (only when room is active AND not paused)
  useEffect(() => {
    if (room?.status !== 'active' || room?.is_paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!room) return;
      const rem = computeRemaining(room);
      setRemaining(rem);
      if (rem === 0) {
        clearInterval(intervalRef.current!);
        handleTimerEnd();
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [room?.status, room?.is_paused, room?.paused_seconds, computeRemaining]);

  // App foreground: resync timer
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        cancelActiveSessionNotifications().catch(() => {});
        cancelUnfinishedSessionReminder().catch(() => {});
        if (room?.status === 'active' && !room?.is_paused) {
          const rem = computeRemaining(room);
          setRemaining(rem);
          if (rem === 0) handleTimerEnd();
        }
      } else if (state === 'background') {
        if (room?.status === 'active' && myStatus === 'active' && !room?.is_paused) {
          const rem = computeRemaining(room);
          scheduleActiveSessionTimer(rem).catch(() => {});
        }
      }
    });
    return () => {
      sub.remove();
      cancelActiveSessionNotifications().catch(() => {});
      cancelUnfinishedSessionReminder().catch(() => {});
    };
  }, [room?.status, room?.is_paused, myStatus, computeRemaining]);

  const handleTimerEnd = useCallback(async () => {
    if (completingRef.current || !user?.id || !roomId) return;
    completingRef.current = true;
    setCompleting(true);

    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const multiplier = Number(profile?.consistency_multiplier ?? 1.0);
    let sessionResult: any = null;

    try {
      await updateCoopMemberStatus(roomId, user.id, 'completed');
      if (sessionIdRef.current) {
        sessionResult = await completeSession(sessionIdRef.current, elapsed, false, true);
      }
      const latestMembers = await getCoopMembers(roomId);
      const everyoneDone = latestMembers.every((m) => m.status === 'completed');
      if (everyoneDone) {
        await completeCoopRoom(roomId);
      }
    } catch {}

    const fallbackResult = {
      crystals_awarded: Math.ceil(50 * multiplier),
      coop_bonus: true,
      multiplier
    };

    router.replace({
      pathname: '/reward-reveal' as never,
      params: {
        sessionId: sessionIdRef.current ?? '',
        durationSeconds: String(elapsed),
        sessionType: 'casual',
        result: JSON.stringify(sessionResult ?? fallbackResult),
      },
    });
  }, [user?.id, roomId, router]);

  // Creator: Start Session (all non-creator must be ready)
  const handleStart = async () => {
    if (!user?.id || !room || !isCreator || starting) return;
    if (!allReady && nonCreatorMembers.length > 0) {
      Alert.alert('Așteptăm prietenii', 'Nu toți membrii sunt pregătiți. Ei trebuie să apese "Sunt Pregătit!" înainte de a putea da startul.');
      return;
    }
    setStarting(true);
    try {
      // Create a study session for the creator
      const session = await createStudySession({
        user_id: user.id,
        session_type: 'casual',
        planned_seconds: room.duration_seconds,
      });
      sessionIdRef.current = session?.id ?? null;
      sessionStartRef.current = Date.now();

      await startCoopTimer(roomId!);
      await loadRoom();
    } catch (e) {
      Alert.alert('Eroare', e instanceof Error ? e.message : 'Nu s-a putut iniția pornirea sesiunii');
    } finally {
      setStarting(false);
    }
  };

  // Non-creator: toggle ready
  const handleToggleReady = async () => {
    if (!roomId || !user?.id || togglingReady) return;
    setTogglingReady(true);
    try {
      await toggleCoopReady(roomId, !myReady);
      await loadRoom();
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut schimba statusul.');
    } finally {
      setTogglingReady(false);
    }
  };

  // Creator: kick a member
  const handleKick = (userId: string, username: string) => {
    Alert.alert(
      `Excluzi pe ${username}?`,
      'Membrul va fi eliminat din cameră.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            setKickingUser(userId);
            try {
              await kickCoopMember(roomId!, userId);
              await loadRoom();
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut exclude membrul.');
            } finally {
              setKickingUser(null);
            }
          },
        },
      ]
    );
  };

  // Pause timer
  const handlePause = async () => {
    if (!roomId || pausing) return;
    setPausing(true);
    try {
      await pauseCoopTimer(roomId);
      await loadRoom();
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut pauza sesiunea.');
    } finally {
      setPausing(false);
    }
  };

  // Resume timer
  const handleResume = async () => {
    if (!roomId || pausing) return;
    setPausing(true);
    try {
      await resumeCoopTimer(roomId);
      await loadRoom();
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut relua sesiunea.');
    } finally {
      setPausing(false);
    }
  };

  // Stop/Abandon session
  const handleStop = () => {
    Alert.alert(
      'Oprești Sesiunea?',
      'Aceasta va marca sesiunea ca finalizată pentru toți membrii. Acțiunea este ireversibilă.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Oprește',
          style: 'destructive',
          onPress: async () => {
            if (!roomId || !user?.id || completingRef.current) return;
            if (intervalRef.current) clearInterval(intervalRef.current);
            completingRef.current = true;
            setCompleting(true);
            const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
            const multiplier = Number(profile?.consistency_multiplier ?? 1.0);
            let sessionResult: any = null;
            try {
              await abandonCoopSession(roomId);
              if (sessionIdRef.current) {
                sessionResult = await completeSession(sessionIdRef.current, elapsed, false, true);
              }
              await refreshProfile();
            } catch {}

            const fallbackResult = {
              crystals_awarded: Math.ceil(25 * multiplier),
              coop_bonus: true,
              multiplier
            };

            router.replace({
              pathname: '/reward-reveal' as never,
              params: {
                sessionId: sessionIdRef.current ?? '',
                durationSeconds: String(elapsed),
                sessionType: 'casual',
                result: JSON.stringify(sessionResult ?? fallbackResult),
              },
            });
          },
        },
      ]
    );
  };

  const handleMemberComplete = async () => {
    if (!user?.id || !roomId || completingRef.current) return;
    Alert.alert(
      'Finalizează?',
      'Te marchezi ca terminat. Ceilalți membri pot continua.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Finalizează',
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
      ]
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
  const isPaused = !!room.is_paused;
  const elapsedPct = room.duration_seconds > 0
    ? Math.round((1 - remaining / room.duration_seconds) * 100)
    : 0;
  const readyCount = nonCreatorMembers.filter((m) => m.status === 'accepted').length;

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
              {isWaiting ? 'Lobby – Așteptăm membrii' : isActive ? (isPaused ? '⏸ Sesiune Pauzată' : '🔥 Sesiune Activă') : 'Sesiune Încheiată'}
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
                  Cod Cameră · Atinge pentru a copia
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
                  Durată: {Math.round(room.duration_seconds / 60)}m
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
            label={isPaused ? 'Pauză ⏸' : 'Timp Rămas'}
            size="lg"
          />
        )}

        {/* Paused banner */}
        {isActive && isPaused && (
          <Card variant="glow" padding={spacing.sm}>
            <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.sm, textAlign: 'center' }}>
              ⏸ Sesiunea este în pauză. Oricine poate relua cronometrul.
            </Text>
          </Card>
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
            Membri · {members.length}
          </Text>
          {members.map((m) => {
            const isMe = m.user_id === user?.id;
            const username =
              (m as MemberWithUser).users?.username ?? (isMe ? 'You' : 'Member');
            const isRoomCreator = m.user_id === room.created_by;
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
                    {username} {isMe ? '(tú)' : ''} {isRoomCreator ? '👑' : ''}
                  </Text>
                  <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                    {m.status === 'accepted' ? '✅ Pregătit' :
                      m.status === 'joined' ? '⏳ Nepregatit' :
                        m.status === 'active' ? '🔥 În sesiune' :
                          m.status === 'completed' ? '🏆 Finalizat' :
                            m.status === 'abandoned' ? '💀 Abandonat' : m.status}
                  </Text>
                </View>
                {/* Kick button (creator only, not for self, only in waiting) */}
                {isCreator && !isMe && isWaiting && (
                  <Pressable
                    onPress={() => handleKick(m.user_id, username)}
                    disabled={kickingUser === m.user_id}
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                      borderRadius: radius.sm,
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      borderWidth: 1,
                      borderColor: 'rgba(239,68,68,0.35)',
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
                      {kickingUser === m.user_id ? '...' : 'Kick'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* Shared Materials Section */}
        <View style={{ gap: spacing.sm }}>
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
              Materiale Comune · {sharedMaterials.length}
            </Text>
            {isWaiting && (
              <Pressable
                onPress={() => {
                  loadUserMaterials();
                  setShowMaterialModal(true);
                }}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: colors.crystal.glow,
                }}
              >
                <Text style={{ color: colors.crystal.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
                  + Adaugă
                </Text>
              </Pressable>
            )}
          </View>

          {sharedMaterials.length === 0 ? (
            <Card variant="flat" padding={spacing.md}>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                Niciun material partajat în această cameră încă.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {sharedMaterials.map((mat) => (
                <View
                  key={mat.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm + 4,
                    borderRadius: radius.md,
                    backgroundColor: colors.bg.card,
                    borderWidth: 1,
                    borderColor: colors.bg.cardBorder,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold }}>
                      {mat.name}
                    </Text>
                    <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                      {mat.file_type.toUpperCase()} · {Math.round(mat.size_bytes / 1024)} KB
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
        {/* WAITING LOBBY */}
        {isWaiting && isCreator && (
          <View style={{ gap: spacing.sm }}>
            {members.length <= 1 && (
              <Card variant="glow" padding={spacing.md}>
                <Text
                  style={{
                    color: colors.cosmic.purpleLight,
                    fontSize: typography.sizes.sm,
                    textAlign: 'center',
                    lineHeight: 18,
                  }}
                >
                  🚀 Trimite codul camerei prietenilor tăi. Ei trebuie să apese "Sunt Pregătit!" înainte de a da startul.
                </Text>
              </Card>
            )}
            {members.length > 1 && (
              <Card variant="flat" padding={spacing.sm}>
                <Text style={{ color: allReady ? colors.crystal.primary : colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  {allReady ? '✅ Toți sunt pregătiți! Poți da startul.' : `⏳ ${readyCount}/${nonCreatorMembers.length} pregătiți – așteptăm...`}
                </Text>
              </Card>
            )}
            <Button
              label={
                members.length <= 1
                  ? 'Așteptăm prietenii...'
                  : !allReady
                    ? `Start Session · ${readyCount}/${nonCreatorMembers.length} pregătiți`
                    : `🚀 Start Session · ${Math.round(room.duration_seconds / 60)}m`
              }
              onPress={handleStart}
              loading={starting}
              disabled={members.length <= 1 || (!allReady && nonCreatorMembers.length > 0)}
              size="lg"
              fullWidth
              variant="crystal"
            />
          </View>
        )}

        {isWaiting && !isCreator && (
          <View style={{ gap: spacing.sm }}>
            <Card variant="flat" padding={spacing.sm}>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                {myReady ? '✅ Ești pregătit! Așteptăm creatorul să dea startul...' : '⏳ Apasă butonul când ești gata de studiu.'}
              </Text>
            </Card>
            <Button
              label={myReady ? '✅ Sunt Pregătit! (Anulează)' : '🎯 Sunt Pregătit!'}
              onPress={handleToggleReady}
              loading={togglingReady}
              size="lg"
              fullWidth
              variant={myReady ? 'primary' : 'crystal'}
            />
          </View>
        )}

        {/* ACTIVE SESSION */}
        {isActive && myStatus === 'active' && (
          <>
            {/* Pause/Resume buttons */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {!isPaused ? (
                <Button
                  label="⏸ Pauză"
                  onPress={handlePause}
                  loading={pausing}
                  size="md"
                  variant="primary"
                  style={{ flex: 1 }}
                />
              ) : (
                <Button
                  label="▶️ Continuă"
                  onPress={handleResume}
                  loading={pausing}
                  size="md"
                  variant="crystal"
                  style={{ flex: 1 }}
                />
              )}
              <Button
                label="⏹ Stop"
                onPress={handleStop}
                size="md"
                variant="danger"
                style={{ flex: 1 }}
              />
            </View>

            {elapsedPct >= 50 && (
              <Button
                label="✅ Finalizează Sesiunea"
                onPress={handleMemberComplete}
                loading={completing}
                size="lg"
                fullWidth
              />
            )}
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
              🏆 Ai terminat! Așteptăm ceilalți... {members.filter((m) => m.status === 'completed').length}/{members.length} gata
            </Text>
          </Card>
        )}

        {/* All done */}
        {allCompleted && (
          <Button
            label="Vezi Recompensa"
            onPress={() => router.replace('/(tabs)/studyverse' as never)}
            size="lg"
            fullWidth
          />
        )}
      </View>

      {/* Add Material Modal */}
      <Modal
        visible={showMaterialModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMaterialModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.bg.primary,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '75%',
              gap: spacing.md,
              borderTopWidth: 1,
              borderColor: colors.bg.cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.heavy,
                }}
              >
                Partajează un Material
              </Text>
              <Pressable onPress={() => setShowMaterialModal(false)}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.md }}>Închide</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              {userMaterials.length === 0 ? (
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center', marginVertical: spacing.xl }}>
                  Nu ai încărcat niciun material încă în cont.
                </Text>
              ) : (
                userMaterials.map((mat) => (
                  <Pressable
                    key={mat.id}
                    onPress={() => handleShareMaterial(mat.id)}
                    disabled={addingMaterial}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: colors.bg.card,
                      borderWidth: 1,
                      borderColor: colors.bg.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.bold }}>
                        {mat.name}
                      </Text>
                    </View>
                    <Text style={{ color: colors.crystal.primary, fontSize: typography.sizes.xs }}>
                      Partajează ➜
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
