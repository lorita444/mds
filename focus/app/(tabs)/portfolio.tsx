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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';
import { addSubject, fetchSubjects, removeSubject } from '../../services/subjects.service';
import { subjectSchema, type SubjectForm } from '../../lib/schemas';
import { toast } from '../../store/useAppStore';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import type { Subject } from '../../lib/types';

const SUBJECT_COLORS = [
  '#7c3aed', '#0d9488', '#db2777', '#d97706',
  '#2563eb', '#16a34a', '#dc2626', '#9333ea',
];
const SUBJECT_EMOJIS = ['📚', '🧬', '📐', '📜', '⚗️', '🌍', '💻', '🎨', '📊', '🔬', '⚖️', '🏛️'];

export default function PortfolioScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Color/emoji state outside the form (not text inputs)
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

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const result = await fetchSubjects(user.id);
      if (result.error) setError(result.error);
      else if (result.data) setSubjects(result.data);
      setLoading(false);
      setRefreshing(false);
    },
    [user?.id],
  );

  useEffect(() => { load(false); }, [load]);

  const onSubmitCreate = async (values: SubjectForm) => {
    if (!user?.id) return;
    const result = await addSubject(
      user.id,
      values.name,
      values.description || undefined,
      selectedColor,
      selectedEmoji ?? '',
    );
    if (result.error) {
      toast(result.error, 'error');
      return;
    }
    const newSubject = result.data!;
    setSubjects((prev) => [...prev, newSubject]);
    closeModal();
    toast(`"${newSubject.name}" created`, 'success');
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
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await removeSubject(s.id);
            if (result.error) {
              toast(result.error, 'error');
              return;
            }
            setSubjects((prev) => prev.filter((x) => x.id !== s.id));
            toast(`"${s.name}" deleted`, 'info');
          },
        },
      ],
    );
  };

  if (error) return <ErrorState message={error} onRetry={() => load(false)} fullscreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + 88,
        paddingHorizontal: spacing.md,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.cosmic.purpleLight}
        />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy }}>
          Portfolio
        </Text>
        <Button label="+ Subject" size="sm" variant="ghost" onPress={() => setShowCreate(true)} />
      </View>

      {loading ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
        </View>
      ) : subjects.length === 0 ? (
        <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
          <View
            style={{
              width: 120,
              height: 120,
              backgroundColor: colors.cosmic.purpleFaint,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cosmic.purpleGlow,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 48 }}>📚</Text>
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ color: colors.text.primary, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, textAlign: 'center' }}>
              No subjects yet
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.base, textAlign: 'center', lineHeight: 22 }}>
              Create your first subject to start organizing study materials and unlocking AI tools.
            </Text>
          </View>
          <Button label="Create Your First Subject" onPress={() => setShowCreate(true)} size="lg" fullWidth />
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/subject/${s.id}` as never)}
              onLongPress={() => handleDelete(s)}
              style={({ pressed }) => ({
                backgroundColor: colors.bg.card,
                borderWidth: 1,
                borderColor: colors.bg.cardBorder,
                borderRadius: radius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.md,
                  backgroundColor: `${s.color}22`,
                  borderWidth: 1.5,
                  borderColor: `${s.color}55`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.emoji ? (
                  <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: '700', color: s.color }}>
                    {s.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.semibold }}>
                  {s.name}
                </Text>
                {s.description && (
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }} numberOfLines={1}>
                    {s.description}
                  </Text>
                )}
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  Hold to delete · Tap to open
                </Text>
              </View>
              <Text style={{ color: colors.text.muted, fontSize: 20 }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Quick tips */}
      {!loading && subjects.length > 0 && (
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
            What you can do
          </Text>
          {[
            { icon: '📄', title: 'Upload materials', body: 'Tap a subject → add chapters → upload PDFs or notes.' },
            { icon: '🤖', title: 'AI summaries', body: 'Open a subject and tap "Summarize" on any material.' },
            { icon: '🃏', title: 'Flashcards', body: 'Generate flashcards from any chapter with one tap.' },
            { icon: '🎯', title: 'Start a Mission', body: 'Select a subject to begin Mission Focus Mode.' },
          ].map((tip) => (
            <Card key={tip.title} variant="flat" padding={spacing.sm + 4}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 20 }}>{tip.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold }}>
                    {tip.title}
                  </Text>
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, lineHeight: 17 }}>
                    {tip.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Create subject modal */}
      <Modal visible={showCreate} onClose={closeModal} title="New Subject" scrollable>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
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

          {/* Emoji picker */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
              Icon
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {/* None tile */}
              <Pressable
                onPress={() => setSelectedEmoji(null)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.sm,
                  backgroundColor: selectedEmoji === null ? colors.cosmic.purpleFaint : colors.bg.card,
                  borderWidth: 1.5,
                  borderColor: selectedEmoji === null ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedEmoji === null ? colors.cosmic.purpleLight : colors.text.muted }}>
                  Aa
                </Text>
              </Pressable>
              {SUBJECT_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setSelectedEmoji(e)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.sm,
                    backgroundColor: selectedEmoji === e ? colors.cosmic.purpleFaint : colors.bg.card,
                    borderWidth: 1.5,
                    borderColor: selectedEmoji === e ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Color picker */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
              Color
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {SUBJECT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: c,
                    borderWidth: selectedColor === c ? 3 : 0,
                    borderColor: colors.text.primary,
                  }}
                />
              ))}
            </View>
          </View>

          <Button
            label="Create Subject"
            onPress={handleSubmit(onSubmitCreate)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />
        </View>
      </Modal>
    </ScrollView>
  );
}
