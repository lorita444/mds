import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getQuizWithQuestions,
  getMaterialsByChapter,
  saveQuizAnswer,
  finalizeQuiz,
  completeSession,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { generateQuizFromContext } from '../../lib/ollama';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import type { QuizQuestion } from '../../lib/types';

type AnswerMap = Record<string, string>;

async function insertQuizQuestions(
  quizId: string,
  questions: {
    question_text: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    options: string[] | null;
    correct_answer: string;
  }[],
): Promise<QuizQuestion[]> {
  const rows = questions.map((q, i) => ({
    quiz_id: quizId,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options,
    correct_answer: q.correct_answer,
    order_index: i,
  }));
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as QuizQuestion[];
}

export default function QuizScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId, quizId, durationSeconds, chapterIds } = useLocalSearchParams<{
    sessionId: string;
    quizId: string;
    durationSeconds: string;
    chapterIds: string;
  }>();

  const [phase, setPhase] = useState<'loading' | 'answering' | 'submitting' | 'results'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<{
    correct: number;
    total: number;
    passed: boolean;
    rewardResult: Record<string, unknown> | null;
  } | null>(null);

  const loadAndGenerate = useCallback(async () => {
    if (!quizId || !user?.id) return;

    try {
      // Check if questions already exist
      const existing = await getQuizWithQuestions(quizId);
      if (existing && existing.questions.length > 0) {
        setQuestions(existing.questions);
        setPhase('answering');
        return;
      }

      // Generate questions from chapter materials
      let context = '';
      const chapterIdList = (chapterIds ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (chapterIdList.length > 0) {
        const allMaterials = await Promise.all(
          chapterIdList.map((cid) => getMaterialsByChapter(cid)),
        );
        const summaries = allMaterials
          .flat()
          .filter((m) => m.summary)
          .map((m) => m.summary as string);
        context = summaries.join('\n\n---\n\n').slice(0, 12000);
      }

      if (!context) {
        // Fallback: fetch subject materials via session
        const { data: session } = await supabase
          .from('study_sessions')
          .select('subject_id')
          .eq('id', sessionId)
          .single();
        if (session?.subject_id) {
          const { data: mats } = await supabase
            .from('materials')
            .select('summary')
            .eq('subject_id', session.subject_id)
            .not('summary', 'is', null)
            .limit(5);
          context = (mats ?? []).map((m: { summary: string }) => m.summary).join('\n\n---\n\n');
        }
      }

      if (!context) {
        Alert.alert(
          'No Materials',
          'No summarized materials found. The quiz cannot be generated.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }

      // Fetch subject name for context
      const { data: session } = await supabase
        .from('study_sessions')
        .select('subjects(name)')
        .eq('id', sessionId)
        .single();
      const subjectName =
        (session?.subjects as unknown as { name: string } | null)?.name ?? 'your subject';

      const generated = await generateQuizFromContext(context, subjectName, 5);
      const saved = await insertQuizQuestions(quizId, generated);
      setQuestions(saved);
      setPhase('answering');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load quiz');
      router.back();
    }
  }, [quizId, user?.id, chapterIds, sessionId, router]);

  useEffect(() => { loadAndGenerate(); }, [loadAndGenerate]);

  const currentQuestion = questions[currentIdx];

  const selectAnswer = (answer: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const submitQuiz = async () => {
    if (!quizId || !user?.id || !sessionId) return;
    setPhase('submitting');

    let correct = 0;
    try {
      for (const q of questions) {
        const userAnswer = answers[q.id] ?? '';
        const isCorrect =
          userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
        if (isCorrect) correct++;
        await saveQuizAnswer({
          quiz_id: quizId,
          question_id: q.id,
          user_id: user.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
        });
      }

      const status = await finalizeQuiz(quizId, correct);
      const passed = status === 'passed';
      const elapsed = parseInt(durationSeconds ?? '0', 10);
      const rewardResult = await completeSession(sessionId, elapsed, passed, false);

      setResults({ correct, total: questions.length, passed, rewardResult });
      setPhase('results');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit quiz');
      setPhase('answering');
    }
  };

  const navigateToReward = () => {
    router.replace({
      pathname: '/reward-reveal' as never,
      params: {
        sessionId,
        durationSeconds: durationSeconds ?? '0',
        sessionType: 'mission',
        result: JSON.stringify(results?.rewardResult ?? {}),
      },
    });
  };

  // ── Loading ────────────────────────────────────────────────
  if (phase === 'loading') return <LoadingState message="Generating quiz questions…" />;

  // ── Results ────────────────────────────────────────────────
  if (phase === 'results' && results) {
    const pct = Math.round((results.correct / results.total) * 100);
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xl,
        }}
      >
        <Text style={{ fontSize: 64 }}>{results.passed ? '🎉' : '📚'}</Text>

        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text
            style={{
              color: results.passed ? colors.status.success : colors.status.error,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              textTransform: 'uppercase',
              letterSpacing: typography.tracking.widest,
            }}
          >
            {results.passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: typography.sizes.display,
              fontWeight: typography.weights.heavy,
            }}
          >
            {pct}%
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
            {results.correct}/{results.total} correct · pass mark 60%
          </Text>
        </View>

        {results.passed && (
          <Card variant="glow" padding={spacing.md}>
            <Text
              style={{
                color: colors.cosmic.purpleLight,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                textAlign: 'center',
              }}
            >
              Quiz bonus applied — higher rarity chance on your reward!
            </Text>
          </Card>
        )}

        <Button
          label="Claim Reward"
          onPress={navigateToReward}
          size="lg"
          fullWidth
        />
      </View>
    );
  }

  // ── Submitting ─────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <ActivityIndicator size="large" color={colors.cosmic.purpleLight} />
        <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
          Scoring your answers…
        </Text>
      </View>
    );
  }

  // ── Answering ──────────────────────────────────────────────
  if (!currentQuestion) return <LoadingState message="Loading question…" />;

  const answered = !!answers[currentQuestion.id];
  const isLast = currentIdx === questions.length - 1;
  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.md,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.bg.cardBorder,
        }}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.md,
            fontWeight: typography.weights.bold,
          }}
        >
          📝 Quiz
        </Text>
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
          {currentIdx + 1} / {questions.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: colors.bg.input,
          marginHorizontal: spacing.md,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
            backgroundColor: colors.cosmic.purple,
            borderRadius: radius.full,
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.lg,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question */}
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            lineHeight: 26,
          }}
        >
          {currentQuestion.question_text}
        </Text>

        {/* Answer options */}
        {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
          <View style={{ gap: spacing.sm }}>
            {currentQuestion.options.map((opt) => {
              const selected = answers[currentQuestion.id] === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => ({
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: selected ? colors.cosmic.purpleFaint : colors.bg.card,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.cosmic.purple : colors.bg.cardBorder,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base }}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {currentQuestion.question_type === 'true_false' && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {['True', 'False'].map((opt) => {
              const selected = answers[currentQuestion.id] === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => selectAnswer(opt)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: selected ? colors.cosmic.purpleFaint : colors.bg.card,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.cosmic.purple : colors.bg.cardBorder,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.sizes.md,
                      fontWeight: typography.weights.semibold,
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {currentQuestion.question_type === 'short_answer' && (
          <View
            style={{
              borderWidth: 1,
              borderColor: answers[currentQuestion.id]
                ? colors.cosmic.purpleGlow
                : colors.bg.cardBorder,
              borderRadius: radius.md,
              backgroundColor: colors.bg.card,
              padding: spacing.sm,
            }}
          >
            <TextInput
              value={answers[currentQuestion.id] ?? ''}
              onChangeText={(t) => selectAnswer(t)}
              placeholder="Your answer…"
              placeholderTextColor={colors.text.muted}
              multiline
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.base,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.bg.cardBorder,
        }}
      >
        {/* Dot indicators */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
            paddingBottom: spacing.xs,
          }}
        >
          {questions.map((q, i) => (
            <Pressable key={q.id} onPress={() => setCurrentIdx(i)}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    i === currentIdx
                      ? colors.cosmic.purple
                      : answers[q.id]
                      ? colors.status.success
                      : colors.bg.cardBorder,
                }}
              />
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {currentIdx > 0 && (
            <Button label="← Back" variant="ghost" onPress={goPrev} />
          )}
          <View style={{ flex: 1 }}>
            {isLast ? (
              <Button
                label="Submit Quiz"
                onPress={submitQuiz}
                disabled={!allAnswered}
                size="lg"
                fullWidth
              />
            ) : (
              <Button
                label="Next →"
                onPress={goNext}
                disabled={!answered}
                variant={answered ? 'primary' : 'ghost'}
                fullWidth
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
