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
import { Ionicons } from '@expo/vector-icons';
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

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: 3 }}>
          <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xxl, fontWeight: typography.weights.heavy }}>
            Portfolio
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
            {loading ? 'Loading subjects...' : `${subjects.length} subject${subjects.length === 1 ? '' : 's'} in your archive`}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new subject"
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: radius.md,
            backgroundColor: pressed ? 'rgba(124,58,237,0.2)' : colors.bg.elevated,
            borderWidth: 1,
            borderColor: pressed ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            opacity: pressed ? 0.86 : 1,
          })}
        >
          <Ionicons name={'add' as IoniconsName} size={27} color={colors.cosmic.purpleLight} />
        </Pressable>
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
        <View style={{ gap: spacing.md }}>
          {subjects.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/subject/${s.id}` as never)}
              style={({ pressed }) => ({
                marginTop: spacing.xs,
                opacity: pressed ? 0.94 : 1,
              })}
            >
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: pressed ? '#1b2540' : '#151f36',
                    borderWidth: 2,
                    borderColor: pressed ? `${s.color}cc` : 'rgba(167,139,250,0.36)',
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    minHeight: 118,
                    overflow: 'hidden',
                    shadowColor: s.color,
                    shadowOpacity: pressed ? 0.32 : 0.18,
                    shadowRadius: pressed ? 18 : 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: pressed ? 8 : 4,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 7,
                    }}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View
                      style={{
                        width: 60,
                        height: 60,
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
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: colors.text.primary, fontSize: typography.sizes.md, fontWeight: typography.weights.bold }}>
                        {s.name}
                      </Text>
                      {s.description && (
                        <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }} numberOfLines={2}>
                          {s.description}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Ionicons name={'folder-open-outline' as IoniconsName} size={13} color={colors.text.muted} />
                        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                          Study space
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: spacing.xs }}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          handleDelete(s);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${s.name}`}
                        hitSlop={8}
                        style={({ pressed: deletePressed }) => ({
                          width: 48,
                          height: 48,
                          borderRadius: radius.md,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: deletePressed ? colors.status.errorFaint : 'rgba(255,255,255,0.04)',
                          borderWidth: 1,
                          borderColor: deletePressed ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)',
                        })}
                      >
                        <Ionicons name={'trash-outline' as IoniconsName} size={19} color={colors.text.muted} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
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
