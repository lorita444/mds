import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getQuizWithQuestions,
  saveQuizAnswer,
  finalizeQuiz,
  completeSession,
  getStudySession,
  generateQuizAI,
} from '../../lib/db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../lib/supabase';
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
    explanation?: string;
  }[],
): Promise<QuizQuestion[]> {
  const rows = questions.map((q, i) => ({
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options,
    correct_answer: q.correct_answer,
    order_index: i,
  }));

  const token = await AsyncStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}/quiz-questions/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ quiz_id: quizId, questions: rows }),
  });
  if (!res.ok) throw new Error('Failed to insert quiz questions');
  const saved = await getQuizWithQuestions(quizId);
  // Attach explanations by order (not stored in DB)
  return (saved?.questions ?? []).map((q, i) => ({
    ...q,
    explanation: questions[i]?.explanation ?? '',
  }));
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
  const [locked, setLocked] = useState<Set<string>>(new Set());
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
      const existing = await getQuizWithQuestions(quizId);
      if (existing && existing.questions.length > 0) {
        setQuestions(existing.questions);
        setPhase('answering');
        return;
      }

      const session = await getStudySession(sessionId);
      if (!session?.subject_id) {
        Alert.alert('Error', 'Could not find session subject.', [{ text: 'OK', onPress: () => router.back() }]);
        return;
      }

      const chapterIdList = (chapterIds ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const generated = await generateQuizAI(
        session.subject_id,
        chapterIdList.length > 0 ? chapterIdList : null,
        5,
      );
      const saved = await insertQuizQuestions(quizId, generated as any);
      setQuestions(saved);
      setPhase('answering');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load quiz');
      router.back();
    }
  }, [quizId, user?.id, chapterIds, sessionId, router]);

  useEffect(() => { loadAndGenerate(); }, [loadAndGenerate]);

  const currentQuestion = questions[currentIdx];
  const isLocked = currentQuestion ? locked.has(currentQuestion.id) : false;

  // Lock answer — for MC/TF called immediately on tap, for short_answer called on "Check"
  const lockAnswer = (questionId: string, answer: string) => {
    if (locked.has(questionId)) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setLocked((prev) => new Set([...prev, questionId]));
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx((i) => i + 1);
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

  if (phase === 'loading') return <LoadingState message="Se generează întrebările…" />;

  if (phase === 'results' && results) {
    const pct = Math.round((results.correct / results.total) * 100);
    return (
      <View style={[styles.centeredPage, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={{ fontSize: 64 }}>{results.passed ? '🎉' : '📚'}</Text>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text style={[styles.resultLabel, { color: results.passed ? colors.status.success : colors.status.error }]}>
            {results.passed ? 'Quiz Passed!' : 'Quiz Failed'}
          </Text>
          <Text style={styles.resultScore}>{pct}%</Text>
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
            {results.correct}/{results.total} corecte · prag 60%
          </Text>
        </View>
        {results.passed && (
          <Card variant="glow" padding={spacing.md}>
            <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textAlign: 'center' }}>
              Bonus quiz aplicat — șansă mai mare la raritate pentru recompensă!
            </Text>
          </Card>
        )}
        <Button label="Revendică Recompensa" onPress={navigateToReward} size="lg" fullWidth />
      </View>
    );
  }

  if (phase === 'submitting') {
    return (
      <View style={[styles.centeredPage]}>
        <ActivityIndicator size="large" color={colors.cosmic.purpleLight} />
        <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
          Se punctează răspunsurile…
        </Text>
      </View>
    );
  }

  if (!currentQuestion) return <LoadingState message="Se încarcă întrebarea…" />;

  const allLocked = questions.every((q) => locked.has(q.id));
  const isLast = currentIdx === questions.length - 1;
  const userAnswer = answers[currentQuestion.id] ?? '';
  const userIsCorrect = isLocked
    ? userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase()
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 Quiz</Text>
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>
          {currentIdx + 1} / {questions.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIdx + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question text */}
        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        {/* ── Multiple choice ── */}
        {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
          <View style={{ gap: spacing.sm }}>
            {currentQuestion.options.map((opt) => {
              const selected = userAnswer === opt;
              const isCorrectOpt = opt === currentQuestion.correct_answer;
              const style = optionStyle(isLocked, selected, isCorrectOpt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => !isLocked && lockAnswer(currentQuestion.id, opt)}
                  disabled={isLocked}
                  style={({ pressed }) => [styles.optionRow, style.container, pressed && !isLocked && styles.optionPressed]}
                >
                  <View style={[styles.optionDot, { borderColor: style.dotBorder, backgroundColor: style.dotFill }]}>
                    {isLocked && isCorrectOpt && <Text style={styles.optionDotIcon}>✓</Text>}
                    {isLocked && selected && !isCorrectOpt && <Text style={styles.optionDotIcon}>✗</Text>}
                  </View>
                  <Text style={[styles.optionText, { color: style.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
            <Explanation question={currentQuestion} isLocked={isLocked} userIsCorrect={userIsCorrect} />
          </View>
        )}

        {/* ── True / False ── */}
        {currentQuestion.question_type === 'true_false' && (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {['Adevărat', 'Fals'].map((opt) => {
                const selected = userAnswer === opt;
                const isCorrectOpt = opt === currentQuestion.correct_answer;
                const style = optionStyle(isLocked, selected, isCorrectOpt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() => !isLocked && lockAnswer(currentQuestion.id, opt)}
                    disabled={isLocked}
                    style={({ pressed }) => [
                      styles.tfButton,
                      style.container,
                      pressed && !isLocked && styles.optionPressed,
                    ]}
                  >
                    <View style={[styles.optionDot, { borderColor: style.dotBorder, backgroundColor: style.dotFill }]}>
                      {isLocked && isCorrectOpt && <Text style={styles.optionDotIcon}>✓</Text>}
                      {isLocked && selected && !isCorrectOpt && <Text style={styles.optionDotIcon}>✗</Text>}
                    </View>
                    <Text style={[styles.tfText, { color: style.text }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Explanation question={currentQuestion} isLocked={isLocked} userIsCorrect={userIsCorrect} />
          </View>
        )}

        {/* ── Short answer ── */}
        {currentQuestion.question_type === 'short_answer' && (
          <View style={{ gap: spacing.sm }}>
            <View style={[
              styles.textInputWrapper,
              isLocked && { borderColor: userIsCorrect ? colors.status.success : colors.status.error },
            ]}>
              <TextInput
                value={userAnswer}
                onChangeText={(t) => !isLocked && setAnswers((prev) => ({ ...prev, [currentQuestion.id]: t }))}
                placeholder="Răspunsul tău…"
                placeholderTextColor={colors.text.muted}
                multiline
                editable={!isLocked}
                style={[
                  styles.textInput,
                  isLocked && { color: userIsCorrect ? colors.status.success : colors.status.error },
                ]}
              />
            </View>

            {!isLocked ? (
              <Button
                label="Verifică Răspunsul"
                variant="secondary"
                onPress={() => lockAnswer(currentQuestion.id, userAnswer)}
                disabled={!userAnswer.trim()}
                fullWidth
              />
            ) : (
              <View style={[
                styles.expectedBox,
                { borderColor: userIsCorrect ? `${colors.status.success}40` : `${colors.status.error}40` },
              ]}>
                <Text style={styles.expectedLabel}>
                  {userIsCorrect ? '✓ Corect!' : '✗ Răspuns așteptat:'}
                </Text>
                {!userIsCorrect && (
                  <Text style={styles.expectedAnswer}>{currentQuestion.correct_answer}</Text>
                )}
              </View>
            )}

            <Explanation question={currentQuestion} isLocked={isLocked} userIsCorrect={userIsCorrect} />
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.nav}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {questions.map((q, i) => {
            const qLocked = locked.has(q.id);
            const qCorrect = qLocked
              ? (answers[q.id] ?? '').trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
              : null;
            return (
              <Pressable key={q.id} onPress={() => setCurrentIdx(i)}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === currentIdx
                          ? colors.cosmic.purple
                          : qLocked
                          ? qCorrect ? colors.status.success : colors.status.error
                          : colors.bg.cardBorder,
                      width: i === currentIdx ? 20 : 8,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {currentIdx > 0 && (
            <Button label="← Înapoi" variant="ghost" onPress={goPrev} />
          )}
          <View style={{ flex: 1 }}>
            {isLast ? (
              <Button
                label="Trimite Quiz"
                onPress={submitQuiz}
                disabled={!allLocked}
                size="lg"
                fullWidth
              />
            ) : (
              <Button
                label="Următor →"
                onPress={goNext}
                disabled={!isLocked}
                variant={isLocked ? 'primary' : 'ghost'}
                fullWidth
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// Helper: compute option visual style based on lock state
function optionStyle(locked: boolean, selected: boolean, isCorrect: boolean) {
  if (!locked) {
    if (selected) {
      return {
        container: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purple },
        text: colors.text.primary,
        dotBorder: colors.cosmic.purple,
        dotFill: colors.cosmic.purple,
      };
    }
    return {
      container: { backgroundColor: colors.bg.card, borderColor: colors.bg.cardBorder },
      text: colors.text.primary,
      dotBorder: colors.text.muted,
      dotFill: 'transparent',
    };
  }
  // locked
  if (isCorrect) {
    return {
      container: { backgroundColor: colors.status.successFaint, borderColor: colors.status.success },
      text: colors.status.success,
      dotBorder: colors.status.success,
      dotFill: colors.status.success,
    };
  }
  if (selected) {
    return {
      container: { backgroundColor: colors.status.errorFaint, borderColor: colors.status.error },
      text: colors.status.error,
      dotBorder: colors.status.error,
      dotFill: colors.status.error,
    };
  }
  return {
    container: { backgroundColor: colors.bg.card, borderColor: colors.bg.cardBorder },
    text: colors.text.muted,
    dotBorder: colors.bg.cardBorder,
    dotFill: 'transparent',
  };
}

// Explanation block shown after locking
function Explanation({
  question,
  isLocked,
  userIsCorrect,
}: {
  question: QuizQuestion;
  isLocked: boolean;
  userIsCorrect: boolean | null;
}) {
  if (!isLocked || !question.explanation) return null;
  return (
    <View style={styles.explanationBox}>
      <Text style={styles.explanationIcon}>💡</Text>
      <Text style={styles.explanationText}>{question.explanation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centeredPage: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.cardBorder,
  },
  headerTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.bg.input,
    marginHorizontal: spacing.md,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.cosmic.purple,
    borderRadius: radius.full,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  questionText: {
    color: colors.text.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    lineHeight: 28,
  },
  // Option row (MC)
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionDotIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  optionText: {
    flex: 1,
    fontSize: typography.sizes.base,
    lineHeight: 22,
  },
  // True/False
  tfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  tfText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  // Short answer
  textInputWrapper: {
    borderWidth: 1.5,
    borderColor: colors.bg.cardBorder,
    borderRadius: radius.md,
    backgroundColor: colors.bg.card,
    padding: spacing.sm,
  },
  textInput: {
    color: colors.text.primary,
    fontSize: typography.sizes.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  expectedBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.bg.elevated,
  },
  expectedLabel: {
    color: colors.text.muted,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  expectedAnswer: {
    color: colors.status.success,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    lineHeight: 22,
  },
  // Explanation
  explanationBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.cosmic.purpleLight,
  },
  explanationIcon: {
    fontSize: 16,
  },
  explanationText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  // Navigation
  nav: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.bg.cardBorder,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  // Results
  resultLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
  resultScore: {
    color: colors.text.primary,
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.heavy,
  },
});
