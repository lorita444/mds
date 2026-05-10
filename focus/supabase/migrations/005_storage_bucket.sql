-- ============================================================
-- StudyVerse – 005_storage_bucket.sql
-- Creates the 'materials' storage bucket and RLS policies.
--
-- IMPORTANT: Create the bucket manually first in Supabase Dashboard:
--   Storage → New Bucket → name: "materials" → Public: ON → Save
--
-- Then run this script in Supabase SQL Editor to add the policies.
-- ============================================================

-- Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "materials_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "materials_select_own" ON storage.objects;
DROP POLICY IF EXISTS "materials_delete_own" ON storage.objects;

-- Users can upload files to their own folder (path: userId/subjectId/filename)
CREATE POLICY "materials_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own files
CREATE POLICY "materials_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "materials_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
