import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { getUniverseItems, getRecentSessions, getStreaks } from '../lib/db';
import type { UniverseItem, StudySession, Streak } from '../lib/types';

type HomeData = {
  planet: UniverseItem | null;
  recentSessions: StudySession[];
  todaySeconds: number;
  weekStreaks: Streak[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
};

export function useHomeData(): HomeData {
  const { user } = useAuth();
  const [planet, setPlanet] = useState<UniverseItem | null>(null);
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [weekStreaks, setWeekStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [items, sessions, streaks] = await Promise.all([
          getUniverseItems(user.id),
          getRecentSessions(user.id, 10),
          getStreaks(user.id, 7),
        ]);
        const mainPlanet = items.find((i) => i.item_type === 'planet') ?? null;
        setPlanet(mainPlanet);
        setRecentSessions(sessions);
        const today = new Date().toISOString().split('T')[0];
        const todayStreak = streaks.find((s) => s.study_date === today);
        setTodaySeconds(todayStreak?.total_seconds ?? 0);
        setWeekStreaks(streaks);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return {
    planet,
    recentSessions,
    todaySeconds,
    weekStreaks,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
  };
}
