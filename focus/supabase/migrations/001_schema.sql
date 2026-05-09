-- ============================================================
-- StudyVerse – 001_schema.sql
-- Run once in Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUM TYPES ───────────────────────────────────────────────

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

-- ── TABLES ──────────────────────────────────────────────────

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
  emoji       TEXT        NOT NULL DEFAULT '📚',
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
  embedding   vector(1536),
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

-- ── INDEXES ──────────────────────────────────────────────────

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
