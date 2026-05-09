-- ============================================================
-- StudyVerse – 002_rls.sql
-- Row Level Security policies for all tables
-- ============================================================

-- Enable RLS on every table
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_universe_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wagers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coop_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coop_room_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks              ENABLE ROW LEVEL SECURITY;

-- ── USERS ────────────────────────────────────────────────────

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── SUBJECTS ─────────────────────────────────────────────────

CREATE POLICY "subjects_all_own"
  ON public.subjects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── CHAPTERS ─────────────────────────────────────────────────
-- Users can only manage chapters belonging to their own subjects

CREATE POLICY "chapters_all_own"
  ON public.chapters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_id AND s.user_id = auth.uid()
    )
  );

-- ── MATERIALS ────────────────────────────────────────────────

CREATE POLICY "materials_all_own"
  ON public.materials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── MATERIAL CHUNKS ──────────────────────────────────────────

CREATE POLICY "material_chunks_all_own"
  ON public.material_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── STUDY SESSIONS ───────────────────────────────────────────

CREATE POLICY "sessions_all_own"
  ON public.study_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── MISSION SESSIONS ─────────────────────────────────────────

CREATE POLICY "mission_sessions_all_own"
  ON public.mission_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── QUIZZES ──────────────────────────────────────────────────

CREATE POLICY "quizzes_all_own"
  ON public.quizzes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── QUIZ QUESTIONS ───────────────────────────────────────────
-- Accessible if user owns the quiz

CREATE POLICY "quiz_questions_all_own"
  ON public.quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.user_id = auth.uid()
    )
  );

-- ── QUIZ ANSWERS ─────────────────────────────────────────────

CREATE POLICY "quiz_answers_all_own"
  ON public.quiz_answers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── UNIVERSE ITEMS ───────────────────────────────────────────

CREATE POLICY "universe_items_all_own"
  ON public.user_universe_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── REWARDS ──────────────────────────────────────────────────

CREATE POLICY "rewards_all_own"
  ON public.rewards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── WAGERS ───────────────────────────────────────────────────

CREATE POLICY "wagers_all_own"
  ON public.wagers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── FRIENDSHIPS ──────────────────────────────────────────────

CREATE POLICY "friendships_select"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friendships_insert"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friendships_update"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friendships_delete"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id);

-- ── CO-OP ROOMS ──────────────────────────────────────────────
-- Creator can do everything; members can read the room they joined

CREATE POLICY "coop_rooms_select"
  ON public.coop_rooms FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.coop_room_members m
      WHERE m.room_id = id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "coop_rooms_insert"
  ON public.coop_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "coop_rooms_update"
  ON public.coop_rooms FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "coop_rooms_delete"
  ON public.coop_rooms FOR DELETE
  USING (auth.uid() = created_by);

-- ── CO-OP ROOM MEMBERS ───────────────────────────────────────
-- Members see other members in the same room; insert own row

CREATE POLICY "coop_members_select"
  ON public.coop_room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coop_room_members self
      WHERE self.room_id = room_id AND self.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.coop_rooms r
      WHERE r.id = room_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "coop_members_insert"
  ON public.coop_room_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coop_members_update_own"
  ON public.coop_room_members FOR UPDATE
  USING (auth.uid() = user_id);

-- ── FLASHCARDS ───────────────────────────────────────────────

CREATE POLICY "flashcards_all_own"
  ON public.flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── AI CHAT MESSAGES ─────────────────────────────────────────

CREATE POLICY "chat_messages_all_own"
  ON public.ai_chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── STREAKS ──────────────────────────────────────────────────

CREATE POLICY "streaks_all_own"
  ON public.streaks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── STORAGE BUCKETS ──────────────────────────────────────────
-- Run these in Supabase Dashboard > Storage > Policies
-- (or via supabase CLI)

-- INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false);

-- CREATE POLICY "materials_upload_own" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "materials_read_own" ON storage.objects FOR SELECT
--   USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "materials_delete_own" ON storage.objects FOR DELETE
--   USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
