-- ============================================================
-- StudyVerse – 004_fix_missing_columns.sql
-- Adds missing columns that are referenced in the app code
-- but were not included in the original schema.
-- Run this in Supabase SQL Editor → "Run"
-- ============================================================

-- Add chapter_ids array to study_sessions
-- (used by mission setup to know which chapters were selected)
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS chapter_ids UUID[] NOT NULL DEFAULT '{}';

-- Add reward_id to study_sessions
-- (links a session to the reward it generated)
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL;

-- Backfill: link existing rewards to their sessions
UPDATE public.study_sessions ss
SET reward_id = r.id
FROM public.rewards r
WHERE r.session_id = ss.id
  AND ss.reward_id IS NULL;

-- ============================================================
-- Verify the fix (optional — run separately to confirm)
-- ============================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'study_sessions'
-- ORDER BY ordinal_position;
