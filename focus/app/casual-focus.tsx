import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  AppState,
} from 'react-native';
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

type Phase = 'idle' | 'running' | 'completing';

export default function CasualFocusScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subjectId: paramSubjectId } = useLocalSearchParams<{ subjectId?: string }>();

  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[2]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    paramSubjectId ?? null,
  );
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
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
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

  // Countdown interval
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  // Recompute remaining on foreground resume
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
      setRemaining(selectedDuration.seconds);
      setPhase('running');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start session', 'error');
    }
  };

  const confirmAbandon = () => {
    Alert.alert(
      'Abandon Session?',
      'You will lose any wager. If you\'re past 50%, a common item may be deactivated.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (!sessionIdRef.current) return;
            if (intervalRef.current) clearInterval(intervalRef.current);
            const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
            try { await abandonSession(sessionIdRef.current, elapsed); } catch {}
            router.back();
          },
        },
      ],
    );
  };

  const elapsedPercent =
    phase === 'running' ? (1 - remaining / plannedSecondsRef.current) * 100 : 0;
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  if (loadingSubjects) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.md,
          gap: spacing.lg,
        }}
      >
        <SkeletonBox height={28} width="50%" />
        <View style={{ gap: spacing.sm }}>
          <SkeletonBox height={12} width="30%" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBox key={i} width={56} height={36} borderRadius={radius.md} />
            ))}
          </View>
        </View>
        <SkeletonBox height={80} />
        <SkeletonBox height={52} />
      </ScrollView>
    );
  }

  if (phase === 'idle') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
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
          <Text
            style={{
              color: colors.text.primary,
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.heavy,
            }}
          >
            Casual Focus
          </Text>
        </View>

        {/* Duration picker */}
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
            Duration
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {DURATIONS.map((d) => {
              const active = selectedDuration.label === d.label;
              return (
                <Pressable
                  key={d.label}
                  onPress={() => setSelectedDuration(d)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.cosmic.purple : colors.bg.card,
                    borderWidth: 1,
                    borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontWeight: active
                        ? typography.weights.bold
                        : typography.weights.regular,
                      fontSize: typography.sizes.sm,
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Subject picker */}
        {subjects.length > 0 && (
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
              Link to Subject (optional)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              <Pressable
                onPress={() => setSelectedSubjectId(null)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: !selectedSubjectId
                    ? colors.cosmic.purpleFaint
                    : colors.bg.card,
                  borderWidth: 1,
                  borderColor: !selectedSubjectId
                    ? colors.cosmic.purpleGlow
                    : colors.bg.cardBorder,
                }}
              >
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                  None
                </Text>
              </Pressable>
              {subjects.map((s) => {
                const active = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSubjectId(s.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.cosmic.purpleFaint : colors.bg.card,
                      borderWidth: 1,
                      borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                    }}
                  >
                    <Text>{s.emoji}</Text>
                    <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm }}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Reward tiers */}
        <Card variant="glow" padding={spacing.md}>
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
              }}
            >
              Potential Rewards
            </Text>
            {[
              { range: 'Under 30 min', reward: '🔷 Crystals' },
              { range: '30 – 60 min', reward: '🔷🔷 More crystals' },
              { range: '60 – 120 min', reward: '🔷 + 40% alien chance' },
              { range: 'Over 2 hours', reward: '🌌 Guaranteed universe element' },
            ].map((r) => (
              <View
                key={r.range}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  {r.range}
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                  {r.reward}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Button
          label={`Start ${selectedDuration.label} Focus Session`}
          onPress={startSession}
          size="lg"
          fullWidth
        />
      </ScrollView>
    );
  }

  // Running / completing
  const motivationText =
    elapsedPercent < 25
      ? 'Just getting started — stay focused!'
      : elapsedPercent < 50
      ? 'Momentum building — keep going.'
      : elapsedPercent < 75
      ? "Halfway there — you're doing great!"
      : elapsedPercent < 95
      ? 'Almost done — finish strong!'
      : 'Session complete!';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
      }}
    >
      {/* Header */}
      <View style={{ gap: 2, marginBottom: spacing.xl }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.heavy,
          }}
        >
          Focus Mode
        </Text>
        {selectedSubject && (
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
            {selectedSubject.emoji} {selectedSubject.name}
          </Text>
        )}
      </View>

      {/* Timer */}
      <TimerDisplay
        remainingSeconds={remaining}
        totalSeconds={plannedSecondsRef.current}
        label="Remaining"
        size="lg"
      />

      {/* Motivation */}
      <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: typography.sizes.sm,
            textAlign: 'center',
          }}
        >
          {motivationText}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* Actions */}
      <View style={{ gap: spacing.sm }}>
        {elapsedPercent >= 50 && (
          <Button
            label="Complete Session Early"
            onPress={doComplete}
            loading={completing}
            size="lg"
            fullWidth
          />
        )}
        <Button
          label="Abandon Session"
          variant="danger"
          onPress={confirmAbandon}
          disabled={completing}
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
}
