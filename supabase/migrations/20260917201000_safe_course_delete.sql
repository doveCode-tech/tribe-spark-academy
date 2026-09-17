ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_delete_or_archive_course(p_course_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_history boolean;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only administrators can remove courses';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.enrollments WHERE course_id = p_course_id
    UNION ALL SELECT 1 FROM public.quiz_attempts WHERE course_id = p_course_id
    UNION ALL SELECT 1 FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE l.course_id = p_course_id
    UNION ALL SELECT 1 FROM public.projects WHERE course_id = p_course_id
  ) INTO has_history;

  IF has_history THEN
    UPDATE public.courses SET archived_at = now() WHERE id = p_course_id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.courses WHERE id = p_course_id;
  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_or_archive_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_or_archive_course(uuid) TO authenticated;
