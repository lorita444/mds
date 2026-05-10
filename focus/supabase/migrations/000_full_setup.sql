-- ============================================================
-- StudyVerse â€“ 001_schema.sql
-- Run once in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- â”€â”€ ENUM TYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TYPE public.session_type      AS ENUM ('casual', 'mission');
CREATE TYPE public.item_type         AS ENUM ('planet','alien','rare_alien','alien_type','habitat','cosmic_structure','civilization','coop_element');
CREATE TYPE public.rarity_type       AS ENUM ('common','uncommon','rare','epic','legendary');
CREATE TYPE public.reward_type       AS ENUM ('crystals','alien','rare_alien','alien_type','planet','habitat','cosmic_structure','civilization','coop_element');
CREATE TYPE public.quiz_status       AS ENUM ('pending','in_progress','passed','failed');
CREATE TYPE public.question_type     AS ENUM ('multiple_choice','true_false','short_answer','concept');
CREATE TYPE public.coop_room_status  AS ENUM ('waiting','active','completed','abandoned');
CREATE TYPE public.coop_member_status AS ENUM ('joined','ready','active','completed','abandoned');
CREATE TYPE public.friendship_status AS ENUM ('pending','accepted','blocked');
CREATE TYPE public.difficulty_type   AS ENUM ('easy','medium','hard');
CREATE TYPE public.review_status_type AS ENUM ('new','known','needs_review');
CREATE TYPE public.wager_type        AS ENUM ('crystals','universe_item');
CREATE TYPE public.ai_role           AS ENUM ('user','assistant');

-- â”€â”€ TABLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users (mirrors auth.users; created by trigger on signup)
CREATE TABLE public.users (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT        NOT NULL,
  username              TEXT        NOT NULL UNIQUE,
  avatar_url            TEXT,
  crystal_balance       INTEGER     NOT NULL DEFAULT 50  CHECK (crystal_balance >= 0),
  streak_days           INTEGER     NOT NULL DEFAULT 0   CHECK (streak_days >= 0),
  longest_streak        INTEGER     NOT NULL DEFAULT 0,
  consistency_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (consistency_multiplier >= 1.00),
  total_study_seconds   INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subjects
CREATE TABLE public.subjects (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#7c3aed',
  emoji       TEXT        NOT NULL DEFAULT 'đź“š',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chapters
CREATE TABLE public.chapters (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id  UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  order_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materials (uploaded files)
CREATE TABLE public.materials (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id     UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id     UUID        REFERENCES public.chapters(id) ON DELETE SET NULL,
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  file_type      TEXT        NOT NULL,
  size_bytes     BIGINT      NOT NULL DEFAULT 0,
  summary        TEXT,
  is_summarized  BOOLEAN     NOT NULL DEFAULT false,
  embedding_done BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Material chunks (for RAG / vector search)
CREATE TABLE public.material_chunks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID        NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  subject_id  UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study sessions (base table for both casual and mission)
CREATE TABLE public.study_sessions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_type     session_type   NOT NULL DEFAULT 'casual',
  duration_seconds INTEGER        NOT NULL DEFAULT 0,
  planned_seconds  INTEGER        NOT NULL,
  completed        BOOLEAN        NOT NULL DEFAULT false,
  abandoned_at     TIMESTAMPTZ,
  subject_id       UUID           REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Mission sessions (extends study_sessions)
CREATE TABLE public.mission_sessions (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID        NOT NULL UNIQUE REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ai_estimated_seconds  INTEGER,
  selected_chapter_ids  UUID[]      NOT NULL DEFAULT '{}',
  quiz_enabled          BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quizzes
CREATE TABLE public.quizzes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID        NOT NULL UNIQUE REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status           quiz_status NOT NULL DEFAULT 'pending',
  total_questions  INTEGER     NOT NULL DEFAULT 0,
  correct_answers  INTEGER,
  pass_score       INTEGER     NOT NULL DEFAULT 80,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quiz questions
CREATE TABLE public.quiz_questions (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id       UUID          NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT          NOT NULL,
  question_type question_type NOT NULL DEFAULT 'multiple_choice',
  options       JSONB,        -- ["A","B","C","D"] for multiple choice
  correct_answer TEXT         NOT NULL,
  order_index   INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Quiz answers (user responses)
CREATE TABLE public.quiz_answers (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id     UUID        NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID        NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_answer TEXT        NOT NULL,
  is_correct  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quiz_id, question_id, user_id)
);

-- Universe items (owned by user)
CREATE TABLE public.user_universe_items (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type       item_type   NOT NULL,
  item_name       TEXT        NOT NULL,
  rarity          rarity_type NOT NULL DEFAULT 'common',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  placeholder_key TEXT        NOT NULL DEFAULT 'alien',
  position_x      DECIMAL,
  position_y      DECIMAL,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  earned_from     TEXT        NOT NULL DEFAULT 'signup',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rewards (history of what was granted)
CREATE TABLE public.rewards (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id       UUID        REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  reward_type      reward_type NOT NULL,
  crystal_amount   INTEGER,
  item_name        TEXT,
  universe_item_id UUID        REFERENCES public.user_universe_items(id) ON DELETE SET NULL,
  rarity           rarity_type NOT NULL DEFAULT 'common',
  consistency_bonus BOOLEAN    NOT NULL DEFAULT false,
  coop_bonus       BOOLEAN     NOT NULL DEFAULT false,
  quiz_bonus       BOOLEAN     NOT NULL DEFAULT false,
  description      TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wagers (crystal/item risk before mission)
CREATE TABLE public.wagers (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID        NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wager_type       wager_type  NOT NULL DEFAULT 'crystals',
  crystal_amount   INTEGER,
  universe_item_id UUID        REFERENCES public.user_universe_items(id) ON DELETE SET NULL,
  resolved         BOOLEAN     NOT NULL DEFAULT false,
  won              BOOLEAN,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Friendships
CREATE TABLE public.friendships (
  id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id  UUID              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status     friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK(user_id <> friend_id)
);

-- Co-op rooms
CREATE TABLE public.coop_rooms (
  id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by       UUID             NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  join_code        TEXT             NOT NULL UNIQUE,
  duration_seconds INTEGER          NOT NULL,
  status           coop_room_status NOT NULL DEFAULT 'waiting',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Co-op room members
CREATE TABLE public.coop_room_members (
  id        UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id   UUID               NOT NULL REFERENCES public.coop_rooms(id) ON DELETE CASCADE,
  user_id   UUID               NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status    coop_member_status NOT NULL DEFAULT 'joined',
  joined_at TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Flashcards
CREATE TABLE public.flashcards (
  id            UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID               NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  chapter_id    UUID               REFERENCES public.chapters(id) ON DELETE SET NULL,
  user_id       UUID               NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question      TEXT               NOT NULL,
  answer        TEXT               NOT NULL,
  difficulty    difficulty_type    NOT NULL DEFAULT 'medium',
  review_status review_status_type NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- AI chat messages (per subject)
CREATE TABLE public.ai_chat_messages (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       ai_role     NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily study streaks
CREATE TABLE public.streaks (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  study_date    DATE        NOT NULL,
  total_seconds INTEGER     NOT NULL DEFAULT 0,
  session_count INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, study_date)
);

-- â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX idx_subjects_user_id          ON public.subjects(user_id);
CREATE INDEX idx_chapters_subject_id       ON public.chapters(subject_id);
CREATE INDEX idx_materials_subject_id      ON public.materials(subject_id);
CREATE INDEX idx_materials_chapter_id      ON public.materials(chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX idx_material_chunks_subject   ON public.material_chunks(subject_id);
CREATE INDEX idx_material_chunks_material  ON public.material_chunks(material_id);
-- IVFFlat index for cosine similarity search (tune lists= based on row count)
CREATE INDEX idx_material_chunks_embedding ON public.material_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_sessions_user_id          ON public.study_sessions(user_id);
CREATE INDEX idx_sessions_subject_id       ON public.study_sessions(subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX idx_sessions_created          ON public.study_sessions(created_at DESC);
CREATE INDEX idx_quizzes_session_id        ON public.quizzes(session_id);
CREATE INDEX idx_quiz_questions_quiz_id    ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_answers_quiz_id      ON public.quiz_answers(quiz_id);
CREATE INDEX idx_universe_items_user_id    ON public.user_universe_items(user_id);
CREATE INDEX idx_universe_items_active     ON public.user_universe_items(user_id, is_active);
CREATE INDEX idx_rewards_user_id           ON public.rewards(user_id);
CREATE INDEX idx_rewards_session_id        ON public.rewards(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_wagers_session_id         ON public.wagers(session_id);
CREATE INDEX idx_coop_rooms_join_code      ON public.coop_rooms(join_code);
CREATE INDEX idx_coop_members_room_id      ON public.coop_room_members(room_id);
CREATE INDEX idx_coop_members_user_id      ON public.coop_room_members(user_id);
CREATE INDEX idx_flashcards_subject_id     ON public.flashcards(subject_id);
CREATE INDEX idx_flashcards_user_id        ON public.flashcards(user_id);
CREATE INDEX idx_chat_messages_subject_id  ON public.ai_chat_messages(subject_id);
CREATE INDEX idx_chat_messages_created     ON public.ai_chat_messages(subject_id, created_at ASC);
CREATE INDEX idx_streaks_user_date         ON public.streaks(user_id, study_date DESC);

-- ============================================================
-- StudyVerse â€“ 002_rls.sql
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

-- â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- â”€â”€ SUBJECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "subjects_all_own"
  ON public.subjects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ CHAPTERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ MATERIALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "materials_all_own"
  ON public.materials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ MATERIAL CHUNKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "material_chunks_all_own"
  ON public.material_chunks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ STUDY SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "sessions_all_own"
  ON public.study_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ MISSION SESSIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "mission_sessions_all_own"
  ON public.mission_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ QUIZZES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "quizzes_all_own"
  ON public.quizzes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ QUIZ QUESTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ QUIZ ANSWERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "quiz_answers_all_own"
  ON public.quiz_answers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ UNIVERSE ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "universe_items_all_own"
  ON public.user_universe_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ REWARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "rewards_all_own"
  ON public.rewards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ WAGERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "wagers_all_own"
  ON public.wagers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ FRIENDSHIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€ CO-OP ROOMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ CO-OP ROOM MEMBERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€ FLASHCARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "flashcards_all_own"
  ON public.flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ AI CHAT MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "chat_messages_all_own"
  ON public.ai_chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ STREAKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE POLICY "streaks_all_own"
  ON public.streaks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€ STORAGE BUCKETS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Run these in Supabase Dashboard > Storage > Policies
-- (or via supabase CLI)

-- INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false);

-- CREATE POLICY "materials_upload_own" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "materials_read_own" ON storage.objects FOR SELECT
--   USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "materials_delete_own" ON storage.objects FOR DELETE
--   USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- StudyVerse â€“ 003_functions.sql
-- Database functions, triggers, and business logic
-- ============================================================

-- â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Generate a random 6-character room code (uppercase letters + digits, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  chars  TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT    := '';
  i      INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Auto-assign unique join_code before inserting a coop room
CREATE OR REPLACE FUNCTION public.auto_set_coop_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_code  TEXT;
  v_clash BOOLEAN;
BEGIN
  IF NEW.join_code IS NOT NULL AND NEW.join_code <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    v_code := public.generate_join_code();
    SELECT EXISTS(SELECT 1 FROM public.coop_rooms WHERE join_code = v_code) INTO v_clash;
    EXIT WHEN NOT v_clash;
  END LOOP;
  NEW.join_code := v_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_coop_join_code
  BEFORE INSERT ON public.coop_rooms
  FOR EACH ROW
  WHEN (NEW.join_code IS NULL OR NEW.join_code = '')
  EXECUTE FUNCTION public.auto_set_coop_join_code();

-- â”€â”€ USER CREATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.create_starter_universe(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_universe_items
    (user_id, item_type, item_name, rarity, placeholder_key, earned_from)
  VALUES
    (p_user_id, 'planet', 'Starter Planet', 'common', 'planet_starter', 'signup'),
    (p_user_id, 'alien',  'Zorp',           'common', 'alien_basic',    'signup');
END;
$$;

-- Trigger: create public.users row + starter universe on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  -- Deduplicate username if needed
  IF EXISTS (SELECT 1 FROM public.users WHERE username = v_username) THEN
    v_username := v_username || '_' || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  END IF;

  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, v_username);

  PERFORM public.create_starter_universe(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- â”€â”€ STREAK & MULTIPLIER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.update_streak_and_multiplier(
  p_user_id        UUID,
  p_duration_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today      DATE    := CURRENT_DATE;
  v_streak     INTEGER;
  v_longest    INTEGER;
  v_multiplier DECIMAL(4,2);
BEGIN
  -- Upsert today's streak record
  INSERT INTO public.streaks (user_id, study_date, total_seconds, session_count)
  VALUES (p_user_id, v_today, p_duration_seconds, 1)
  ON CONFLICT (user_id, study_date)
  DO UPDATE SET
    total_seconds = streaks.total_seconds + EXCLUDED.total_seconds,
    session_count = streaks.session_count + 1;

  -- Calculate current consecutive-day streak using a simple recursive CTE
  WITH RECURSIVE cons AS (
    SELECT study_date, 1 AS n
    FROM public.streaks
    WHERE user_id = p_user_id AND study_date = v_today

    UNION ALL

    SELECT s.study_date, cons.n + 1
    FROM public.streaks s
    JOIN cons ON s.study_date = cons.study_date - INTERVAL '1 day'
    WHERE s.user_id = p_user_id
  )
  SELECT COALESCE(MAX(n), 1) INTO v_streak FROM cons;

  SELECT longest_streak INTO v_longest
  FROM public.users WHERE id = p_user_id;

  -- Multiplier: 1.0 base + 0.05 per streak day, capped at 3.0
  v_multiplier := LEAST(3.00, ROUND(1.00 + (v_streak * 0.05), 2));

  UPDATE public.users SET
    streak_days            = v_streak,
    longest_streak         = GREATEST(v_longest, v_streak),
    consistency_multiplier = v_multiplier,
    total_study_seconds    = total_study_seconds + p_duration_seconds
  WHERE id = p_user_id;
END;
$$;

-- â”€â”€ REWARD CALCULATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.grant_session_reward(
  p_session_id       UUID,
  p_duration_seconds INTEGER,
  p_user_id          UUID,
  p_quiz_passed      BOOLEAN DEFAULT false,
  p_coop_bonus       BOOLEAN DEFAULT false
)
RETURNS UUID        -- reward.id
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_multiplier      DECIMAL(4,2);
  v_reward_type     public.reward_type;
  v_crystal_amount  INTEGER;
  v_item_name       TEXT;
  v_rarity          public.rarity_type;
  v_description     TEXT;
  v_reward_id       UUID;
  v_item_id         UUID;
  v_cons_bonus      BOOLEAN := false;
  v_mins            INTEGER := p_duration_seconds / 60;
BEGIN
  SELECT consistency_multiplier INTO v_multiplier
  FROM public.users WHERE id = p_user_id;

  v_cons_bonus := v_multiplier >= 1.2;

  -- â”€â”€ Tier logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  IF p_duration_seconds < 1800 THEN                              -- < 30 min â†’ crystals
    v_reward_type    := 'crystals';
    v_crystal_amount := CEIL(v_mins * 2.0 * v_multiplier);
    v_rarity         := 'common';
    v_description    := FORMAT(
      'You earned %s crystals for a %s-minute session.',
      v_crystal_amount, v_mins);

  ELSIF p_duration_seconds < 3600 THEN                           -- 30â€“60 min â†’ more crystals
    v_reward_type    := 'crystals';
    v_crystal_amount := CEIL(v_mins * 3.5 * v_multiplier);
    v_rarity         := 'common';
    v_description    := FORMAT(
      'You earned %s crystals for a %s-minute session.',
      v_crystal_amount, v_mins);

  ELSIF p_duration_seconds < 7200 THEN                           -- 60â€“120 min â†’ crystals + chance of alien
    IF RANDOM() < 0.40 OR p_quiz_passed THEN
      v_reward_type := 'alien';
      v_item_name   := (ARRAY['Glimmer','Zyx','Blobkin','Flikko','Nudo'])[CEIL(RANDOM()*5)];
      v_rarity      := CASE WHEN p_quiz_passed THEN 'uncommon' ELSE 'common' END;
      v_description := FORMAT('You unlocked %s, a new alien companion!', v_item_name);
    ELSE
      v_reward_type    := 'crystals';
      v_crystal_amount := CEIL(v_mins * 5.0 * v_multiplier);
      v_rarity         := 'uncommon';
      v_description    := FORMAT(
        'You earned %s crystals for a focused %s-minute session.',
        v_crystal_amount, v_mins);
    END IF;

  ELSE                                                            -- 120+ min â†’ guaranteed physical
    IF p_quiz_passed AND p_coop_bonus THEN
      v_reward_type := 'cosmic_structure';
      v_item_name   := (ARRAY['Nebula Beacon','Star Gate','Void Monolith','Apex Spire'])[CEIL(RANDOM()*4)];
      v_rarity      := 'legendary';
    ELSIF p_quiz_passed THEN
      -- epic: rare_alien, planet, or habitat
      CASE FLOOR(RANDOM()*3)::INTEGER
        WHEN 0 THEN v_reward_type := 'rare_alien'; v_item_name := (ARRAY['Luminos','Vexor','Crystara','Orbitex'])[CEIL(RANDOM()*4)];
        WHEN 1 THEN v_reward_type := 'planet';     v_item_name := (ARRAY['Nebula Prime','Ice World','Lava Rock','Drift World'])[CEIL(RANDOM()*4)];
        ELSE        v_reward_type := 'habitat';    v_item_name := (ARRAY['Crystal Cave','Nebula Nest','Void Den','Spark Dome'])[CEIL(RANDOM()*4)];
      END CASE;
      v_rarity := 'epic';
    ELSIF p_coop_bonus THEN
      v_reward_type := 'coop_element';
      v_item_name   := (ARRAY['Sync Station','Unity Beacon','Bond Crystal','Orbit Link'])[CEIL(RANDOM()*4)];
      v_rarity      := 'rare';
    ELSE
      IF RANDOM() < 0.5 THEN
        v_reward_type := 'alien';
        v_item_name   := (ARRAY['Moonling','Dustmite','Starshell','Quarklet'])[CEIL(RANDOM()*4)];
      ELSE
        v_reward_type := 'habitat';
        v_item_name   := (ARRAY['Glow Cave','Spark Dome','Dust Hive','Moon Burrow'])[CEIL(RANDOM()*4)];
      END IF;
      v_rarity := CASE WHEN v_multiplier >= 1.5 THEN 'rare' ELSE 'uncommon' END;
    END IF;
    v_description := FORMAT(
      'You unlocked %s after completing a %.1f-hour session!',
      v_item_name, p_duration_seconds / 3600.0);
  END IF;

  -- Co-op crystal bonus
  IF p_coop_bonus AND v_reward_type = 'crystals' THEN
    v_crystal_amount := CEIL(v_crystal_amount * 1.5);
  END IF;

  -- â”€â”€ Create universe item if not crystals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  IF v_reward_type <> 'crystals' THEN
    INSERT INTO public.user_universe_items
      (user_id, item_type, item_name, rarity, placeholder_key, earned_at, earned_from)
    VALUES
      (p_user_id, v_reward_type::public.item_type, v_item_name, v_rarity,
       v_reward_type::TEXT, NOW(), p_session_id::TEXT)
    RETURNING id INTO v_item_id;
  END IF;

  -- â”€â”€ Insert reward record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.rewards
    (user_id, session_id, reward_type, crystal_amount, item_name,
     universe_item_id, rarity, consistency_bonus, coop_bonus, quiz_bonus, description)
  VALUES
    (p_user_id, p_session_id, v_reward_type, v_crystal_amount, v_item_name,
     v_item_id, v_rarity, v_cons_bonus, p_coop_bonus, p_quiz_passed, v_description)
  RETURNING id INTO v_reward_id;

  -- â”€â”€ Apply reward to user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  IF v_reward_type = 'crystals' THEN
    UPDATE public.users
    SET crystal_balance = crystal_balance + v_crystal_amount
    WHERE id = p_user_id;
  END IF;

  RETURN v_reward_id;
END;
$$;

-- â”€â”€ COMPLETE SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_session_id       UUID,
  p_duration_seconds INTEGER,
  p_quiz_passed      BOOLEAN DEFAULT false,
  p_coop_bonus       BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   UUID;
  v_reward_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.study_sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  -- Mark session complete
  UPDATE public.study_sessions SET
    completed        = true,
    duration_seconds = p_duration_seconds,
    abandoned_at     = NULL
  WHERE id = p_session_id;

  -- Update streak + multiplier + total time
  PERFORM public.update_streak_and_multiplier(v_user_id, p_duration_seconds);

  -- Grant reward
  v_reward_id := public.grant_session_reward(
    p_session_id, p_duration_seconds, v_user_id, p_quiz_passed, p_coop_bonus
  );

  RETURN (
    SELECT ROW_TO_JSON(r) FROM (
      SELECT
        rw.id            AS reward_id,
        rw.reward_type,
        rw.crystal_amount,
        rw.item_name,
        rw.rarity::TEXT,
        rw.consistency_bonus,
        rw.coop_bonus,
        rw.quiz_bonus,
        rw.description,
        rw.universe_item_id,
        u.streak_days,
        u.consistency_multiplier,
        u.crystal_balance
      FROM public.rewards rw
      JOIN public.users   u  ON u.id = rw.user_id
      WHERE rw.id = v_reward_id
    ) r
  );
END;
$$;

-- â”€â”€ ABANDON SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.abandon_study_session(
  p_session_id       UUID,
  p_duration_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id       UUID;
  v_planned       INTEGER;
  v_completion    DECIMAL;
BEGIN
  SELECT user_id, planned_seconds INTO v_user_id, v_planned
  FROM public.study_sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  v_completion := p_duration_seconds::DECIMAL / GREATEST(v_planned, 1);

  UPDATE public.study_sessions SET
    abandoned_at     = NOW(),
    duration_seconds = p_duration_seconds,
    completed        = false
  WHERE id = p_session_id;

  -- Count partial time toward total (only if > 10% done)
  IF v_completion > 0.10 THEN
    UPDATE public.users
    SET total_study_seconds = total_study_seconds + p_duration_seconds
    WHERE id = v_user_id;
  END IF;

  -- Forfeit any pending wager
  UPDATE public.wagers
  SET resolved = true, won = false
  WHERE session_id = p_session_id AND resolved = false;

  -- Penalty: if > 50% done, deactivate one random common alien or habitat
  IF v_completion > 0.50 THEN
    UPDATE public.user_universe_items
    SET is_active = false
    WHERE id = (
      SELECT id FROM public.user_universe_items
      WHERE user_id = v_user_id
        AND is_active = true
        AND rarity = 'common'
        AND item_type IN ('alien', 'habitat')
      ORDER BY RANDOM()
      LIMIT 1
    );
  END IF;
END;
$$;

-- â”€â”€ PLACE WAGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.place_wager(
  p_session_id     UUID,
  p_user_id        UUID,
  p_wager_type     public.wager_type,
  p_crystal_amount INTEGER  DEFAULT NULL,
  p_item_id        UUID     DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wager_id UUID;
BEGIN
  -- Validate crystals
  IF p_wager_type = 'crystals' THEN
    IF p_crystal_amount IS NULL OR p_crystal_amount <= 0 THEN
      RAISE EXCEPTION 'crystal_amount must be positive for crystal wager';
    END IF;
    IF (SELECT crystal_balance FROM public.users WHERE id = p_user_id) < p_crystal_amount THEN
      RAISE EXCEPTION 'Insufficient crystals';
    END IF;
    -- Deduct crystals immediately (held in escrow)
    UPDATE public.users SET crystal_balance = crystal_balance - p_crystal_amount
    WHERE id = p_user_id;
  END IF;

  -- Validate item wager
  IF p_wager_type = 'universe_item' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_universe_items
      WHERE id = p_item_id AND user_id = p_user_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Item not found or not owned';
    END IF;
    -- Lock item
    UPDATE public.user_universe_items SET is_active = false
    WHERE id = p_item_id;
  END IF;

  INSERT INTO public.wagers
    (session_id, user_id, wager_type, crystal_amount, universe_item_id)
  VALUES
    (p_session_id, p_user_id, p_wager_type, p_crystal_amount, p_item_id)
  RETURNING id INTO v_wager_id;

  RETURN v_wager_id;
END;
$$;

-- â”€â”€ RESOLVE WAGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.resolve_wager(
  p_wager_id UUID,
  p_won      BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wager public.wagers%ROWTYPE;
BEGIN
  SELECT * INTO v_wager FROM public.wagers WHERE id = p_wager_id;

  IF v_wager.resolved THEN RETURN; END IF;

  UPDATE public.wagers SET resolved = true, won = p_won WHERE id = p_wager_id;

  IF p_won THEN
    -- Return escrowed crystals / reactivate item
    IF v_wager.wager_type = 'crystals' THEN
      UPDATE public.users
      SET crystal_balance = crystal_balance + v_wager.crystal_amount
      WHERE id = v_wager.user_id;
    ELSE
      UPDATE public.user_universe_items SET is_active = true
      WHERE id = v_wager.universe_item_id;
    END IF;
  END IF;
  -- If lost: crystals already deducted; item remains inactive (destroyed)
END;
$$;

-- â”€â”€ VECTOR SEARCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Matches the top k chunks for a query embedding within a user's subject
CREATE OR REPLACE FUNCTION public.match_material_chunks(
  p_query_embedding vector(1536),
  p_subject_id      UUID,
  p_user_id         UUID,
  p_match_count     INTEGER DEFAULT 5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.content,
    1 - (mc.embedding <=> p_query_embedding) AS similarity
  FROM public.material_chunks mc
  WHERE mc.subject_id = p_subject_id
    AND mc.user_id    = p_user_id
    AND mc.embedding  IS NOT NULL
  ORDER BY mc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- FIX: add missing columns to study_sessions
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS chapter_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL;
