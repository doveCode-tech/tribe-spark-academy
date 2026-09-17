CREATE TABLE IF NOT EXISTS public.quiz_attempt_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  extra_attempts integer NOT NULL DEFAULT 0 CHECK (extra_attempts >= 0),
  authorized_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

ALTER TABLE public.quiz_attempt_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own quiz attempt extensions"
ON public.quiz_attempt_extensions FOR SELECT TO authenticated
USING (student_id = auth.uid() OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Staff manage quiz attempt extensions"
ON public.quiz_attempt_extensions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role IN ('admin', 'ultimate_tutor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role IN ('admin', 'ultimate_tutor')));
