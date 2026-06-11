import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_AVATAR } from '../utils/assets';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/auth-context';
import {
  getSubjects,
  getChapters,
  getMaterialsByChapter,
  createStudySession,
  createQuiz,
  placeWager,
  getActiveUniverseItems,
} from '../lib/db';
import { estimateStudyDuration } from '../lib/ollama';
import { colors, spacing, typography, radius } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = spacing.sm;
const CARD_W = (SCREEN_W - spacing.md * 2 - CARD_GAP) / 2;
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui/LoadingState';
import { WheelPicker } from '../components/ui/WheelPicker';
import type { Subject, Chapter, UniverseItem } from '../lib/types';


function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CRYSTAL_WAGER_OPTIONS = [50, 100, 200, 500];

export default function MissionSetupScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { subjectId: paramSubjectId } = useLocalSearchParams<{ subjectId?: string }>();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    paramSubjectId ?? null,
  );
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [universeItems, setUniverseItems] = useState<UniverseItem[]>([]);

  const HOURS_VALUES = [0, 1, 2, 3, 4, 5];
  const MINUTES_VALUES = Array.from({ length: 60 }, (_, i) => i); // 0–59

  const [estimating, setEstimating] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [estimateReasoning, setEstimateReasoning] = useState('');

  // Default: 0h 45min
  const [pickerHourIdx, setPickerHourIdx] = useState(0);
  const [pickerMinuteIdx, setPickerMinuteIdx] = useState(45);

  useEffect(() => {
    if (estimatedMinutes === null) return;
    const h = Math.min(5, Math.floor(estimatedMinutes / 60));
    const m = Math.min(59, estimatedMinutes % 60);
    setPickerHourIdx(h);
    setPickerMinuteIdx(m);
  }, [estimatedMinutes]);

  const [withQuiz, setWithQuiz] = useState(false);
  const [wagerType, setWagerType] = useState<'none' | 'crystals' | 'item'>('none');
  const [crystalWager, setCrystalWager] = useState(100);
  const [wageredItemId, setWageredItemId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getSubjects(user.id),
      getActiveUniverseItems(user.id),
    ]).then(([subs, items]) => {
      setSubjects(subs);
      setUniverseItems(items);
      setLoading(false);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!selectedSubjectId) { setChapters([]); return; }
    getChapters(selectedSubjectId).then(setChapters);
    setSelectedChapterIds(new Set());
    setEstimatedMinutes(null);
  }, [selectedSubjectId]);

  const toggleChapter = (id: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setEstimatedMinutes(null);
  };

  const runEstimate = useCallback(async () => {
    if (selectedChapterIds.size === 0 || !selectedSubjectId) return;
    const subject = subjects.find((s) => s.id === selectedSubjectId);
    setEstimating(true);
    try {
      const allMaterials = await Promise.all(
        [...selectedChapterIds].map((cid) => getMaterialsByChapter(cid)),
      );
      const summaries = allMaterials
        .flat()
        .filter((m) => m.summary)
        .map((m) => m.summary as string);

      if (summaries.length === 0) {
        Alert.alert(
          'No summaries available',
          'Upload and summarize materials first to get an AI estimate.',
        );
        setEstimating(false);
        return;
      }

      const { minutes, reasoning } = await estimateStudyDuration(
        summaries,
        subject?.name ?? 'Subject',
      );
      setEstimatedMinutes(minutes);
      setEstimateReasoning(reasoning);
    } catch (e) {
      Alert.alert('Estimate failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setEstimating(false);
    }
  }, [selectedChapterIds, selectedSubjectId, subjects]);

  const plannedMinutes = HOURS_VALUES[pickerHourIdx] * 60 + MINUTES_VALUES[pickerMinuteIdx];
  const plannedSeconds = plannedMinutes * 60;
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const canLaunch =
    !!selectedSubjectId &&
    !launching;

  const launchMission = async () => {
    if (!user?.id || !selectedSubjectId || launching) return;

    if (wagerType === 'crystals' && (profile?.crystal_balance ?? 0) < crystalWager) {
      Alert.alert('Insufficient Crystals', `You need ${crystalWager} crystals but only have ${profile?.crystal_balance ?? 0}.`);
      return;
    }
    if (wagerType === 'item' && !wageredItemId) {
      Alert.alert('Select an item', 'Choose a universe item to wager.');
      return;
    }

    setLaunching(true);
    try {
      const session = await createStudySession({
        user_id: user.id,
        session_type: 'mission',
        planned_seconds: plannedSeconds,
        subject_id: selectedSubjectId,
        chapter_ids: [...selectedChapterIds],
      });
      if (!session) throw new Error('Failed to create session');

      let quizId: string | null = null;
      if (withQuiz) {
        const quiz = await createQuiz(session.id, user.id, 5);
        quizId = quiz?.id ?? null;
      }

      if (wagerType === 'crystals') {
        await placeWager({
          session_id: session.id,
          user_id: user.id,
          wager_type: 'crystals',
          crystal_amount: crystalWager,
        });
        await refreshProfile();
      } else if (wagerType === 'item' && wageredItemId) {
        await placeWager({
          session_id: session.id,
          user_id: user.id,
          wager_type: 'universe_item',
          item_id: wageredItemId,
        });
        await refreshProfile();
      }

      router.replace({
        pathname: '/mission-timer' as never,
        params: {
          sessionId: session.id,
          plannedSeconds: String(plannedSeconds),
          subjectId: selectedSubjectId,
          subjectName: selectedSubject?.name ?? '',
          hasQuiz: withQuiz ? '1' : '0',
          quizId: quizId ?? '',
          chapterIds: [...selectedChapterIds].join(','),
        },
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to launch mission');
      setLaunching(false);
    }
  };

  if (loading) return <LoadingState message="Loading..." />;

  const launchLabel = selectedSubject
    ? `🚀  ${selectedSubject.emoji} ${selectedSubject.name} · ${formatMinutes(plannedMinutes)}`
    : '🚀  Launch Mission';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.bg.elevated }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
        </Pressable>
        <Text style={styles.pageTitle}>Mission Setup</Text>
      </View>

      {/* ── Subject ── */}
      {!paramSubjectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose subject</Text>
          {subjects.length === 0 ? (
            <Text style={styles.hint}>No subjects yet — create one in Portfolio first.</Text>
          ) : (
            <View style={styles.subjectGrid}>
              {subjects.map((s) => {
                const active = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSubjectId(s.id)}
                    style={({ pressed }) => [
                      styles.subjectCard,
                      active && styles.subjectCardActive,
                      pressed && !active && { opacity: 0.7 },
                    ]}
                  >
                    {active && (
                      <View style={styles.subjectCheck}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                    <Text style={styles.subjectEmoji}>{s.emoji}</Text>
                    <Text
                      style={[styles.subjectName, active && styles.subjectNameActive]}
                      numberOfLines={2}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Pre-selected subject */}
      {paramSubjectId && selectedSubject && (
        <View style={styles.subjectBanner}>
          <Text style={{ fontSize: 28 }}>{selectedSubject.emoji}</Text>
          <Text style={styles.subjectBannerName}>{selectedSubject.name}</Text>
        </View>
      )}

      {/* ── Chapters ── */}
      {selectedSubjectId && (
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>Chapters</Text>
            {selectedChapterIds.size > 0 && (
              <Text style={styles.badge}>{selectedChapterIds.size} selected</Text>
            )}
          </View>
          {chapters.length === 0 ? (
            <Text style={styles.hint}>No chapters in this subject yet.</Text>
          ) : (
            <View style={styles.pillWrap}>
              {chapters.map((c) => {
                const sel = selectedChapterIds.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleChapter(c.id)}
                    style={({ pressed }) => [styles.pill, sel && styles.pillActive, pressed && { opacity: 0.7 }]}
                  >
                    {sel && <Ionicons name="checkmark" size={11} color={colors.cosmic.purpleLight} />}
                    <Text style={[styles.pillText, sel && styles.pillTextActive]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Duration ── */}
      {selectedSubjectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Duration</Text>

          {estimateReasoning !== '' && (
            <View style={styles.aiNote}>
              <Image source={AI_AVATAR} style={styles.aiAvatar} resizeMode="contain" />
              <Text style={styles.aiNoteText}>{estimateReasoning}</Text>
            </View>
          )}

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
            <View style={styles.pickerFooter}>
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
              <Text style={styles.pickerTotal}>{formatMinutes(plannedMinutes)}</Text>
            </View>
          </View>

          {selectedChapterIds.size > 0 && (
            <Pressable
              onPress={runEstimate}
              disabled={estimating}
              style={({ pressed }) => [styles.aiBtn, (pressed || estimating) && { opacity: 0.65 }]}
            >
              {estimating
                ? <ActivityIndicator size="small" color={colors.cosmic.purpleLight} />
                : <Image source={AI_AVATAR} style={{ width: 15, height: 15 }} resizeMode="contain" />
              }
              <Text style={styles.aiBtnText}>{estimating ? 'Estimating…' : 'AI Duration Estimate'}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── Options ── */}
      {selectedSubjectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Options</Text>

          {/* Quiz */}
          <Pressable
            onPress={() => setWithQuiz((v) => !v)}
            style={({ pressed }) => [styles.optionRow, withQuiz && styles.optionRowActive, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.optionIcon, withQuiz && styles.optionIconActive]}>
              <Text style={{ fontSize: 16 }}>📝</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Quiz Challenge</Text>
              <Text style={styles.optionDesc}>5 questions after session · rarity bonus</Text>
            </View>
            <View style={[styles.switchTrack, withQuiz && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, withQuiz && styles.switchThumbOn]} />
            </View>
          </Pressable>

          {/* Wager */}
          <View style={[styles.optionRow, { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={styles.optionIcon}>
                <Text style={{ fontSize: 16 }}>⚔️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Wager</Text>
                <Text style={styles.optionDesc}>Win = bonus rarity · optional</Text>
              </View>
            </View>

            <View style={styles.segmented}>
              {(['none', 'crystals', 'item'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setWagerType(t)}
                  style={[styles.segment, wagerType === t && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, wagerType === t && styles.segmentTextActive]}>
                    {t === 'none' ? 'None' : t === 'crystals' ? '🔷 Crystals' : '🌌 Item'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {wagerType === 'crystals' && (
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.hint}>
                  Balance:{' '}
                  <Text style={{ color: colors.crystal.primary, fontWeight: typography.weights.semibold }}>
                    {profile?.crystal_balance ?? 0}
                  </Text>{' '}crystals
                </Text>
                <View style={styles.chipRow}>
                  {CRYSTAL_WAGER_OPTIONS.map((amt) => {
                    const canAfford = (profile?.crystal_balance ?? 0) >= amt;
                    const active = crystalWager === amt;
                    return (
                      <Pressable
                        key={amt}
                        onPress={() => canAfford && setCrystalWager(amt)}
                        style={[styles.chip, active && styles.chipActive, !canAfford && { opacity: 0.3 }]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{amt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {wagerType === 'item' && (
              <View style={{ gap: spacing.xs }}>
                {universeItems.length === 0 ? (
                  <Text style={styles.hint}>No active universe items to wager.</Text>
                ) : (
                  universeItems.slice(0, 6).map((item) => {
                    const active = wageredItemId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setWageredItemId(item.id)}
                        style={({ pressed }) => [styles.itemRow, active && styles.itemRowActive, pressed && { opacity: 0.75 }]}
                      >
                        <Text style={{ fontSize: 18 }}>🌌</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionTitle, active && { color: colors.cosmic.purpleLight }]}>{item.item_name}</Text>
                          <Text style={styles.optionDesc}>{item.rarity}</Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={16} color={colors.cosmic.purpleLight} />}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Launch ── */}
      <Button
        label={launchLabel}
        onPress={launchMission}
        loading={launching}
        disabled={!canLaunch}
        size="lg"
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.primary },
  content: { paddingHorizontal: spacing.md, gap: spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy },

  section: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: spacing.xs + 2, paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1, borderColor: colors.cosmic.purpleGlow,
    color: colors.cosmic.purpleLight,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  hint: { color: colors.text.muted, fontSize: typography.sizes.sm },

  // Subject grid
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  subjectCard: {
    width: CARD_W,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.bg.cardBorder,
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
  },
  subjectCardActive: {
    backgroundColor: colors.cosmic.purpleFaint,
    borderColor: colors.cosmic.purpleGlow,
    shadowColor: colors.cosmic.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  subjectCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.cosmic.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  subjectEmoji: { fontSize: 34 },
  subjectName: {
    color: colors.text.muted,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  subjectNameActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },

  subjectBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.cosmic.purpleFaint,
    borderWidth: 1, borderColor: colors.cosmic.purpleGlow,
  },
  subjectBannerName: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },

  // Chapters
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  pillActive: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purpleGlow },
  pillText: { color: colors.text.secondary, fontSize: typography.sizes.sm },
  pillTextActive: { color: colors.cosmic.purpleLight, fontWeight: typography.weights.medium },

  // Duration picker
  aiNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  aiAvatar: { width: 13, height: 13, marginTop: 2 },
  aiNoteText: { color: colors.text.muted, fontSize: typography.sizes.xs, flex: 1, lineHeight: 16 },
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
  pickerFooter: {
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
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.cosmic.purpleGlow,
  },
  aiBtnText: { color: colors.cosmic.purpleLight, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },

  // Options
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  optionRowActive: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purpleGlow },
  optionIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: colors.cosmic.purpleFaint },
  optionTitle: { color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  optionDesc: { color: colors.text.muted, fontSize: typography.sizes.xs, marginTop: 1 },

  switchTrack: {
    width: 42, height: 24, borderRadius: 12,
    backgroundColor: colors.bg.elevated,
    padding: 2,
  },
  switchTrackOn: { backgroundColor: colors.cosmic.purple },
  switchThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },

  segmented: { flexDirection: 'row', gap: spacing.xs },
  segment: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 3,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  segmentActive: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purpleGlow },
  segmentText: { color: colors.text.muted, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  segmentTextActive: { color: colors.cosmic.purpleLight },

  chipRow: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.bg.cardBorder,
  },
  chipActive: { backgroundColor: colors.cosmic.purpleFaint, borderColor: colors.cosmic.purpleGlow },
  chipText: { color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  chipTextActive: { color: colors.cosmic.purpleLight },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  itemRowActive: {},
});
