-- 1) Course tutors mapping (allow multiple tutors per course)
CREATE TABLE IF NOT EXISTS public.course_tutors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL, -- stores auth.uid() of the tutor
  assigned_by uuid DEFAULT auth.uid(),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, tutor_id)
);

-- Enable RLS
ALTER TABLE public.course_tutors ENABLE ROW LEVEL SECURITY;

-- Policies: Admins manage everything, tutors can view their own assignments
DROP POLICY IF EXISTS "Admins can manage course_tutors" ON public.course_tutors;
CREATE POLICY "Admins can manage course_tutors"
ON public.course_tutors
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Tutors can view own course assignments" ON public.course_tutors;
CREATE POLICY "Tutors can view own course assignments"
ON public.course_tutors
FOR SELECT
USING (tutor_id = auth.uid());


-- 2) Code templates for coding courses (Python, Web Design)
CREATE TABLE IF NOT EXISTS public.code_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  language text NOT NULL,
  template text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, language)
);

-- Language guard (immutable check is fine)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'code_templates_language_check'
  ) THEN
    ALTER TABLE public.code_templates
      ADD CONSTRAINT code_templates_language_check
      CHECK (language IN ('python','html','css','javascript'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.code_templates ENABLE ROW LEVEL SECURITY;

-- Policies: Tutors/Admins can manage
DROP POLICY IF EXISTS "Tutors/Admins can manage code_templates" ON public.code_templates;
CREATE POLICY "Tutors/Admins can manage code_templates"
ON public.code_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('tutor','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('tutor','admin')
  )
);

-- Update updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'code_templates_set_updated_at'
  ) THEN
    CREATE TRIGGER code_templates_set_updated_at
    BEFORE UPDATE ON public.code_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 3) Allow admins to update/delete courses (currently only SELECT/INSERT exist)
DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
CREATE POLICY "Admins can update courses"
ON public.courses
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;
CREATE POLICY "Admins can delete courses"
ON public.courses
FOR DELETE
USING (public.is_admin(auth.uid()));