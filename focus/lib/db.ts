/**
 * Typed database service layer.
 * All Supabase queries go through here so screens stay clean.
 */
import { supabase } from './supabase';
import type {
  UserProfile,
  Subject,
  Chapter,
  Material,
  StudySession,
  Reward,
  UniverseItem,
  Flashcard,
  AIChatMessage,
  CoopRoom,
  CoopRoomMember,
  Streak,
  Wager,
  Quiz,
  QuizQuestion,
} from './types';

// ── USERS ────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'username' | 'avatar_url'>>,
): Promise<void> {
  await supabase.from('users').update(updates).eq('id', userId);
}

// ── SUBJECTS ─────────────────────────────────────────────────

export async function getSubjects(userId: string): Promise<Subject[]> {
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getSubject(id: string): Promise<Subject | null> {
  const { data } = await supabase.from('subjects').select('*').eq('id', id).single();
  return data;
}

export async function createSubject(
  userId: string,
  name: string,
  description?: string,
  color?: string,
  emoji?: string,
): Promise<Subject | null> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name, description, color: color ?? '#7c3aed', emoji: emoji ?? '📚' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubject(
  id: string,
  updates: Partial<Pick<Subject, 'name' | 'description' | 'color' | 'emoji'>>,
): Promise<void> {
  await supabase.from('subjects').update(updates).eq('id', id);
}

export async function deleteSubject(id: string): Promise<void> {
  await supabase.from('subjects').delete().eq('id', id);
}

// ── CHAPTERS ─────────────────────────────────────────────────

export async function getChapters(subjectId: string): Promise<Chapter[]> {
  const { data } = await supabase
    .from('chapters')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index', { ascending: true });
  return data ?? [];
}

export async function createChapter(
  subjectId: string,
  name: string,
  orderIndex?: number,
): Promise<Chapter | null> {
  const { data } = await supabase
    .from('chapters')
    .insert({ subject_id: subjectId, name, order_index: orderIndex ?? 0 })
    .select()
    .single();
  return data;
}

export async function updateChapter(
  id: string,
  updates: Partial<Pick<Chapter, 'name' | 'order_index'>>,
): Promise<void> {
  await supabase.from('chapters').update(updates).eq('id', id);
}

export async function deleteChapter(id: string): Promise<void> {
  await supabase.from('chapters').delete().eq('id', id);
}

// ── MATERIALS ────────────────────────────────────────────────

export async function getMaterials(subjectId: string): Promise<Material[]> {
  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getMaterialsByChapter(chapterId: string): Promise<Material[]> {
  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function createMaterial(payload: {
  subject_id: string;
  chapter_id: string | null;
  user_id: string;
  name: string;
  file_url: string;
  file_type: string;
  size_bytes: number;
}): Promise<Material | null> {
  const { data } = await supabase.from('materials').insert(payload).select().single();
  return data;
}

export async function updateMaterialSummary(id: string, summary: string): Promise<void> {
  await supabase.from('materials').update({ summary, is_summarized: true }).eq('id', id);
}

export async function markMaterialEmbedded(id: string): Promise<void> {
  await supabase.from('materials').update({ embedding_done: true }).eq('id', id);
}

export async function deleteMaterial(id: string): Promise<void> {
  await supabase.from('materials').delete().eq('id', id);
}

// ── STORAGE (materials bucket) ───────────────────────────────

export async function uploadMaterial(
  userId: string,
  subjectId: string,
  fileName: string,
  fileBlob: Blob,
  mimeType: string,
): Promise<string> {
  const path = `${userId}/${subjectId}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage
    .from('materials')
    .upload(path, fileBlob, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('materials').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteMaterialFile(fileUrl: string): Promise<void> {
  const path = fileUrl.split('/materials/')[1];
  if (path) await supabase.storage.from('materials').remove([path]);
}

// ── STUDY SESSIONS ───────────────────────────────────────────

export async function createStudySession(payload: {
  user_id: string;
  session_type: 'casual' | 'mission';
  planned_seconds: number;
  subject_id?: string;
  chapter_ids?: string[];
}): Promise<StudySession | null> {
  const { data } = await supabase.from('study_sessions').insert(payload).select().single();
  return data;
}

export async function getRecentSessions(
  userId: string,
  limit = 20,
): Promise<StudySession[]> {
  const { data } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function completeSession(
  sessionId: string,
  durationSeconds: number,
  quizPassed = false,
  coopBonus = false,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('complete_study_session', {
    p_session_id: sessionId,
    p_duration_seconds: durationSeconds,
    p_quiz_passed: quizPassed,
    p_coop_bonus: coopBonus,
  });
  if (error) throw error;
  return data;
}

export async function abandonSession(
  sessionId: string,
  durationSeconds: number,
): Promise<void> {
  const { error } = await supabase.rpc('abandon_study_session', {
    p_session_id: sessionId,
    p_duration_seconds: durationSeconds,
  });
  if (error) throw error;
}

// ── WAGERS ───────────────────────────────────────────────────

export async function placeWager(payload: {
  session_id: string;
  user_id: string;
  wager_type: 'crystals' | 'universe_item';
  crystal_amount?: number;
  item_id?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('place_wager', {
    p_session_id: payload.session_id,
    p_user_id: payload.user_id,
    p_wager_type: payload.wager_type,
    p_crystal_amount: payload.crystal_amount ?? null,
    p_item_id: payload.item_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ── UNIVERSE ITEMS ───────────────────────────────────────────

export async function getUniverseItems(userId: string): Promise<UniverseItem[]> {
  const { data } = await supabase
    .from('user_universe_items')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  return data ?? [];
}

export async function getActiveUniverseItems(userId: string): Promise<UniverseItem[]> {
  const { data } = await supabase
    .from('user_universe_items')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('earned_at', { ascending: false });
  return data ?? [];
}

// ── REWARDS ──────────────────────────────────────────────────

export async function getReward(rewardId: string): Promise<Reward | null> {
  const { data } = await supabase.from('rewards').select('*').eq('id', rewardId).single();
  return data;
}

export async function getRewardHistory(userId: string, limit = 30): Promise<Reward[]> {
  const { data } = await supabase
    .from('rewards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── FLASHCARDS ───────────────────────────────────────────────

export async function getFlashcards(
  subjectId: string,
  chapterId?: string,
): Promise<Flashcard[]> {
  let query = supabase.from('flashcards').select('*').eq('subject_id', subjectId);
  if (chapterId) query = query.eq('chapter_id', chapterId);
  const { data } = await query.order('created_at', { ascending: false });
  return data ?? [];
}

export async function createFlashcards(
  cards: Omit<Flashcard, 'id' | 'created_at'>[],
): Promise<Flashcard[]> {
  const { data } = await supabase.from('flashcards').insert(cards).select();
  return data ?? [];
}

export async function updateFlashcardStatus(
  id: string,
  status: 'new' | 'known' | 'needs_review',
): Promise<void> {
  await supabase.from('flashcards').update({ review_status: status }).eq('id', id);
}

export async function deleteFlashcard(id: string): Promise<void> {
  await supabase.from('flashcards').delete().eq('id', id);
}

// ── AI CHAT ──────────────────────────────────────────────────

export async function getChatHistory(subjectId: string): Promise<AIChatMessage[]> {
  const { data } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function saveMessage(
  subjectId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<AIChatMessage | null> {
  const { data } = await supabase
    .from('ai_chat_messages')
    .insert({ subject_id: subjectId, user_id: userId, role, content })
    .select()
    .single();
  return data;
}

// ── QUIZZES ──────────────────────────────────────────────────

export async function createQuiz(
  sessionId: string,
  userId: string,
  totalQuestions: number,
): Promise<Quiz | null> {
  const { data } = await supabase
    .from('quizzes')
    .insert({ session_id: sessionId, user_id: userId, total_questions: totalQuestions })
    .select()
    .single();
  return data;
}

export async function getQuizWithQuestions(
  quizId: string,
): Promise<(Quiz & { questions: QuizQuestion[] }) | null> {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
  if (!quiz) return null;
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });
  return { ...quiz, questions: questions ?? [] };
}

export async function saveQuizAnswer(payload: {
  quiz_id: string;
  question_id: string;
  user_id: string;
  user_answer: string;
  is_correct: boolean;
}): Promise<void> {
  await supabase.from('quiz_answers').insert(payload);
}

export async function finalizeQuiz(
  quizId: string,
  correctAnswers: number,
): Promise<'passed' | 'failed'> {
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('total_questions, pass_score')
    .eq('id', quizId)
    .single();
  if (!quiz) throw new Error('Quiz not found');
  const score = Math.round((correctAnswers / quiz.total_questions) * 100);
  const status = score >= quiz.pass_score ? 'passed' : 'failed';
  await supabase
    .from('quizzes')
    .update({ status, correct_answers: correctAnswers })
    .eq('id', quizId);
  return status;
}

// ── CO-OP ─────────────────────────────────────────────────────

export async function createCoopRoom(
  userId: string,
  durationSeconds: number,
  joinCode: string,
): Promise<CoopRoom | null> {
  const { data, error } = await supabase
    .from('coop_rooms')
    .insert({ created_by: userId, join_code: joinCode, duration_seconds: durationSeconds })
    .select()
    .single();
  if (error) throw error;
  // Creator is automatically first member
  await supabase.from('coop_room_members').insert({ room_id: data.id, user_id: userId });
  return data;
}

export async function joinCoopRoom(
  joinCode: string,
  userId: string,
): Promise<CoopRoom | null> {
  const { data: room } = await supabase
    .from('coop_rooms')
    .select('*')
    .eq('join_code', joinCode.toUpperCase())
    .eq('status', 'waiting')
    .single();
  if (!room) throw new Error('Room not found or already started');
  await supabase
    .from('coop_room_members')
    .insert({ room_id: room.id, user_id: userId });
  return room;
}

export async function getCoopRoom(roomId: string): Promise<CoopRoom | null> {
  const { data } = await supabase.from('coop_rooms').select('*').eq('id', roomId).single();
  return data;
}

export async function getCoopMembers(roomId: string): Promise<CoopRoomMember[]> {
  const { data } = await supabase
    .from('coop_room_members')
    .select('*, users(username, avatar_url)')
    .eq('room_id', roomId);
  return (data as CoopRoomMember[]) ?? [];
}

export async function updateCoopMemberStatus(
  roomId: string,
  userId: string,
  status: CoopRoomMember['status'],
): Promise<void> {
  await supabase
    .from('coop_room_members')
    .update({ status })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

export async function startCoopRoom(roomId: string): Promise<void> {
  await supabase
    .from('coop_rooms')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', roomId);
}

export async function completeCoopRoom(roomId: string): Promise<void> {
  await supabase
    .from('coop_rooms')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', roomId);
}

// ── STREAKS ──────────────────────────────────────────────────

export async function getStreaks(userId: string, days = 30): Promise<Streak[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .gte('study_date', since.toISOString().split('T')[0])
    .order('study_date', { ascending: false });
  return data ?? [];
}
