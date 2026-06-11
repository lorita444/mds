import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  AppState,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth-context';
import { createStudySession, completeSession, abandonSession, getSubjects } from '../lib/db';
import {
  scheduleActiveSessionTimer,
  cancelActiveSessionNotifications,
  scheduleUnfinishedSessionReminder,
  cancelUnfinishedSessionReminder,
} from '../lib/notifications';
import { toast } from '../store/useAppStore';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Button } from '../components/ui/Button';
import { TimerDisplay } from '../components/ui/TimerDisplay';
import { Card } from '../components/ui/Card';
import { SkeletonBox } from '../components/ui/Skeleton';
import { WheelPicker } from '../components/ui/WheelPicker';
import type { Subject } from '../lib/types';

const HOURS_VALUES = [0, 1, 2, 3, 4, 5];
const MINUTES_VALUES = Array.from({ length: 60 }, (_, i) => i);

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const REWARD_TIERS = [
  { minSeconds: 0,    label: 'Crystals',         icon: 'diamond-outline' as const, color: colors.crystal.primary },
  { minSeconds: 1800, label: 'More crystals',    icon: 'diamond' as const,         color: colors.crystal.light },
  { minSeconds: 3600, label: '+ Alien chance',   icon: 'planet-outline' as const,  color: colors.cosmic.purpleLight },
  { minSeconds: 7200, label: 'Universe element', icon: 'star' as const,            color: colors.cosmic.goldLight },
];

type Phase = 'idle' | 'running' | 'paused' | 'completing';

export default function CasualFocusScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subjectId: paramSubjectId } = useLocalSearchParams<{ subjectId?: string }>();

  const [phase, setPhase] = useState<Phase>('idle');
  const [pickerHourIdx, setPickerHourIdx] = useState(0);
  const [pickerMinuteIdx, setPickerMinuteIdx] = useState(30);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(paramSubjectId ?? null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [remaining, setRemaining] = useState(30 * 60);
  const [completing, setCompleting] = useState(false);

  const plannedMinutes = HOURS_VALUES[pickerHourIdx] * 60 + MINUTES_VALUES[pickerMinuteIdx];
  const plannedSeconds = plannedMinutes * 60;

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const plannedSecondsRef = useRef<number>(30 * 60);
  const completingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedAtRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);

  useEffect(() => {
    if (!user?.id) return;
    getSubjects(user.id).then((s) => {
      setSubjects(s);
      setLoadingSubjects(false);
    });
  }, [user?.id]);

  useEffect(() => {
    if (phase === 'idle') setRemaining(plannedSeconds);
  }, [plannedSeconds, phase]);

  const doComplete = useCallback(async () => {
    if (!sessionIdRef.current || completingRef.current) return;
    completingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);

    cancelActiveSessionNotifications().catch(() => {});
    cancelUnfinishedSessionReminder().catch(() => {});

    setCompleting(true);
    setPhase('completing');
    const elapsed = Math.round(
      (Date.now() - sessionStartRef.current - totalPausedMsRef.current) / 1000,
    );
    try {
      const result = await completeSession(sessionIdRef.current, elapsed);
      router.replace({
        pathname: '/reward-reveal' as never,
        params: {
          sessionId: sessionIdRef.current,
          durationSeconds: String(elapsed),
          sessionType: 'casual',
          result: JSON.stringify(result ?? {}),
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to complete session', 'error');
      completingRef.current = false;
      setCompleting(false);
      setPhase('running');
    }
  }, [router]);

  const doCompleteRef = useRef(doComplete);
  doCompleteRef.current = doComplete;

  useEffect(() => {
    if (phase !== 'running') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem === 0) {
        clearInterval(intervalRef.current!);
        doCompleteRef.current();
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        cancelActiveSessionNotifications().catch(() => {});
        cancelUnfinishedSessionReminder().catch(() => {});

        if (phase === 'running') {
          const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          setRemaining(rem);
          if (rem === 0) doCompleteRef.current();
        }
      } else if (state === 'background') {
        if (phase === 'running') {
          const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
          scheduleActiveSessionTimer(rem).catch(() => {});
        } else if (phase === 'paused') {
          scheduleUnfinishedSessionReminder().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [phase]);

  const startSession = async () => {
    if (!user?.id || phase !== 'idle') return;
    try {
      const session = await createStudySession({
        user_id: user.id,
        session_type: 'casual',
        planned_seconds: plannedSeconds,
        subject_id: selectedSubjectId ?? undefined,
      });
      if (!session) throw new Error('Failed to create session');
      const now = Date.now();
      sessionIdRef.current = session.id;
      sessionStartRef.current = now;
      plannedSecondsRef.current = plannedSeconds;
      endTimeRef.current = now + plannedSeconds * 1000;
      completingRef.current = false;
      totalPausedMsRef.current = 0;
      setRemaining(plannedSeconds);
      setPhase('running');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start session', 'error');
    }
  };

  const pauseSession = () => {
    if (phase !== 'running') return;
    pausedAtRef.current = Date.now();
    setPhase('paused');
  };

  const resumeSession = () => {
    if (phase !== 'paused') return;
    const pausedMs = Date.now() - pausedAtRef.current;
    totalPausedMsRef.current += pausedMs;
    endTimeRef.current += pausedMs;
    setPhase('running');
  };

  const confirmAbandon = () => {
    Alert.alert(
      'Abandon Session?',
      "Progress will be lost. If you're past 50%, a common universe item may be deactivated.",
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (!sessionIdRef.current) return;
            if (intervalRef.current) clearInterval(intervalRef.current);
            
            cancelActiveSessionNotifications().catch(() => {});
            cancelUnfinishedSessionReminder().catch(() => {});

            const elapsed = Math.round(
              (Date.now() - sessionStartRef.current - totalPausedMsRef.current) / 1000,
            );
             try { 
               await abandonSession(sessionIdRef.current, elapsed);
               await refreshProfile();
             } catch {}
             router.back();
          },
        },
      ],
    );
  };

  const elapsedPercent =
    phase === 'running' || phase === 'paused'
      ? (1 - remaining / plannedSecondsRef.current) * 100
      : 0;

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const currentTierIndex = REWARD_TIERS.reduce((acc, _tier, i) => {
    const elapsed = plannedSecondsRef.current - remaining;
    return elapsed >= REWARD_TIERS[i].minSeconds ? i : acc;
  }, 0);

  // ── Loading ──
  if (loadingSubjects) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <SkeletonBox height={28} width="50%" />
        <SkeletonBox height={48} />
        <SkeletonBox height={80} />
        <SkeletonBox height={52} />
      </ScrollView>
    );
  }

  // ── Idle ──
  if (phase === 'idle') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.rowHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text.secondary} />
          </Pressable>
          <View>
            <Text style={styles.screenTitle}>Casual Focus</Text>
            <Text style={styles.screenSubtitle}>Free-form study timer</Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.pickerCard}>
            <View style={styles.pickerRow}>
              <WheelPicker
                values={HOURS_VALUES.map(h => `${h}h`)}
                selectedIndex={pickerHourIdx}
                onChangeIndex={setPickerHourIdx}
                width={110}
              />
              <Text style={styles.pickerColon}>:</Text>
              <WheelPicker
                values={MINUTES_VALUES.map(m => String(m).padStart(2, '0'))}
                selectedIndex={pickerMinuteIdx}
                onChangeIndex={setPickerMinuteIdx}
                width={110}
              />
            </View>
            <View style={styles.pickerTotalRow}>
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
              <Text style={styles.pickerTotal}>{formatMinutes(plannedMinutes)}</Text>
            </View>
          </View>
        </View>

        {subjects.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>Link to Subject (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              <Pressable
                onPress={() => setSelectedSubjectId(null)}
                style={[styles.subjectChip, !selectedSubjectId && styles.subjectChipActive]}
              >
                <Text style={styles.subjectChipText}>None</Text>
              </Pressable>
              {subjects.map((s) => {
                const active = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSubjectId(s.id)}
                    style={[styles.subjectChip, active && styles.subjectChipActive]}
                  >
                    <Text>{s.emoji}</Text>
                    <Text style={styles.subjectChipText}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Card variant="glow" padding={spacing.md}>
          <Text style={styles.cardTitle}>What you can earn</Text>
          <View style={{ gap: spacing.xs + 2, marginTop: spacing.sm }}>
            {REWARD_TIERS.map((tier) => (
              <View key={tier.label} style={styles.rewardRow}>
                <Ionicons name={tier.icon} size={14} color={tier.color} />
                <Text style={[styles.rewardLabel, { color: tier.color }]}>{tier.label}</Text>
                <Text style={styles.rewardTime}>
                  {tier.minSeconds === 0
                    ? 'Any length'
                    : tier.minSeconds >= 3600
                    ? `${tier.minSeconds / 3600}h+`
                    : `${tier.minSeconds / 60}m+`}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Button
          label={`Start ${formatMinutes(plannedMinutes)} Session`}
          onPress={startSession}
          size="lg"
          fullWidth
        />
      </ScrollView>
    );
  }

  // ── Running / Paused / Completing ──
  const motivationText =
    elapsedPercent < 25 ? 'Just getting started — stay focused!'
    : elapsedPercent < 50 ? 'Momentum building — keep going.'
    : elapsedPercent < 75 ? "You're halfway there — finish strong!"
    : elapsedPercent < 95 ? 'Almost done — one last push!'
    : 'Session complete!';

  const isPaused = phase === 'paused';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Atmospheric background blobs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={[
            styles.blob,
            {
              width: 320, height: 320, borderRadius: 160,
              backgroundColor: colors.cosmic.purple,
              opacity: 0.06 + elapsedPercent * 0.08,
              top: -60, left: -80,
            },
          ]}
        />
        <View
          style={[
            styles.blob,
            {
              width: 200, height: 200, borderRadius: 100,
              backgroundColor: colors.cosmic.purpleLight,
              opacity: 0.04 + elapsedPercent * 0.05,
              bottom: 80, right: -40,
            },
          ]}
        />
      </View>

      {/* Header */}
      <View style={[styles.timerHeader, { paddingTop: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontSize: 14 }}>⚡</Text>
          <Text style={styles.casualLabel}>Casual Focus</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {selectedSubject && (
            <View style={styles.subjectPill}>
              <Text style={styles.subjectPillText}>
                {selectedSubject.emoji} {selectedSubject.name}
              </Text>
            </View>
          )}
          <View style={[styles.tierBadge, { borderColor: REWARD_TIERS[currentTierIndex].color + '55' }]}>
            <Ionicons name={REWARD_TIERS[currentTierIndex].icon} size={12} color={REWARD_TIERS[currentTierIndex].color} />
            <Text style={[styles.tierText, { color: REWARD_TIERS[currentTierIndex].color }]}>
              {REWARD_TIERS[currentTierIndex].label}
            </Text>
          </View>
        </View>
      </View>

      {/* Center — timer + motivation */}
      <View style={styles.center}>
        <TimerDisplay
          remainingSeconds={remaining}
          totalSeconds={plannedSecondsRef.current}
          label="Remaining"
          size="lg"
          paused={isPaused}
        />
        <Text style={styles.motivation}>{motivationText}</Text>
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        {elapsedPercent >= 50 && (
          <Button
            label="Complete Session"
            loadingLabel="Saving session..."
            onPress={doComplete}
            loading={completing}
            size="lg"
            fullWidth
          />
        )}
        {!completing && (
          <Button
            label={isPaused ? 'Resume Session' : 'Pause'}
            variant={isPaused ? 'primary' : 'secondary'}
            onPress={isPaused ? resumeSession : pauseSession}
            size="lg"
            fullWidth
          />
        )}
        {!completing && (
          <Button
            label="Abandon Session"
            variant="danger"
            onPress={confirmAbandon}
            size="lg"
            fullWidth
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  scrollContent: { paddingHorizontal: spacing.md, gap: spacing.lg },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'space-between' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  screenTitle: { color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy },
  screenSubtitle: { color: colors.text.muted, fontSize: typography.sizes.sm, marginTop: 2 },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
  pickerCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pickerColon: {
    color: colors.text.muted,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginHorizontal: spacing.xs,
    paddingBottom: 4,
  },
  pickerTotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.bg.cardBorder,
    marginTop: spacing.xs,
  },
  pickerTotal: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
  subjectChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  subjectChipActive: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purpleGlow },
  subjectChipText: { color: colors.text.primary, fontSize: typography.sizes.sm },
  cardTitle: { color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rewardLabel: { flex: 1, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  rewardTime: { color: colors.text.muted, fontSize: typography.sizes.xs },
  subjectPill: {
    marginTop: 4, alignSelf: 'flex-start',
    backgroundColor: colors.cosmic.purpleFaint,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  subjectPillText: { color: colors.cosmic.purpleLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  tierText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  root: { flex: 1, backgroundColor: colors.bg.primary },
  blob: { position: 'absolute' },
  timerHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  casualLabel: {
    color: colors.crystal.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  motivation: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  actions: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
