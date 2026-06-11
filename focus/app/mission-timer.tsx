import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  AppState,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { completeSession, abandonSession } from '../lib/db';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Button } from '../components/ui/Button';
import { TimerDisplay } from '../components/ui/TimerDisplay';
import { useAuth } from '../context/auth-context';
import {
  scheduleActiveSessionTimer,
  cancelActiveSessionNotifications,
  scheduleUnfinishedSessionReminder,
  cancelUnfinishedSessionReminder,
} from '../lib/notifications';

export default function MissionTimerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const {
    sessionId,
    plannedSeconds: plannedSecondsParam,
    subjectName,
    hasQuiz,
    quizId,
    chapterIds,
  } = useLocalSearchParams<{
    sessionId: string;
    plannedSeconds: string;
    subjectId: string;
    subjectName: string;
    hasQuiz: string;
    quizId: string;
    chapterIds: string;
  }>();

  const plannedSeconds = parseInt(plannedSecondsParam ?? '2700', 10);
  const sessionHasQuiz = hasQuiz === '1';

  const [remaining, setRemaining] = useState(plannedSeconds);
  const [phase, setPhase] = useState<'running' | 'completing'>('running');
  const [completing, setCompleting] = useState(false);

  const endTimeRef = useRef<number>(Date.now() + plannedSeconds * 1000);
  const sessionStartRef = useRef<number>(Date.now());
  const completingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doComplete = useCallback(async () => {
    if (!sessionId || completingRef.current) return;
    completingRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCompleting(true);
    setPhase('completing');
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);

    try {
      if (sessionHasQuiz && quizId) {
        // Navigate to quiz; quiz will complete the session after scoring
        router.replace({
          pathname: '/quiz/[sessionId]' as never,
          params: {
            sessionId,
            quizId,
            durationSeconds: String(elapsed),
            chapterIds: chapterIds ?? '',
          },
        });
        return;
      }

      const result = await completeSession(sessionId, elapsed);
      router.replace({
        pathname: '/reward-reveal' as never,
        params: {
          sessionId,
          durationSeconds: String(elapsed),
          sessionType: 'mission',
          result: JSON.stringify(result ?? {}),
        },
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to complete session');
      completingRef.current = false;
      setCompleting(false);
      setPhase('running');
    }
  }, [sessionId, sessionHasQuiz, quizId, chapterIds, router]);

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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
        }
      }
    });
    return () => {
      sub.remove();
      cancelActiveSessionNotifications().catch(() => {});
      cancelUnfinishedSessionReminder().catch(() => {});
    };
  }, [phase]);

  const confirmAbandon = () => {
    Alert.alert(
      'Abandon Mission?',
      'You will forfeit any wager. If you\'re past 50%, a common item may be deactivated.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (!sessionId) return;
            if (intervalRef.current) clearInterval(intervalRef.current);
            const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
            try { 
              await abandonSession(sessionId, elapsed); 
              await refreshProfile();
            } catch {}
            router.replace('/(tabs)/studyverse' as never);
          },
        },
      ],
    );
  };

  const elapsedPercent = 1 - remaining / plannedSeconds;
  const elapsedPct = Math.round(elapsedPercent * 100);

  const motivationText =
    elapsedPct < 20
      ? 'Mission underway — lock in!'
      : elapsedPct < 50
      ? 'Building momentum — stay focused.'
      : elapsedPct < 75
      ? "Past halfway — you're crushing it!"
      : elapsedPct < 95
      ? 'Almost done — final push!'
      : sessionHasQuiz
      ? 'Timer done! Quiz starting…'
      : 'Mission complete — claiming reward…';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Atmospheric background blobs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={[
            styles.blob,
            {
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: colors.cosmic.purple,
              opacity: 0.06 + elapsedPercent * 0.08,
              top: -60,
              left: -80,
            },
          ]}
        />
        <View
          style={[
            styles.blob,
            {
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: colors.cosmic.purpleLight,
              opacity: 0.04 + elapsedPercent * 0.05,
              bottom: 80,
              right: -40,
            },
          ]}
        />
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontSize: 14 }}>🎯</Text>
          <Text style={styles.missionLabel}>Mission Mode</Text>
        </View>
        {subjectName ? (
          <Text style={styles.subjectName} numberOfLines={1}>{subjectName}</Text>
        ) : null}
      </View>

      {/* Center section — timer + info */}
      <View style={styles.center}>
        <TimerDisplay
          remainingSeconds={remaining}
          totalSeconds={plannedSeconds}
          label="Remaining"
          size="lg"
        />

        <Text style={styles.motivation}>{motivationText}</Text>

        {sessionHasQuiz && (
          <View style={styles.quizBadge}>
            <Text style={{ fontSize: 12 }}>📝</Text>
            <Text style={styles.quizBadgeText}>Quiz at end</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        {elapsedPct >= 50 && phase === 'running' && (
          <Button
            label={sessionHasQuiz ? 'Finish & Start Quiz' : 'Complete Mission Early'}
            onPress={doComplete}
            loading={completing}
            size="lg"
            fullWidth
          />
        )}
        <Button
          label="Abandon Mission"
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  blob: {
    position: 'absolute',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 2,
  },
  missionLabel: {
    color: colors.crystal.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
  subjectName: {
    color: colors.text.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
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
  quizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.crystal.glow,
  },
  quizBadgeText: {
    color: colors.crystal.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  actions: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
