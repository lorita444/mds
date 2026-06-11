import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import {
  getFlashcards,
  generateFlashcardsAI,
  updateFlashcardStatus,
  deleteFlashcard,
  getChapters,
  getSubject,
} from '../../lib/db';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import type { Flashcard, Chapter } from '../../lib/types';

const STATUS_CONFIG = {
  new: {
    label: 'New',
    icon: '✦',
    color: colors.cosmic.purpleLight,
    faint: colors.cosmic.purpleFaint,
    border: colors.cosmic.purpleGlow,
    cardBorder: colors.cosmic.purpleGlow,
    cardBg: colors.bg.elevated,
  },
  known: {
    label: 'Known',
    icon: '✓',
    color: colors.status.success,
    faint: colors.status.successFaint,
    border: 'rgba(34,197,94,0.45)',
    cardBorder: 'rgba(34,197,94,0.55)',
    cardBg: 'rgba(34,197,94,0.04)',
  },
  needs_review: {
    label: 'Review',
    icon: '↻',
    color: colors.status.warning,
    faint: colors.status.warningFaint,
    border: 'rgba(245,158,11,0.45)',
    cardBorder: 'rgba(245,158,11,0.55)',
    cardBg: 'rgba(245,158,11,0.04)',
  },
};

// Flip card component
function FlashCard({ card, onKnown, onNeedsReview, onDelete }: {
  card: Flashcard;
  onKnown: () => void;
  onNeedsReview: () => void;
  onDelete: () => void;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flipped, setFlipped] = useState(false);

  const flip = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const st = STATUS_CONFIG[card.review_status];
  const diffColor =
    card.difficulty === 'easy' ? colors.status.success
    : card.difficulty === 'hard' ? colors.status.error
    : colors.status.warning;
  const diffFaint =
    card.difficulty === 'easy' ? colors.status.successFaint
    : card.difficulty === 'hard' ? colors.status.errorFaint
    : colors.status.warningFaint;

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Header row: status badge + difficulty + delete */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Status pill — prominent, filled */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: st.faint,
            borderWidth: 1,
            borderColor: st.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 5,
          }}>
            <Text style={{ color: st.color, fontSize: 12, fontWeight: '700' }}>{st.icon}</Text>
            <Text style={{ color: st.color, fontSize: typography.sizes.xs, fontWeight: typography.weights.bold }}>
              {st.label}
            </Text>
          </View>
          {/* Difficulty pill */}
          <View style={{
            backgroundColor: diffFaint,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 5,
          }}>
            <Text style={{ color: diffColor, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textTransform: 'capitalize' }}>
              {card.difficulty}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onDelete}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: pressed ? colors.status.error : colors.bg.cardBorder,
            backgroundColor: pressed ? colors.status.errorFaint : colors.bg.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text style={{ color: colors.text.muted, fontSize: 13 }}>✕</Text>
        </Pressable>
      </View>

      {/* Card */}
      <Pressable onPress={flip} style={{ height: 200 }}>
        <View style={{ flex: 1 }}>
          {/* Front */}
          <Animated.View
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              transform: [{ rotateY: frontInterpolate }],
              backgroundColor: st.cardBg,
              borderWidth: 1.5,
              borderColor: st.cardBorder,
              borderRadius: radius.xl,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.lg,
            }}
          >
            {/* Top edge accent strip */}
            <View style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 3,
              backgroundColor: st.color,
              opacity: 0.7,
            }} />
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm }}>
              Question
            </Text>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, textAlign: 'center', lineHeight: 26 }}>
              {card.question}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, marginTop: spacing.md }}>
              Tap to reveal answer
            </Text>
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              transform: [{ rotateY: backInterpolate }],
              backgroundColor: st.cardBg,
              borderWidth: 1.5,
              borderColor: st.cardBorder,
              borderRadius: radius.xl,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.lg,
            }}
          >
            <View style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 3,
              backgroundColor: st.color,
              opacity: 0.7,
            }} />
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm }}>
              Answer
            </Text>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, textAlign: 'center', lineHeight: 22 }}>
              {card.answer}
            </Text>
          </Animated.View>
        </View>
      </Pressable>

      {/* Review buttons — only when flipped */}
      {flipped && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={onNeedsReview}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? 'rgba(245,158,11,0.22)' : colors.status.warningFaint,
              borderWidth: 1.5,
              borderColor: pressed ? colors.status.warning : 'rgba(245,158,11,0.4)',
              borderRadius: radius.lg,
              paddingVertical: spacing.md + 2,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              gap: 4,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              shadowColor: colors.status.warning,
              shadowOpacity: pressed ? 0.3 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: pressed ? 4 : 0,
            })}
          >
            <Text style={{ fontSize: 18 }}>↻</Text>
            <Text style={{ color: colors.status.warning, fontWeight: typography.weights.bold, fontSize: typography.sizes.sm }}>
              Review Again
            </Text>
          </Pressable>
          <Pressable
            onPress={onKnown}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: pressed ? 'rgba(34,197,94,0.22)' : colors.status.successFaint,
              borderWidth: 1.5,
              borderColor: pressed ? colors.status.success : 'rgba(34,197,94,0.4)',
              borderRadius: radius.lg,
              paddingVertical: spacing.md + 2,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              gap: 4,
              transform: [{ scale: pressed ? 0.97 : 1 }],
              shadowColor: colors.status.success,
              shadowOpacity: pressed ? 0.3 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: pressed ? 4 : 0,
            })}
          >
            <Text style={{ fontSize: 18 }}>✓</Text>
            <Text style={{ color: colors.status.success, fontWeight: typography.weights.bold, fontSize: typography.sizes.sm }}>
              I Know This
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function FlashcardsScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('Subject');
  const [filterStatus, setFilterStatus] = useState<Flashcard['review_status'] | 'all'>('all');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subjectId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [flashcards, chaptersList, subjectRes] = await Promise.all([
        getFlashcards(subjectId),
        getChapters(subjectId),
        getSubject(subjectId),
      ]);
      setCards(flashcards);
      setChapters(chaptersList);
      setSubjectName(subjectRes?.name ?? 'Subject');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  }, [subjectId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!subjectId || !user?.id) return;
    setGenerating(true);
    setShowGenerateModal(false);
    try {
      const saved = await generateFlashcardsAI(subjectId, selectedChapterId, 10);
      setCards((prev) => [...saved, ...prev]);
      Alert.alert('Done', `${saved.length} flashcards generated!`);
    } catch (e) {
      Alert.alert('Generation failed', e instanceof Error ? e.message : 'Could not generate flashcards');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (cardId: string, status: Flashcard['review_status']) => {
    await updateFlashcardStatus(cardId, status);
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, review_status: status } : c));
  };

  const handleDelete = async (cardId: string) => {
    await deleteFlashcard(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  if (loading) return <LoadingState message="Loading flashcards..." />;
  if (error) return <ErrorState message={error} onRetry={load} fullscreen />;

  const filtered = filterStatus === 'all' ? cards : cards.filter((c) => c.review_status === filterStatus);
  const knownCount = cards.filter((c) => c.review_status === 'known').length;
  const reviewCount = cards.filter((c) => c.review_status === 'needs_review').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: spacing.md,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.cosmic.purpleLight} />}
    >
      {/* Header */}
      <View style={{ gap: spacing.xs }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.bg.cardBorder,
            backgroundColor: pressed ? colors.bg.elevated : colors.bg.card,
          })}
        >
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>‹</Text>
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>Back</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy }}>
            Flashcards
          </Text>
          <Button
            label={generating ? 'Generating...' : '+ Generate'}
            size="sm"
            variant="primary"
            loading={generating}
            onPress={() => setShowGenerateModal(true)}
          />
        </View>
        <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
          {subjectName}
        </Text>
      </View>

      {/* Stats */}
      {cards.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[
            { label: 'Total', count: cards.length, color: colors.text.secondary },
            { label: 'Known', count: knownCount, color: colors.status.success },
            { label: 'Review', count: reviewCount, color: colors.status.warning },
            { label: 'New', count: cards.length - knownCount - reviewCount, color: colors.text.muted },
          ].map((s) => (
            <Card key={s.label} variant="flat" padding={spacing.sm} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={{ color: s.color, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold }}>
                {s.count}
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>{s.label}</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Filter tabs */}
      {cards.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {(['all', 'new', 'needs_review', 'known'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setFilterStatus(s)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: filterStatus === s ? colors.cosmic.purple : colors.bg.card,
                borderWidth: 1,
                borderColor: filterStatus === s ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
              }}
            >
              <Text
                style={{
                  color: filterStatus === s ? colors.text.primary : colors.text.secondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: filterStatus === s ? '600' : '400',
                }}
              >
                {s === 'all' ? 'All' : s === 'needs_review' ? 'Needs Review' : s === 'known' ? 'Known' : 'New'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <Card variant="flat" padding={spacing.xl}>
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <Text style={{ fontSize: 40 }}>🃏</Text>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, textAlign: 'center' }}>
              {cards.length === 0 ? 'No flashcards yet' : 'No cards in this filter'}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, textAlign: 'center' }}>
              {cards.length === 0
                ? 'Generate flashcards from your uploaded materials with one tap.'
                : 'Try a different filter above.'}
            </Text>
            {cards.length === 0 && (
              <Button label="Generate Flashcards" onPress={() => setShowGenerateModal(true)} loading={generating} />
            )}
          </View>
        </Card>
      ) : (
        filtered.map((card) => (
          <FlashCard
            key={card.id}
            card={card}
            onKnown={() => handleStatusUpdate(card.id, 'known')}
            onNeedsReview={() => handleStatusUpdate(card.id, 'needs_review')}
            onDelete={() => {
              Alert.alert('Delete', 'Remove this flashcard?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(card.id) },
              ]);
            }}
          />
        ))
      )}

      {/* Generate modal */}
      <Modal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Flashcards"
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20 }}>
            AI will generate 10 flashcards from your uploaded materials. Select a chapter for more focused cards, or generate from all materials.
          </Text>

          {chapters.length > 0 && (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
                Chapter (optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                <Pressable
                  onPress={() => setSelectedChapterId(null)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: !selectedChapterId ? colors.cosmic.purple : colors.bg.card,
                    borderWidth: 1,
                    borderColor: !selectedChapterId ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                  }}
                >
                  <Text style={{ color: !selectedChapterId ? colors.text.primary : colors.text.secondary, fontSize: typography.sizes.sm }}>
                    All materials
                  </Text>
                </Pressable>
                {chapters.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedChapterId(c.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: 8,
                      borderRadius: radius.full,
                      backgroundColor: selectedChapterId === c.id ? colors.cosmic.purple : colors.bg.card,
                      borderWidth: 1,
                      borderColor: selectedChapterId === c.id ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                    }}
                  >
                    <Text style={{ color: selectedChapterId === c.id ? colors.text.primary : colors.text.secondary, fontSize: typography.sizes.sm }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Button label="Generate 10 Flashcards" onPress={handleGenerate} fullWidth size="lg" />
        </View>
      </Modal>
    </ScrollView>
  );
}
