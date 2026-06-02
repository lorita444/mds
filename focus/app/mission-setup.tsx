import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  getQuizResultsBySubject,
} from '../lib/db';
import { estimateStudyDuration, recommendWeakChapters } from '../lib/ollama';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
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

  const [estimating, setEstimating] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [estimateReasoning, setEstimateReasoning] = useState('');
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const [customMinutesError, setCustomMinutesError] = useState('');

  const handleSetCustomDuration = () => {
    const mins = parseInt(customMinutesInput.trim(), 10);
    if (isNaN(mins) || mins <= 0) {
      setCustomMinutesError('Please enter a positive number of minutes.');
      return;
    }
    if (mins > 720) {
      setCustomMinutesError('Maximum duration is 720 minutes (12 hours).');
      return;
    }
    setCustomMinutesError('');
    setCustomMinutes(mins);
    setShowCustomModal(false);
    setCustomMinutesInput('');
  };

  const [weakChapterIds, setWeakChapterIds] = useState<Record<string, string>>({});

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
    if (!selectedSubjectId) {
      setChapters([]);
      setWeakChapterIds({});
      return;
    }
    setSelectedChapterIds(new Set());
    setEstimatedMinutes(null);
    setWeakChapterIds({});
    getChapters(selectedSubjectId).then((fetched) => {
      setChapters(fetched);
      if (!user?.id || fetched.length === 0) return;
      getQuizResultsBySubject(user.id, selectedSubjectId).then((history) => {
        const recs = recommendWeakChapters(history, fetched);
        const map: Record<string, string> = {};
        recs.forEach((r) => { map[r.chapterId] = r.reason; });
        setWeakChapterIds(map);
      });
    });
  }, [selectedSubjectId, user?.id]);

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
      setCustomMinutes(null);
    } catch (e) {
      Alert.alert('Estimate failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setEstimating(false);
    }
  }, [selectedChapterIds, selectedSubjectId, subjects]);

  const plannedSeconds = (customMinutes ?? estimatedMinutes ?? 45) * 60;
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

  const durationOptions = [30, 45, 60, 90, 120];

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
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.bg.elevated,
            borderWidth: 1, borderColor: colors.bg.cardBorder,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.lg }}>‹</Text>
        </Pressable>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.heavy,
          }}
        >
          Mission Setup
        </Text>
      </View>

      {/* Subject picker */}
      {!paramSubjectId && (
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
            Subject
          </Text>
          {subjects.length === 0 ? (
            <Card variant="flat" padding={spacing.lg}>
              <View style={{ gap: spacing.md, alignItems: 'center' }}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  No subjects yet — create one in Portfolio first.
                </Text>
                <Pressable
                  onPress={() => router.replace('/(tabs)/portfolio' as never)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.sm + 2,
                    paddingHorizontal: spacing.xl,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.cosmic.purpleGlow,
                    backgroundColor: colors.cosmic.purpleFaint,
                    opacity: pressed ? 0.75 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}
                >
                  <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold }}>
                    Go to Portfolio →
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {subjects.map((s) => {
                const active = selectedSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedSubjectId(s.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.cosmic.purpleFaint : colors.bg.card,
                      borderWidth: 1,
                      borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: typography.sizes.sm,
                        fontWeight: active ? typography.weights.semibold : typography.weights.regular,
                        flex: 1,
                      }}
                    >
                      {s.name}
                    </Text>
                    {active && <Text style={{ color: colors.cosmic.purpleLight, fontSize: 16 }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Selected subject display (when pre-selected from param) */}
      {paramSubjectId && selectedSubject && (
        <Card variant="elevated" padding={spacing.md}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 24 }}>{selectedSubject.emoji}</Text>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.semibold,
              }}
            >
              {selectedSubject.name}
            </Text>
          </View>
        </Card>
      )}

      {/* Chapter selection */}
      {selectedSubjectId && (
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
            Chapters (optional)
          </Text>
          {chapters.length === 0 ? (
            <Card variant="flat" padding={spacing.md}>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  No chapters in this subject yet. The full subject will be used.
                </Text>
                <Pressable
                  onPress={() => router.push(`/subject/${selectedSubjectId}` as never)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.xs + 2,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.bg.cardBorder,
                    backgroundColor: pressed ? colors.bg.elevated : colors.bg.card,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium }}>
                    Add chapters in Portfolio →
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {chapters.map((c) => {
                const selected = selectedChapterIds.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleChapter(c.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm + 4,
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.cosmic.purpleFaint : colors.bg.card,
                      borderWidth: 1,
                      borderColor: selected ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.cosmic.purple : colors.text.muted,
                        backgroundColor: selected ? colors.cosmic.purple : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected && (
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: typography.sizes.sm,
                        flex: 1,
                      }}
                    >
                      {c.name}
                    </Text>
                    {weakChapterIds[c.id] && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                          backgroundColor: 'rgba(239,68,68,0.12)',
                          borderRadius: radius.full,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9 }}>⚠️</Text>
                        <Text style={{ color: colors.status.error, fontSize: typography.sizes.xs }}>
                          {weakChapterIds[c.id]}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* AI Duration Estimate */}
      {selectedSubjectId && (
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

          {estimatedMinutes !== null && (
            <Card variant="glow" padding={spacing.md}>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Image source={AI_AVATAR} style={{ width: 18, height: 18 }} resizeMode="contain" />
                  <Text
                    style={{
                      color: colors.cosmic.purpleLight,
                      fontSize: typography.sizes.xs,
                      fontWeight: typography.weights.semibold,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    AI Estimate
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: typography.sizes.xl,
                    fontWeight: typography.weights.heavy,
                  }}
                >
                  {formatMinutes(estimatedMinutes)}
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                  {estimateReasoning}
                </Text>
              </View>
            </Card>
          )}

          {/* Manual duration override */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {durationOptions.map((m) => {
              const active = customMinutes === m ||
                (customMinutes === null && estimatedMinutes === m);
              return (
                <Pressable
                  key={m}
                  onPress={() => setCustomMinutes(m)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.cosmic.purple : colors.bg.card,
                    borderWidth: 1,
                    borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: typography.sizes.sm,
                      fontWeight: active ? typography.weights.bold : typography.weights.regular,
                    }}
                  >
                    {formatMinutes(m)}
                  </Text>
                </Pressable>
              );
            })}
            {/* Custom Duration Chip */}
            {(() => {
              const isCustomActive = customMinutes !== null && !durationOptions.includes(customMinutes) && customMinutes !== estimatedMinutes;
              return (
                <Pressable
                  onPress={() => setShowCustomModal(true)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: isCustomActive ? colors.cosmic.purple : 'rgba(124,58,237,0.1)',
                    borderWidth: 1,
                    borderColor: isCustomActive ? colors.cosmic.purpleGlow : 'rgba(124,58,237,0.3)',
                  }}
                >
                  <Text
                    style={{
                      color: isCustomActive ? colors.text.primary : colors.cosmic.purpleLight,
                      fontSize: typography.sizes.sm,
                      fontWeight: isCustomActive ? typography.weights.bold : typography.weights.regular,
                    }}
                  >
                    {isCustomActive ? `Custom: ${formatMinutes(customMinutes)}` : '+ Custom'}
                  </Text>
                </Pressable>
              );
            })()}
          </View>

          {selectedChapterIds.size > 0 && (
            <Pressable
              onPress={runEstimate}
              disabled={estimating}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.bg.elevated,
                borderWidth: 1,
                borderColor: colors.cosmic.purpleGlow,
                opacity: pressed || estimating ? 0.7 : 1,
              })}
            >
              {estimating ? (
                <ActivityIndicator size="small" color={colors.cosmic.purpleLight} />
              ) : (
                <Image source={AI_AVATAR} style={{ width: 16, height: 16 }} resizeMode="contain" />
              )}
              <Text
                style={{
                  color: colors.cosmic.purpleLight,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                }}
              >
                {estimating ? 'Estimating…' : 'AI Duration Estimate'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Quiz toggle */}
      {selectedSubjectId && (
        <Pressable
          onPress={() => setWithQuiz((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: withQuiz ? colors.cosmic.purpleFaint : colors.bg.card,
            borderWidth: 1,
            borderColor: withQuiz ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
              }}
            >
              📝 Quiz Challenge
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
              Pass a 5-question quiz after the session for a rarity bonus.
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              backgroundColor: withQuiz ? colors.cosmic.purple : colors.bg.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#fff',
                alignSelf: withQuiz ? 'flex-end' : 'flex-start',
              }}
            />
          </View>
        </Pressable>
      )}

      {/* Wager section */}
      {selectedSubjectId && (
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
            Wager (optional — win = bonus rarity)
          </Text>

          {/* Wager type selector */}
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {(['none', 'crystals', 'item'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setWagerType(t)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: wagerType === t ? colors.cosmic.purpleFaint : colors.bg.card,
                  borderWidth: 1,
                  borderColor: wagerType === t ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                }}
              >
                <Text
                  style={{
                    color: wagerType === t ? colors.cosmic.purpleLight : colors.text.muted,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.medium,
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'none' ? 'No wager' : t === 'crystals' ? '🔷 Crystals' : '🌌 Item'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Crystal amount */}
          {wagerType === 'crystals' && (
            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: typography.sizes.xs,
                }}
              >
                Balance: {profile?.crystal_balance ?? 0} crystals
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {CRYSTAL_WAGER_OPTIONS.map((amt) => {
                  const canAfford = (profile?.crystal_balance ?? 0) >= amt;
                  const active = crystalWager === amt;
                  return (
                    <Pressable
                      key={amt}
                      onPress={() => canAfford && setCrystalWager(amt)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: active ? colors.cosmic.purpleFaint : colors.bg.card,
                        borderWidth: 1,
                        borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                        opacity: canAfford ? 1 : 0.4,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.cosmic.purpleLight : colors.text.secondary,
                          fontSize: typography.sizes.xs,
                          fontWeight: typography.weights.medium,
                        }}
                      >
                        {amt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Item wager */}
          {wagerType === 'item' && (
            <View style={{ gap: spacing.xs }}>
              {universeItems.length === 0 ? (
                <Card variant="flat" padding={spacing.sm}>
                  <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, textAlign: 'center' }}>
                    No active universe items to wager.
                  </Text>
                </Card>
              ) : (
                universeItems.slice(0, 6).map((item) => {
                  const active = wageredItemId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setWageredItemId(item.id)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: active ? colors.cosmic.purpleFaint : colors.bg.card,
                        borderWidth: 1,
                        borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 20 }}>🌌</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xs, fontWeight: typography.weights.medium }}>
                          {item.item_name}
                        </Text>
                        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                          {item.rarity}
                        </Text>
                      </View>
                      {active && (
                        <Text style={{ color: colors.cosmic.purpleLight }}>✓</Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}

      {/* Summary + Launch */}
      {selectedSubjectId && (
        <Card variant="elevated" padding={spacing.md}>
          <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
              }}
            >
              Mission Summary
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
              Subject: {selectedSubject?.name}
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
              Duration: {formatMinutes(customMinutes ?? estimatedMinutes ?? 45)}
            </Text>
            {selectedChapterIds.size > 0 && (
              <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                Chapters: {selectedChapterIds.size} selected
              </Text>
            )}
            {withQuiz && (
              <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                Quiz: 5 questions at the end
              </Text>
            )}
            {wagerType !== 'none' && (
              <Text style={{ color: colors.status.warning, fontSize: typography.sizes.xs }}>
                Wager: {wagerType === 'crystals' ? `${crystalWager} crystals` : 'Universe item'}
              </Text>
            )}
          </View>
          <Button
            label="🚀 Launch Mission"
            onPress={launchMission}
            loading={launching}
            disabled={!canLaunch}
            size="lg"
            fullWidth
          />
        </Card>
      )}

      {!selectedSubjectId && subjects.length > 0 && (
        <Card variant="flat" padding={spacing.md}>
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
            ☝️ Select a subject above to configure your mission.
          </Text>
        </Card>
      )}
      <Modal
        visible={showCustomModal}
        onClose={() => { setShowCustomModal(false); setCustomMinutesError(''); }}
        title="Custom Duration"
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
          <Input
            label="Duration in minutes"
            placeholder="e.g. 50"
            value={customMinutesInput}
            onChangeText={(v) => { setCustomMinutesInput(v); setCustomMinutesError(''); }}
            keyboardType="number-pad"
            autoFocus
            error={customMinutesError}
          />
          <Button
            label="Set Duration"
            onPress={handleSetCustomDuration}
            fullWidth
            size="lg"
          />
        </View>
      </Modal>
    </ScrollView>
  );
}
