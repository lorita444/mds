/**
 * Typed database service layer.
 * Re-routed to noul REST API connected to the local MySQL database.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './supabase';
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

// Centralized fetch helper for backend API
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP error: ${response.statusText}`);
  }

  return response.json();
}

// ── USERS ────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    return await apiFetch(`/users/profile/${userId}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'username' | 'avatar_url'>>,
): Promise<void> {
  await apiFetch(`/users/profile/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function resetStudyProgress(): Promise<void> {
  await apiFetch('/users/profile/reset', {
    method: 'POST',
  });
}

export async function deleteUserAccount(): Promise<void> {
  await apiFetch('/users/profile', {
    method: 'DELETE',
  });
}

// ── SUBJECTS ─────────────────────────────────────────────────

export async function getSubjects(userId: string): Promise<Subject[]> {
  try {
    return await apiFetch(`/subjects?userId=${userId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getSubject(id: string): Promise<Subject | null> {
  try {
    return await apiFetch(`/subjects/${id}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function createSubject(
  userId: string,
  name: string,
  description?: string,
  color?: string,
  emoji?: string,
): Promise<Subject | null> {
  return await apiFetch('/subjects', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, name, description, color, emoji }),
  });
}

export async function updateSubject(
  id: string,
  updates: Partial<Pick<Subject, 'name' | 'description' | 'color' | 'emoji'>>,
): Promise<void> {
  await apiFetch(`/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteSubject(id: string): Promise<void> {
  await apiFetch(`/subjects/${id}`, {
    method: 'DELETE',
  });
}

// ── CHAPTERS ─────────────────────────────────────────────────

export async function getChapters(subjectId: string): Promise<Chapter[]> {
  try {
    return await apiFetch(`/chapters?subjectId=${subjectId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createChapter(
  subjectId: string,
  name: string,
  description?: string,
  orderIndex?: number,
): Promise<Chapter | null> {
  return await apiFetch('/chapters', {
    method: 'POST',
    body: JSON.stringify({ subject_id: subjectId, name, description, order_index: orderIndex }),
  });
}

export async function updateChapter(
  id: string,
  updates: Partial<Pick<Chapter, 'name' | 'description' | 'order_index'>>,
): Promise<void> {
  await apiFetch(`/chapters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteChapter(id: string): Promise<void> {
  await apiFetch(`/chapters/${id}`, {
    method: 'DELETE',
  });
}

// ── MATERIALS ────────────────────────────────────────────────

export async function getMaterials(subjectId: string): Promise<Material[]> {
  try {
    return await apiFetch(`/materials?subjectId=${subjectId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getAllUserMaterials(userId: string): Promise<Material[]> {
  try {
    return await apiFetch(`/materials?userId=${userId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getMaterialsByChapter(chapterId: string): Promise<Material[]> {
  try {
    return await apiFetch(`/materials?chapterId=${chapterId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
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
  return await apiFetch('/materials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMaterialSummary(id: string, summary: string): Promise<void> {
  await apiFetch(`/materials/${id}/summary`, {
    method: 'PUT',
    body: JSON.stringify({ summary }),
  });
}

export async function markMaterialEmbedded(id: string): Promise<void> {
  await apiFetch(`/materials/${id}/embedded`, {
    method: 'PUT',
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  await apiFetch(`/materials/${id}`, {
    method: 'DELETE',
  });
}

// ── STORAGE (mocked locally) ─────────────────────────────────

export async function uploadMaterial(
  userId: string,
  subjectId: string,
  fileName: string,
  fileBlob: Blob,
  mimeType: string,
): Promise<string> {
  // Returns a simulated local path or file URL.
  // In Expo local mode, files can reside in local state or app assets.
  const randomId = Math.random().toString(36).substring(7);
  return `file://local_documents/${userId}/${subjectId}/${randomId}_${fileName}`;
}

export async function deleteMaterialFile(fileUrl: string): Promise<void> {
  // Mock delete local file. No cloud operations needed.
  console.log(`Mock deleted local material file: ${fileUrl}`);
}

// ── STUDY SESSIONS ───────────────────────────────────────────

export async function createStudySession(payload: {
  user_id: string;
  session_type: 'casual' | 'mission';
  planned_seconds: number;
  subject_id?: string;
  chapter_ids?: string[];
  quiz_enabled?: boolean;
}): Promise<StudySession | null> {
  return await apiFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getRecentSessions(
  userId: string,
  limit = 20,
): Promise<StudySession[]> {
  try {
    return await apiFetch(`/sessions/recent?userId=${userId}&limit=${limit}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getStudySession(id: string): Promise<(StudySession & { subject_name?: string }) | null> {
  try {
    return await apiFetch(`/sessions/${id}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function completeSession(
  sessionId: string,
  durationSeconds: number,
  quizPassed = false,
  coopBonus = false,
): Promise<Record<string, unknown> | null> {
  return await apiFetch(`/sessions/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ durationSeconds, quizPassed, coopBonus }),
  });
}

export async function abandonSession(
  sessionId: string,
  durationSeconds: number,
): Promise<void> {
  await apiFetch(`/sessions/${sessionId}/abandon`, {
    method: 'POST',
    body: JSON.stringify({ durationSeconds }),
  });
}

// ── WAGERS ───────────────────────────────────────────────────

export async function placeWager(payload: {
  session_id: string;
  user_id: string;
  wager_type: 'crystals' | 'universe_item';
  crystal_amount?: number;
  item_id?: string;
}): Promise<string> {
  return await apiFetch('/wagers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── UNIVERSE ITEMS ───────────────────────────────────────────

export async function getUniverseItems(userId: string): Promise<UniverseItem[]> {
  try {
    return await apiFetch(`/universe-items?userId=${userId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getActiveUniverseItems(userId: string): Promise<UniverseItem[]> {
  try {
    return await apiFetch(`/universe-items?userId=${userId}&activeOnly=true`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ── REWARDS ──────────────────────────────────────────────────

export async function getReward(rewardId: string): Promise<Reward | null> {
  try {
    return await apiFetch(`/rewards/${rewardId}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getRewardHistory(userId: string, limit = 30): Promise<Reward[]> {
  try {
    return await apiFetch(`/rewards?userId=${userId}&limit=${limit}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ── FLASHCARDS ───────────────────────────────────────────────

export async function getFlashcards(
  subjectId: string,
  chapterId?: string,
): Promise<Flashcard[]> {
  try {
    const url = `/flashcards?subjectId=${subjectId}` + (chapterId ? `&chapterId=${chapterId}` : '');
    return await apiFetch(url);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createFlashcards(
  cards: Omit<Flashcard, 'id' | 'created_at'>[],
): Promise<Flashcard[]> {
  return await apiFetch('/flashcards', {
    method: 'POST',
    body: JSON.stringify(cards),
  });
}

export async function updateFlashcardStatus(
  id: string,
  status: 'new' | 'known' | 'needs_review',
): Promise<void> {
  await apiFetch(`/flashcards/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ review_status: status }),
  });
}

export async function deleteFlashcard(id: string): Promise<void> {
  await apiFetch(`/flashcards/${id}`, {
    method: 'DELETE',
  });
}

// ── AI CHAT ──────────────────────────────────────────────────

export async function getChatHistory(subjectId: string): Promise<AIChatMessage[]> {
  try {
    return await apiFetch(`/chat?subjectId=${subjectId}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function saveMessage(
  subjectId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<AIChatMessage | null> {
  return await apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ subject_id: subjectId, user_id: userId, role, content }),
  });
}

// ── QUIZZES ──────────────────────────────────────────────────

export async function createQuiz(
  sessionId: string,
  userId: string,
  totalQuestions: number,
): Promise<Quiz | null> {
  return await apiFetch('/quizzes', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: userId, total_questions: totalQuestions }),
  });
}

export async function getQuizWithQuestions(
  quizId: string,
): Promise<(Quiz & { questions: QuizQuestion[] }) | null> {
  try {
    return await apiFetch(`/quizzes/${quizId}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function saveQuizAnswer(payload: {
  quiz_id: string;
  question_id: string;
  user_id: string;
  user_answer: string;
  is_correct: boolean;
}): Promise<void> {
  await apiFetch('/quizzes/answers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function finalizeQuiz(
  quizId: string,
  correctAnswers: number,
): Promise<'passed' | 'failed'> {
  return await apiFetch(`/quizzes/${quizId}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ correctAnswers }),
  });
}

// ── CO-OP (Bază de date locală & API) ─────────────────────────

export async function createCoopRoom(
  userId: string,
  durationSeconds: number,
  joinCode: string,
): Promise<CoopRoom | null> {
  try {
    return await apiFetch('/coop/rooms', {
      method: 'POST',
      body: JSON.stringify({ durationSeconds, joinCode }),
    });
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function joinCoopRoom(
  joinCode: string,
  userId: string,
): Promise<CoopRoom | null> {
  try {
    return await apiFetch('/coop/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    });
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getCoopRoom(roomId: string): Promise<CoopRoom | null> {
  try {
    return await apiFetch(`/coop/rooms/${roomId}`);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getCoopMembers(roomId: string): Promise<CoopRoomMember[]> {
  try {
    return await apiFetch(`/coop/rooms/${roomId}/members`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function updateCoopMemberStatus(
  roomId: string,
  userId: string,
  status: CoopRoomMember['status'],
): Promise<void> {
  try {
    await apiFetch(`/coop/rooms/${roomId}/members/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function startCoopRoom(roomId: string): Promise<void> {
  try {
    await apiFetch(`/coop/rooms/${roomId}/start`, {
      method: 'POST',
    });
  } catch (e) {
    console.error(e);
  }
}

export async function completeCoopRoom(roomId: string): Promise<void> {
  try {
    await apiFetch(`/coop/rooms/${roomId}/complete`, {
      method: 'POST',
    });
  } catch (e) {
    console.error(e);
  }
}

export async function addCoopMaterial(roomId: string, materialId: string): Promise<void> {
  try {
    await apiFetch(`/coop/rooms/${roomId}/materials`, {
      method: 'POST',
      body: JSON.stringify({ materialId }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getCoopMaterials(roomId: string): Promise<Material[]> {
  try {
    return await apiFetch(`/coop/rooms/${roomId}/materials`);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function kickCoopMember(roomId: string, userId: string): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });
}

export async function toggleCoopReady(roomId: string, ready: boolean): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/members/ready`, {
    method: 'POST',
    body: JSON.stringify({ ready }),
  });
}

export async function startCoopTimer(roomId: string): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/start-timer`, { method: 'POST', body: '{}' });
}

export async function pauseCoopTimer(roomId: string): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/pause`, { method: 'POST', body: '{}' });
}

export async function resumeCoopTimer(roomId: string): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/resume`, { method: 'POST', body: '{}' });
}

export async function abandonCoopSession(roomId: string): Promise<void> {
  await apiFetch(`/coop/rooms/${roomId}/abandon`, { method: 'POST', body: '{}' });
}


// ── STREAKS ──────────────────────────────────────────────────

export async function getStreaks(userId: string, days = 30): Promise<Streak[]> {
  try {
    return await apiFetch(`/streaks?userId=${userId}&days=${days}`);
  } catch (e) {
    console.error(e);
    return [];
  }
}
