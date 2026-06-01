import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { AI_AVATAR } from '../../utils/assets';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/auth-context';
import {
  getSubject,
  getChapters,
  getMaterials,
  createChapter,
  deleteChapter,
  createMaterial,
  deleteMaterial,
  uploadMaterial,
  deleteMaterialFile,
} from '../../lib/db';
import { toast } from '../../store/useAppStore';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonBox, SkeletonCard } from '../../components/ui/Skeleton';
import type { Subject, Chapter, Material } from '../../lib/types';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function SubjectSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <SkeletonBox width={52} height={52} borderRadius={radius.md} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBox width="60%" height={22} />
          <SkeletonBox width="40%" height={14} />
        </View>
      </View>
      {/* Action row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 72,
              borderRadius: radius.lg,
              backgroundColor: colors.bg.elevated,
            }}
          />
        ))}
      </View>
      {/* Chapter cards */}
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </View>
  );
}

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Chapter modal
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterDesc, setNewChapterDesc] = useState('');
  const [chapterNameError, setChapterNameError] = useState('');
  const [creatingChapter, setCreatingChapter] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [s, c, m] = await Promise.all([getSubject(id), getChapters(id), getMaterials(id)]);
        setSubject(s);
        setChapters(c);
        setMaterials(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load subject');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => { load(false); }, [load]);

  const handleAddChapter = async () => {
    if (!newChapterName.trim()) { setChapterNameError('Chapter name required'); return; }
    setChapterNameError('');
    setCreatingChapter(true);
    try {
      const desc = newChapterDesc.trim() || undefined;
      const c = await createChapter(id!, newChapterName.trim(), desc, chapters.length);
      if (c) {
        setChapters((prev) => [...prev, c]);
        setNewChapterName('');
        setNewChapterDesc('');
        setShowAddChapter(false);
        toast(`"${c.name}" created`, 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create chapter', 'error');
    } finally {
      setCreatingChapter(false);
    }
  };

  const handleDeleteChapter = (c: Chapter) => {
    Alert.alert(
      'Delete Chapter',
      `Delete "${c.name}"? Materials in this chapter will be moved to the subject root.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChapter(c.id);
              setChapters((prev) => prev.filter((x) => x.id !== c.id));
              toast(`"${c.name}" deleted`, 'info');
            } catch {
              toast('Failed to delete chapter', 'error');
            }
          },
        },
      ],
    );
  };

  const handleUploadMaterial = async (chapterId: string | null) => {
    if (!user?.id || !id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/*',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setUploading(true);

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const url = await uploadMaterial(
        user.id,
        id,
        file.name,
        blob,
        file.mimeType ?? 'application/octet-stream',
      );

      const material = await createMaterial({
        subject_id: id,
        chapter_id: chapterId,
        user_id: user.id,
        name: file.name,
        file_url: url,
        file_type: file.mimeType ?? 'unknown',
        size_bytes: file.size ?? blob.size,
      });

      if (material) {
        setMaterials((prev) => [...prev, material]);
        toast(`"${file.name}" uploaded`, 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = (m: Material) => {
    Alert.alert('Delete Material', `Remove "${m.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMaterial(m.id);
            await deleteMaterialFile(m.file_url);
            setMaterials((prev) => prev.filter((x) => x.id !== m.id));
            toast(`"${m.name}" deleted`, 'info');
          } catch {
            toast('Failed to delete material', 'error');
          }
        },
      },
    ]);
  };

  if (error || (!loading && !subject)) {
    return <ErrorState message={error ?? 'Subject not found'} onRetry={() => load(false)} fullscreen />;
  }

  const unassignedMaterials = materials.filter((m) => !m.chapter_id);

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
      {/* Back */}
      <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm }}>‹ Portfolio</Text>
      </Pressable>

      {loading ? (
        <SubjectSkeleton />
      ) : (
        <>
          {/* Subject header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: `${subject!.color}22`,
                borderWidth: 1.5,
                borderColor: `${subject!.color}55`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 26 }}>{subject!.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.xl, fontWeight: typography.weights.heavy }}>
                {subject!.name}
              </Text>
              {subject!.description && (
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
                  {subject!.description}
                </Text>
              )}
            </View>
          </View>

          {/* AI action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push(`/ai-chat/${subject!.id}` as never)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.cosmic.purpleFaint,
                borderWidth: 1,
                borderColor: colors.cosmic.purpleGlow,
                borderRadius: radius.lg,
                padding: spacing.md,
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Image source={AI_AVATAR} style={{ width: 26, height: 26 }} resizeMode="contain" />
              <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textAlign: 'center' }}>
                AI Chat
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/flashcards/${subject!.id}` as never)}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.cosmic.tealFaint,
                borderWidth: 1,
                borderColor: colors.cosmic.teal,
                borderRadius: radius.lg,
                padding: spacing.md,
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 22 }}>🃏</Text>
              <Text style={{ color: colors.cosmic.tealLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textAlign: 'center' }}>
                Flashcards
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/mission-setup',
                  params: { subjectId: subject!.id },
                } as never)
              }
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: 'rgba(219,39,119,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(219,39,119,0.3)',
                borderRadius: radius.lg,
                padding: spacing.md,
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <Text style={{ color: colors.cosmic.pinkLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textAlign: 'center' }}>
                Mission
              </Text>
            </Pressable>
          </View>

          {/* Chapters */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  letterSpacing: typography.tracking.widest,
                  textTransform: 'uppercase',
                }}
              >
                Chapters ({chapters.length})
              </Text>
              <Button label="+ Chapter" size="sm" variant="ghost" onPress={() => setShowAddChapter(true)} />
            </View>

            {chapters.map((chapter) => {
              const chapterMaterials = materials.filter((m) => m.chapter_id === chapter.id);
              return (
                <Card key={chapter.id} variant="default" padding={spacing.md}>
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                        <Text style={{ fontSize: 18 }}>📁</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.semibold }}>
                            {chapter.name}
                          </Text>
                          {chapter.description && (
                            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, marginTop: 2 }}>
                              {chapter.description}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <Pressable
                          onPress={() => handleUploadMaterial(chapter.id)}
                          style={({ pressed }) => ({
                            backgroundColor: colors.cosmic.purpleFaint,
                            borderRadius: radius.sm,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={{ color: colors.cosmic.purpleLight, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                            {uploading ? '…' : '+ Upload'}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => handleDeleteChapter(chapter)} style={{ padding: 5 }}>
                          <Text style={{ color: colors.text.muted, fontSize: 16 }}>✕</Text>
                        </Pressable>
                      </View>
                    </View>

                    {chapterMaterials.length === 0 ? (
                      <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs, paddingLeft: 28 }}>
                        No materials yet. Tap + Upload to add files.
                      </Text>
                    ) : (
                      chapterMaterials.map((m) => (
                        <MaterialRow key={m.id} material={m} onDelete={() => handleDeleteMaterial(m)} />
                      ))
                    )}
                  </View>
                </Card>
              );
            })}

            {chapters.length === 0 && (
              <Card variant="flat" padding={spacing.md}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  No chapters yet. Create chapters to organize your materials.
                </Text>
              </Card>
            )}
          </View>

          {/* Unassigned materials */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  letterSpacing: typography.tracking.widest,
                  textTransform: 'uppercase',
                }}
              >
                Unassigned Materials
              </Text>
              <Pressable
                onPress={() => handleUploadMaterial(null)}
                style={({ pressed }) => ({
                  backgroundColor: colors.bg.elevated,
                  borderRadius: radius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs }}>
                  {uploading ? 'Uploading…' : '+ Upload'}
                </Text>
              </Pressable>
            </View>

            {unassignedMaterials.length === 0 ? (
              <Card variant="flat" padding={spacing.md}>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  Upload materials directly to the subject or to a specific chapter.
                </Text>
              </Card>
            ) : (
              unassignedMaterials.map((m) => (
                <MaterialRow key={m.id} material={m} onDelete={() => handleDeleteMaterial(m)} />
              ))
            )}
          </View>
        </>
      )}

      {/* Add chapter modal */}
      <Modal
        visible={showAddChapter}
        onClose={() => { setShowAddChapter(false); setNewChapterName(''); setNewChapterDesc(''); setChapterNameError(''); }}
        title="New Chapter"
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }}>
          <Input
            label="Chapter name"
            placeholder="e.g. Chapter 1: Introduction"
            value={newChapterName}
            onChangeText={setNewChapterName}
            autoFocus
            error={chapterNameError}
            returnKeyType="next"
          />
          <Input
            label="Description (optional)"
            placeholder="e.g. Fundamental concepts and definitions"
            value={newChapterDesc}
            onChangeText={setNewChapterDesc}
            returnKeyType="done"
            onSubmitEditing={handleAddChapter}
            multiline
            numberOfLines={2}
          />
          <Button
            label="Create Chapter"
            onPress={handleAddChapter}
            loading={creatingChapter}
            fullWidth
            size="lg"
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

function MaterialRow({ material, onDelete }: { material: Material; onDelete: () => void }) {
  const icon = material.file_type.includes('pdf')
    ? '📄'
    : material.file_type.includes('text') || material.file_type.includes('word')
    ? '📝'
    : '📎';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.bg.secondary,
        borderRadius: radius.sm,
        padding: spacing.sm,
        paddingLeft: 28,
      }}
    >
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}
          numberOfLines={1}
        >
          {material.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
            {formatBytes(material.size_bytes)}
          </Text>
          {material.is_summarized && (
            <View
              style={{
                backgroundColor: colors.status.successFaint,
                borderRadius: radius.full,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Text style={{ color: colors.status.success, fontSize: 10, fontWeight: '600' }}>
                Summarized
              </Text>
            </View>
          )}
          {material.embedding_done && (
            <View
              style={{
                backgroundColor: colors.cosmic.purpleFaint,
                borderRadius: radius.full,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <Text style={{ color: colors.cosmic.purpleLight, fontSize: 10, fontWeight: '600' }}>
                Indexed
              </Text>
            </View>
          )}
        </View>
      </View>
      <Pressable onPress={onDelete} style={{ padding: 4 }}>
        <Text style={{ color: colors.text.muted, fontSize: 14 }}>✕</Text>
      </Pressable>
    </View>
  );
}
