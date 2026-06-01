import { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { addSubject, fetchSubjects, removeSubject } from '../../services/subjects.service';
import { subjectSchema, type SubjectForm } from '../../lib/schemas';
import { toast } from '../../store/useAppStore';
import { generateStudyPlan } from '../../lib/ollama';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import type { Subject } from '../../lib/types';

const SUBJECT_COLORS = [
  '#7c3aed', '#0d9488', '#db2777', '#d97706',
  '#2563eb', '#16a34a', '#dc2626', '#9333ea',
];
const SUBJECT_EMOJIS = ['📚', '🧬', '📐', '📜', '⚗️', '🌍', '💻', '🎨', '📊', '🔬', '⚖️', '🏛️'];

// ─── Subject card ────────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  onOpen,
  onDelete,
}: {
  subject: Subject;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const c = subject.color;
  return (
    <View style={[styles.card, { borderColor: `${c}2e`, shadowColor: c }]}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: c }]} />

      <View style={styles.cardInner}>
        {/* Main tap area */}
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [
            styles.cardPressable,
            pressed && { backgroundColor: `${c}0a` },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconBadge, { backgroundColor: `${c}1a`, borderColor: `${c}35` }]}>
            {subject.emoji ? (
              <Text style={styles.iconEmoji}>{subject.emoji}</Text>
            ) : (
              <Text style={[styles.iconLetter, { color: c }]}>
                {subject.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Text block */}
          <View style={styles.cardText}>
            <Text style={styles.cardName} numberOfLines={1}>{subject.name}</Text>
            {subject.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{subject.description}</Text>
            ) : (
              <Text style={styles.cardDescEmpty}>No description</Text>
            )}
          </View>

          {/* Chevron */}
          <Ionicons name="chevron-forward" size={15} color={`${c}70`} />
        </Pressable>

        {/* Delete zone */}
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          style={({ pressed }) => [
            styles.deleteZone,
            pressed && { backgroundColor: 'rgba(239,68,68,0.1)' },
          ]}
        >
          <Ionicons name="trash-outline" size={15} color="rgba(239,68,68,0.45)" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SubjectSkeleton() {
  return (
    <View style={[styles.card, { borderColor: colors.bg.cardBorder }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.bg.elevated }]} />
      <View style={[styles.cardInner]}>
        <View style={styles.cardPressable}>
          <View style={[styles.iconBadge, { backgroundColor: colors.bg.elevated, borderColor: 'transparent' }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 14, width: '55%', borderRadius: 6, backgroundColor: colors.bg.elevated }} />
            <View style={{ height: 11, width: '38%', borderRadius: 5, backgroundColor: colors.bg.card }} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planExamDate, setPlanExamDate] = useState('');
  const [planHours, setPlanHours] = useState(2);
  const [studyPlan, setStudyPlan] = useState<{ day: string; tasks: { subject: string; task: string; minutes: number }[] }[]>([]);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [selectedColor, setSelectedColor] = useState(SUBJECT_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', description: '' },
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const result = await fetchSubjects(user.id);
    if (result.error) setError(result.error);
    else if (result.data) setSubjects(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { load(false); }, [load]);

  const onSubmitCreate = async (values: SubjectForm) => {
    if (!user?.id) return;
    const result = await addSubject(
      user.id, values.name, values.description || undefined,
      selectedColor, selectedEmoji ?? '',
    );
    if (result.error) { toast(result.error, 'error'); return; }
    setSubjects((prev) => [...prev, result.data!]);
    closeModal();
    toast(`"${result.data!.name}" created`, 'success');
  };

  const closeModal = () => {
    setShowCreate(false);
    reset();
    setSelectedColor(SUBJECT_COLORS[0]);
    setSelectedEmoji(null);
  };

  const handleDelete = (s: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Delete "${s.name}"? All chapters, materials, and flashcards will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const result = await removeSubject(s.id);
            if (result.error) { toast(result.error, 'error'); return; }
            setSubjects((prev) => prev.filter((x) => x.id !== s.id));
            toast(`"${s.name}" deleted`, 'info');
          },
        },
      ],
    );
  };

  if (error) return <ErrorState message={error} onRetry={() => load(false)} fullscreen />;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.cosmic.purpleLight}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.screenTitle}>Portfolio</Text>
            {!loading && subjects.length > 0 && (
              <Text style={styles.screenSubtitle}>
                {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {!loading && subjects.length > 0 && (
            <Pressable
              onPress={() => setShowPlanModal(true)}
              style={({ pressed }) => [
                styles.aiPlanBtn,
                pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons name="sparkles" size={13} color={colors.cosmic.purpleLight} />
              <Text style={styles.aiPlanText}>AI Plan</Text>
            </Pressable>
          )}
        </View>

        {/* ── Loading skeletons ── */}
        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {[0, 1, 2].map((i) => <SubjectSkeleton key={i} />)}
          </View>

        ) : subjects.length === 0 ? (
          /* ── Empty state ── */
          <View style={styles.emptyContainer}>
            {/* Concentric glow rings */}
            <View style={styles.emptyGlow}>
              <View style={styles.emptyRingOuter} />
              <View style={styles.emptyRingMid} />
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyEmoji}>📚</Text>
              </View>
            </View>

            <View style={styles.emptyTextBlock}>
              <Text style={styles.emptyTitle}>Start your portfolio</Text>
              <Text style={styles.emptySubtitle}>
                Add subjects to unlock AI study tools, flashcards, missions, and more.
              </Text>
            </View>

            <Button
              label="Create First Subject"
              onPress={() => setShowCreate(true)}
              size="lg"
              fullWidth
            />
          </View>

        ) : (
          /* ── Subject list ── */
          <View style={{ gap: spacing.sm }}>
            {subjects.map((s) => (
              <SubjectCard
                key={s.id}
                subject={s}
                onOpen={() => router.push(`/subject/${s.id}` as never)}
                onDelete={() => handleDelete(s)}
              />
            ))}
          </View>
        )}

        {/* ── Study Plan modal ── */}
        <Modal
          visible={showPlanModal}
          onClose={() => { setShowPlanModal(false); setStudyPlan([]); setPlanExamDate(''); }}
          title="AI Study Plan"
          scrollable
        >
          <View style={styles.modalBody}>
            {studyPlan.length === 0 ? (
              <>
                <Input
                  label="Exam date (YYYY-MM-DD)"
                  placeholder="e.g. 2026-06-30"
                  value={planExamDate}
                  onChangeText={setPlanExamDate}
                />
                <View style={{ gap: spacing.xs }}>
                  <Text style={styles.fieldLabel}>Hours available per day</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    {[1, 2, 3, 4].map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => setPlanHours(h)}
                        style={({ pressed }) => ({
                          flex: 1, alignItems: 'center',
                          paddingVertical: spacing.sm,
                          borderRadius: radius.md,
                          backgroundColor: planHours === h ? colors.cosmic.purpleFaint : colors.bg.card,
                          borderWidth: 1,
                          borderColor: planHours === h ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                          opacity: pressed ? 0.7 : 1,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        })}
                      >
                        <Text style={{
                          color: planHours === h ? colors.cosmic.purpleLight : colors.text.secondary,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.medium,
                        }}>
                          {h}h
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Button
                  label="Generate Plan"
                  loading={generatingPlan}
                  loadingLabel="Generating…"
                  disabled={!/^\d{4}-\d{2}-\d{2}$/.test(planExamDate) || generatingPlan}
                  onPress={async () => {
                    setGeneratingPlan(true);
                    try {
                      const plan = await generateStudyPlan(
                        subjects.map((s) => ({ name: s.name, description: s.description })),
                        planExamDate,
                        new Date().toISOString().slice(0, 10),
                        planHours,
                      );
                      if (plan.length === 0) {
                        toast('AI returned an empty plan — make sure Ollama is running and try again', 'error');
                      } else {
                        setStudyPlan(plan);
                      }
                    } catch (e) {
                      toast(e instanceof Error ? e.message : 'Failed to generate plan', 'error');
                    } finally {
                      setGeneratingPlan(false);
                    }
                  }}
                  fullWidth
                  size="lg"
                />
              </>
            ) : (
              <>
                {studyPlan.map((day) => (
                  <View key={day.day} style={{ gap: spacing.xs }}>
                    <Text style={styles.dayLabel}>{day.day}</Text>
                    {day.tasks.map((t, i) => (
                      <Card key={i} variant="flat" padding={spacing.sm + 2}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                              {t.subject}
                            </Text>
                            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm }}>{t.task}</Text>
                          </View>
                          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>{t.minutes}m</Text>
                        </View>
                      </Card>
                    ))}
                  </View>
                ))}
                <Button label="New Plan" variant="ghost" onPress={() => setStudyPlan([])} fullWidth />
              </>
            )}
          </View>
        </Modal>

        {/* ── Create subject modal ── */}
        <Modal visible={showCreate} onClose={closeModal} title="New Subject" scrollable>
          <View style={styles.modalBody}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Subject name"
                  placeholder="e.g. Biology, Mathematics, History"
                  value={value}
                  onChangeText={onChange}
                  autoFocus
                  error={errors.name?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Description (optional)"
                  placeholder="What is this subject about?"
                  value={value ?? ''}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={2}
                  error={errors.description?.message}
                />
              )}
            />

            {/* ── Emoji picker ── */}
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.fieldLabel}>Icon</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.xs }}
              >
                <Pressable
                  onPress={() => setSelectedEmoji(null)}
                  style={[
                    styles.emojiTile,
                    selectedEmoji === null && styles.emojiTileActive,
                  ]}
                >
                  <Text style={[
                    styles.emojiTileLabel,
                    { color: selectedEmoji === null ? colors.cosmic.purpleLight : colors.text.muted },
                  ]}>
                    Aa
                  </Text>
                </Pressable>
                {SUBJECT_EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setSelectedEmoji(e)}
                    style={[
                      styles.emojiTile,
                      selectedEmoji === e && styles.emojiTileActive,
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ── Color picker ── */}
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.colorRow}>
                {SUBJECT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.colorDotActive,
                    ]}
                  >
                    {selectedColor === c && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Preview */}
            <View style={[styles.previewRow, { borderColor: `${selectedColor}30` }]}>
              <View style={[styles.previewIcon, { backgroundColor: `${selectedColor}1a`, borderColor: `${selectedColor}35` }]}>
                {selectedEmoji ? (
                  <Text style={{ fontSize: 22 }}>{selectedEmoji}</Text>
                ) : (
                  <Text style={[styles.previewLetter, { color: selectedColor }]}>A</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewLabel}>Preview</Text>
                <Text style={[styles.previewName, { color: selectedColor }]}>
                  Your subject name
                </Text>
              </View>
            </View>

            <Button
              label="Create Subject"
              onPress={handleSubmit(onSubmitCreate)}
              loading={isSubmitting}
              loadingLabel="Creating…"
              fullWidth
              size="lg"
            />
          </View>
        </Modal>
      </ScrollView>

      {/* ── FAB ── */}
      <Pressable
        onPress={() => setShowCreate(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 64 },
          pressed && { transform: [{ scale: 0.91 }], shadowOpacity: 0.3 },
        ]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  screenTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.heavy,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  screenSubtitle: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  aiPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.full,
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1,
    borderColor: colors.cosmic.purpleGlow,
    marginTop: 4,
  },
  aiPlanText: {
    color: colors.cosmic.purpleLight,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },

  // Subject card
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: colors.bg.card,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 1,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md + 3,
    paddingRight: spacing.sm,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 26,
  },
  iconLetter: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.2,
  },
  cardDesc: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    lineHeight: 18,
  },
  cardDescEmpty: {
    color: colors.text.dim,
    fontSize: typography.sizes.xs,
  },
  deleteZone: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.04)',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  emptyGlow: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(124,58,237,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.1)',
  },
  emptyRingMid: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.14)',
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1,
    borderColor: colors.cosmic.purpleGlow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.cosmic.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyEmoji: {
    fontSize: 38,
  },
  emptyTextBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    color: colors.text.secondary,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    lineHeight: 24,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cosmic.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.cosmic.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 14,
  },

  // Modal shared
  modalBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  dayLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },

  // Emoji picker
  emojiTile: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.bg.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiTileActive: {
    backgroundColor: colors.cosmic.purpleFaint,
    borderColor: colors.cosmic.purpleGlow,
  },
  emojiTileLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Color picker
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },

  // Subject preview in modal
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.bg.card,
  },
  previewIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLetter: {
    fontSize: 18,
    fontWeight: '700',
  },
  previewLabel: {
    color: colors.text.dim,
    fontSize: typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
    marginBottom: 2,
  },
  previewName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
