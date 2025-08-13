-- Fixed idempotent migration

-- 1) Ensure unique pending enrollment request per student/course
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_pending_enrollment_request'
  ) THEN
    CREATE UNIQUE INDEX uniq_pending_enrollment_request
    ON public.enrollment_requests (student_id, course_id)
    WHERE (status = 'pending');
  END IF;
END $$;

-- 2) Ensure projects.file_path column exists
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS file_path text;

-- 3) Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-videos', 'lesson-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-submissions', 'project-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- 4) Storage policies (fixed column name)
-- Public read for lesson videos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read lesson videos'
  ) THEN
    CREATE POLICY "Public read lesson videos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'lesson-videos');
  END IF;
END $$;

-- Tutors/Admins can upload lesson videos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Tutors/Admins upload lesson videos'
  ) THEN
    CREATE POLICY "Tutors/Admins upload lesson videos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'lesson-videos'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.auth_user_id = auth.uid() AND users.role IN ('tutor','admin')
      )
    );
  END IF;
END $$;

-- Students can manage their own project files (path prefix = auth.uid())
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Students manage own project files'
  ) THEN
    CREATE POLICY "Students manage own project files"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'project-submissions' AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'project-submissions' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Tutors/Admins can view all project submissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Tutors/Admins can view project submissions'
  ) THEN
    CREATE POLICY "Tutors/Admins can view project submissions"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'project-submissions'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.auth_user_id = auth.uid() AND users.role IN ('tutor','admin')
      )
    );
  END IF;
END $$;