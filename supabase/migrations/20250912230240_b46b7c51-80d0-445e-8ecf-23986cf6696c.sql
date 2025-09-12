-- Ensure users.auth_user_id is unique for FK references
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_auth_user_id_key'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
END $$;

-- Fix foreign key on enrollments.enrolled_by to reference users.auth_user_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'enrollments_enrolled_by_fkey'
  ) THEN
    ALTER TABLE public.enrollments
    DROP CONSTRAINT enrollments_enrolled_by_fkey;
  END IF;
END $$;

ALTER TABLE public.enrollments
ADD CONSTRAINT enrollments_enrolled_by_fkey
FOREIGN KEY (enrolled_by)
REFERENCES public.users (auth_user_id)
ON DELETE SET NULL;

-- Add grading fields to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS grade integer,
ADD COLUMN IF NOT EXISTS feedback text,
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS graded_by uuid,
ADD COLUMN IF NOT EXISTS graded_at timestamptz;

-- Allow tutors/admins to update project grading
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Tutors/Admins can update project grading'
  ) THEN
    CREATE POLICY "Tutors/Admins can update project grading"
    ON public.projects
    FOR UPDATE
    USING (
      is_ultimate_tutor_or_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.course_tutors ct 
        WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
      )
    )
    WITH CHECK (
      is_ultimate_tutor_or_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.course_tutors ct 
        WHERE ct.course_id = projects.course_id AND ct.tutor_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Trigger to stamp graded_by and graded_at when grading changes
CREATE OR REPLACE FUNCTION public.set_project_grading_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.grade IS DISTINCT FROM OLD.grade OR NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    NEW.graded_at := now();
    NEW.graded_by := auth.uid();
    IF NEW.review_status IS NULL THEN
      NEW.review_status := 'graded';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_project_grading_fields ON public.projects;
CREATE TRIGGER trg_set_project_grading_fields
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_grading_fields();