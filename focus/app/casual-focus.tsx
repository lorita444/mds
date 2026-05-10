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
import { toast } from '../store/useAppStore';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Button } from '../components/ui/Button';
import { TimerDisplay } from '../components/ui/TimerDisplay';
import { Card } from '../components/ui/Card';
import { SkeletonBox } from '../components/ui/Skeleton';
import type { Subject } from '../lib/types';

const DURATIONS = [
  { label: '15m', seconds: 900 },
  { label: '25m', seconds: 1500 },
  { label: '30m', seconds: 1800 },
  { label: '45m', seconds: 2700 },
  { label: '1h', seconds: 3600 },
  { label: '1.5h', seconds: 5400 },
  { label: '2h', seconds: 7200 },
];

const REWARD_TIERS = [
  { minSeconds: 0,    label: 'Crystals',         icon: 'diamond-outline' as const, color: colors.crystal.primary },
  { minSeconds: 1800, label: 'More crystals',    icon: 'diamond' as const,         color: colors.crystal.light },
  { minSeconds: 3600, label: '+ Alien chance',   icon: 'planet-outline' as const,  color: colors.cosmic.purpleLight },
  { minSeconds: 7200, label: 'Universe element', icon: 'star' as const,            color: colors.cosmic.goldLight },
];

type Phase = 'idle' | 'running' | 'paused' | 'completing';

export default function CasualFocusScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subjectId: paramSubjectId } = useLocalSearchParams<{ subjectId?: string }>();

  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[2]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(paramSubjectId ?? null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [remaining, setRemaining] = useState(DURATIONS[2].seconds);
  const [completing, setCompleting] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);
  const endTimeRef = useRef<number>(0);
  const plannedSecondsRef = useRef<number>(DURATIONS[2].seconds);
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
    if (phase === 'idle') setRemaining(selectedDuration.seconds);
  }, [selectedDuration, phase]);

  const doComplete = useCallback(async () => {
    if (!sessionIdRef.current || completingRef.current) return;
    completingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
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
      if (state === 'active' && phase === 'running') {
        const rem = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setRemaining(rem);
        if (rem === 0) doCompleteRef.current();
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
        planned_seconds: selectedDuration.seconds,
        subject_id: selectedSubjectId ?? undefined,
      });
      if (!session) throw new Error('Failed to create session');
      const now = Date.now();
      sessionIdRef.current = session.id;
      sessionStartRef.current = now;
      plannedSecondsRef.current = selectedDuration.seconds;
      endTimeRef.current = now + selectedDuration.seconds * 1000;
      completingRef.current = false;
      totalPausedMsRef.current = 0;
      setRemaining(selectedDuration.seconds);
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
            const elapsed = Math.round(
              (Date.now() - sessionStartRef.current - totalPausedMsRef.current) / 1000,
            );
            try { await abandonSession(sessionIdRef.current, elapsed); } catch {}
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
          <View style={styles.durationGrid}>
            {DURATIONS.map((d) => {
              const active = selectedDuration.label === d.label;
              return (
                <Pressable
                  key={d.label}
                  onPress={() => setSelectedDuration(d)}
                  style={[styles.durationChip, active && styles.durationChipActive]}
                >
                  <Text style={[styles.durationText, active && styles.durationTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
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
          label={`Start ${selectedDuration.label} Session`}
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
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      {/* Header row */}
      <View style={[styles.rowHeader, { marginBottom: spacing.lg }]}>
        <View>
          <Text style={styles.screenTitle}>Focus Mode</Text>
          {selectedSubject && (
            <View style={styles.subjectPill}>
              <Text style={styles.subjectPillText}>
                {selectedSubject.emoji} {selectedSubject.name}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.tierBadge, { borderColor: REWARD_TIERS[currentTierIndex].color + '55' }]}>
          <Ionicons name={REWARD_TIERS[currentTierIndex].icon} size={12} color={REWARD_TIERS[currentTierIndex].color} />
          <Text style={[styles.tierText, { color: REWARD_TIERS[currentTierIndex].color }]}>
            {REWARD_TIERS[currentTierIndex].label}
          </Text>
        </View>
      </View>

      {/* Timer */}
      <TimerDisplay
        remainingSeconds={remaining}
        totalSeconds={plannedSecondsRef.current}
        label="Remaining"
        size="lg"
        paused={isPaused}
      />

      {/* Motivation */}
      <View style={{ alignItems: 'center', marginTop: spacing.md }}>
        <Text style={styles.motivationText}>{motivationText}</Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* Controls */}
      <View style={{ gap: spacing.sm }}>
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
          <Pressable onPress={confirmAbandon} style={styles.abandonRow}>
            <Ionicons name="close-circle-outline" size={14} color={colors.text.muted} />
            <Text style={styles.abandonText}>Abandon session</Text>
          </Pressable>
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
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  durationChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.md, backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  durationChipActive: {
    backgroundColor: colors.cosmic.purple,
    borderColor: 'rgba(167,139,250,0.5)',
    shadowColor: colors.cosmic.purple,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  durationText: { color: colors.text.secondary, fontWeight: typography.weights.medium, fontSize: typography.sizes.sm },
  durationTextActive: { color: colors.text.primary, fontWeight: typography.weights.bold },
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
  motivationText: { color: colors.text.secondary, fontSize: typography.sizes.sm, textAlign: 'center' },
  abandonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing.sm,
  },
  abandonText: { color: colors.text.muted, fontSize: typography.sizes.sm },
});
