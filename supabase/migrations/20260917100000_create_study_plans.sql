-- Migration: Create study_plans and study_goals tables for Dedicated Study Calendar
-- Enables student schedule planning, target session management, and study habit tracking

-- 1. Create study_plans table
CREATE TABLE IF NOT EXISTS public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'missed')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for fast lookup by student and date
CREATE INDEX IF NOT EXISTS idx_study_plans_student_date ON public.study_plans(student_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON public.study_plans(status);

-- 2. Create study_goals table
CREATE TABLE IF NOT EXISTS public.study_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  target_days_per_week INTEGER DEFAULT 4 CHECK (target_days_per_week BETWEEN 1 AND 7),
  target_minutes_per_day INTEGER DEFAULT 30 CHECK (target_minutes_per_day BETWEEN 10 AND 240),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_goals_student ON public.study_goals(student_id);

-- 3. Enable RLS
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;

-- 4. Policies for study_plans
DROP POLICY IF EXISTS "Students can view own study plans" ON public.study_plans;
CREATE POLICY "Students can view own study plans"
ON public.study_plans FOR SELECT
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'tutor', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Students can insert own study plans" ON public.study_plans;
CREATE POLICY "Students can insert own study plans"
ON public.study_plans FOR INSERT
WITH CHECK (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can update own study plans" ON public.study_plans;
CREATE POLICY "Students can update own study plans"
ON public.study_plans FOR UPDATE
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can delete own study plans" ON public.study_plans;
CREATE POLICY "Students can delete own study plans"
ON public.study_plans FOR DELETE
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- 5. Policies for study_goals
DROP POLICY IF EXISTS "Students can view own study goals" ON public.study_goals;
CREATE POLICY "Students can view own study goals"
ON public.study_goals FOR SELECT
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students can upsert own study goals" ON public.study_goals;
CREATE POLICY "Students can upsert own study goals"
ON public.study_goals FOR ALL
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);
