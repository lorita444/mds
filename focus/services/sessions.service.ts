import {
  createStudySession,
  completeSession,
  abandonSession,
  getRecentSessions,
  getReward,
  placeWager,
} from '../lib/db';
import type { StudySession, Reward } from '../lib/types';

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

function err(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function startSession(payload: {
  user_id: string;
  session_type: 'casual' | 'mission';
  planned_seconds: number;
  subject_id?: string;
  chapter_ids?: string[];
}): Promise<ServiceResult<StudySession>> {
  try {
    const data = await createStudySession(payload);
    if (!data) return { data: null, error: 'Failed to start session' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to start session') };
  }
}

export async function finishSession(
  sessionId: string,
  durationSeconds: number,
  quizPassed = false,
  coopBonus = false,
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    const data = await completeSession(sessionId, durationSeconds, quizPassed, coopBonus);
    return { data: data ?? {}, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to complete session') };
  }
}

export async function quitSession(
  sessionId: string,
  durationSeconds: number,
): Promise<ServiceResult<void>> {
  try {
    await abandonSession(sessionId, durationSeconds);
    return { data: undefined, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to abandon session') };
  }
}

export async function fetchRecentSessions(
  userId: string,
  limit = 20,
): Promise<ServiceResult<StudySession[]>> {
  try {
    return { data: await getRecentSessions(userId, limit), error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load sessions') };
  }
}

export async function fetchReward(rewardId: string): Promise<ServiceResult<Reward>> {
  try {
    const data = await getReward(rewardId);
    if (!data) return { data: null, error: 'Reward not found' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to load reward') };
  }
}

export async function wagerOnSession(payload: {
  session_id: string;
  user_id: string;
  wager_type: 'crystals' | 'universe_item';
  crystal_amount?: number;
  item_id?: string;
}): Promise<ServiceResult<string>> {
  try {
    const data = await placeWager(payload);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: err(e, 'Failed to place wager') };
  }
}
