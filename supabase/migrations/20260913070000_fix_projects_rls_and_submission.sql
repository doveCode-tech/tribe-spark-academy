-- Migration: Fix projects RLS policies and add secure submit_student_project RPC
-- Fixes: "new row violates row-level security policy for table projects"

-- 1. Ensure projects columns exist
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS code_content text,
ADD COLUMN IF NOT EXISTS editor_type text,
ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id);

CREATE INDEX IF NOT EXISTS idx_projects_student_id ON public.projects(student_id);
CREATE INDEX IF NOT EXISTS idx_projects_lesson_id ON public.projects(lesson_id);

-- 2. Drop existing restrictive student policies
DROP POLICY IF EXISTS "Allow student insert" ON public.projects;
DROP POLICY IF EXISTS "Student reads own projects" ON public.projects;
DROP POLICY IF EXISTS "Student updates own projects" ON public.projects;

-- 3. Create permissive RLS policies for students supporting both users.id and auth.uid()
CREATE POLICY "Allow student insert" ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR student_id IS NULL
  );

CREATE POLICY "Student reads own projects" ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_tutors ct 
      WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
    )
  );

CREATE POLICY "Student updates own projects" ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_tutors ct 
      WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.course_tutors ct 
      WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
    )
  );

-- 4. Secure RPC Function: submit_student_project
-- Runs with SECURITY DEFINER to safely upsert student project submissions bypassing RLS issues
CREATE OR REPLACE FUNCTION public.submit_student_project(
  _course_id uuid,
  _lesson_id uuid DEFAULT NULL,
  _title text DEFAULT 'Project Submission',
  _description text DEFAULT NULL,
  _code_content text DEFAULT NULL,
  _editor_type text DEFAULT NULL,
  _link text DEFAULT NULL,
  _file_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_db_id uuid;
  v_project_id uuid;
  v_existing_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve user primary key from public.users
  SELECT id INTO v_user_db_id
  FROM public.users
  WHERE auth_user_id = v_auth_id
  LIMIT 1;

  IF v_user_db_id IS NULL THEN
    -- Ensure user row exists in public.users
    INSERT INTO public.users (auth_user_id, email, name, role, approved)
    VALUES (
      v_auth_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_auth_id), ''),
      COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = v_auth_id), 'Student'),
      'student',
      true
    )
    RETURNING id INTO v_user_db_id;
  END IF;

  -- Check for existing project for this course, lesson and student
  SELECT id INTO v_existing_id
  FROM public.projects
  WHERE course_id = _course_id
    AND (
      (_lesson_id IS NOT NULL AND lesson_id = _lesson_id)
      OR (_lesson_id IS NULL AND lesson_id IS NULL)
    )
    AND (student_id = v_user_db_id OR student_id = v_auth_id)
  ORDER BY submitted_at DESC NULLS LAST
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.projects
    SET
      title = COALESCE(_title, title),
      description = COALESCE(_description, description),
      code_content = COALESCE(_code_content, code_content),
      editor_type = COALESCE(_editor_type, editor_type),
      link = COALESCE(_link, link),
      file_path = COALESCE(_file_path, file_path),
      review_status = 'submitted',
      submitted_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_project_id;
  ELSE
    -- Try inserting with v_user_db_id first (satisfies FK referencing public.users)
    BEGIN
      INSERT INTO public.projects (
        course_id,
        lesson_id,
        student_id,
        title,
        description,
        code_content,
        editor_type,
        link,
        file_path,
        review_status,
        submitted_at
      ) VALUES (
        _course_id,
        _lesson_id,
        v_user_db_id,
        _title,
        _description,
        _code_content,
        _editor_type,
        _link,
        _file_path,
        'submitted',
        now()
      )
      RETURNING id INTO v_project_id;
    EXCEPTION WHEN foreign_key_violation THEN
      -- Fallback to v_auth_id if FK references auth.users
      INSERT INTO public.projects (
        course_id,
        lesson_id,
        student_id,
        title,
        description,
        code_content,
        editor_type,
        link,
        file_path,
        review_status,
        submitted_at
      ) VALUES (
        _course_id,
        _lesson_id,
        v_auth_id,
        _title,
        _description,
        _code_content,
        _editor_type,
        _link,
        _file_path,
        'submitted',
        now()
      )
      RETURNING id INTO v_project_id;
    END;
  END IF;

  RETURN jsonb_build_object('id', v_project_id, 'status', 'submitted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_project TO authenticated;
