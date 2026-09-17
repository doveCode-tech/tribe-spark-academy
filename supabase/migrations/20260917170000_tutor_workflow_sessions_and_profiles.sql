-- Migration: Tutor Workflow, Class Sessions, Session Reports, Qualifications and Profiles
-- Date: 2026-09-17

-- 1. Enhance users table with subscription_type and age
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS age INTEGER;

-- 2. Enhance projects table with submission_history, activity_id, assigned_tutor_id, and resubmission_requested
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS submission_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS activity_id TEXT,
ADD COLUMN IF NOT EXISTS assigned_tutor_id UUID,
ADD COLUMN IF NOT EXISTS resubmission_requested BOOLEAN DEFAULT false;

-- 3. Create tutor_qualifications table
CREATE TABLE IF NOT EXISTS public.tutor_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  qualified_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'course_completion',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tutor_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_qualifications_tutor ON public.tutor_qualifications(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_qualifications_course ON public.tutor_qualifications(course_id);

ALTER TABLE public.tutor_qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public or authenticated view qualifications" ON public.tutor_qualifications;
CREATE POLICY "Public or authenticated view qualifications"
ON public.tutor_qualifications FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admin and Ultimate Tutor manage qualifications" ON public.tutor_qualifications;
CREATE POLICY "Admin and Ultimate Tutor manage qualifications"
ON public.tutor_qualifications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

-- 4. Create class_sessions table
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tutor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_group TEXT DEFAULT '1-on-1 PT',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- 'available', 'assigned', 'ongoing', 'paused', 'suspended', 'ended', 'cancelled'
  meeting_provider TEXT NOT NULL DEFAULT 'Zoom', -- 'Zoom', 'Google Meet', 'Microsoft Teams', 'Custom'
  meeting_link TEXT NOT NULL DEFAULT '',
  meeting_id TEXT DEFAULT '',
  passcode TEXT DEFAULT '',
  host_key TEXT DEFAULT '',
  claimed_at TIMESTAMPTZ,
  terms_accepted_version TEXT,
  reminder_sent_at TIMESTAMPTZ,
  reminder_sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actual_ended_at TIMESTAMPTZ,
  session_report_id UUID,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_tutor ON public.class_sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_student ON public.class_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_course ON public.class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON public.class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_start_time ON public.class_sessions(start_time);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant sessions" ON public.class_sessions;
CREATE POLICY "Users can view relevant sessions"
ON public.class_sessions FOR SELECT
USING (
  status = 'available'
  OR tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Tutors can update assigned or claim available sessions" ON public.class_sessions;
CREATE POLICY "Tutors can update assigned or claim available sessions"
ON public.class_sessions FOR UPDATE
USING (
  status = 'available'
  OR tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Admins can manage class sessions" ON public.class_sessions;
CREATE POLICY "Admins can manage class sessions"
ON public.class_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

-- 5. Create session_reports table
CREATE TABLE IF NOT EXISTS public.session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  attendance_status TEXT NOT NULL DEFAULT 'attended', -- 'attended', 'late', 'absent', 'excused'
  topics_covered TEXT NOT NULL,
  student_performance INTEGER DEFAULT 5, -- 1 to 5
  homework_assigned TEXT DEFAULT '',
  notes_for_parents TEXT DEFAULT '',
  internal_notes TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_reports_session ON public.session_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_tutor ON public.session_reports(tutor_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_student ON public.session_reports(student_id);

ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant session reports" ON public.session_reports;
CREATE POLICY "Users can view relevant session reports"
ON public.session_reports FOR SELECT
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Tutors can insert session reports" ON public.session_reports;
CREATE POLICY "Tutors can insert session reports"
ON public.session_reports FOR INSERT
WITH CHECK (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Tutors and admins can update session reports" ON public.session_reports;
CREATE POLICY "Tutors and admins can update session reports"
ON public.session_reports FOR UPDATE
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

-- 6. Create tutor_penalties table
CREATE TABLE IF NOT EXISTS public.tutor_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
  penalty_type TEXT NOT NULL, -- 'warning', 'payment_adjustment', 'payment_forfeiture', 'suspension', 'other'
  reason TEXT NOT NULL,
  amount_adjusted NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'resolved', 'waived'
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tutor_penalties_tutor ON public.tutor_penalties(tutor_id);

ALTER TABLE public.tutor_penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can view their own penalties" ON public.tutor_penalties;
CREATE POLICY "Tutors can view their own penalties"
ON public.tutor_penalties FOR SELECT
USING (
  tutor_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

DROP POLICY IF EXISTS "Admins can manage penalties" ON public.tutor_penalties;
CREATE POLICY "Admins can manage penalties"
ON public.tutor_penalties FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
      AND role IN ('admin', 'ultimate_tutor')
  )
);

-- 7. Atomic Claim Session RPC function with concurrency lock
CREATE OR REPLACE FUNCTION public.claim_class_session(
  _session_id UUID,
  _tutor_id UUID,
  _terms_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_session RECORD;
  v_is_qualified BOOLEAN := false;
  v_tutor_db_id UUID;
BEGIN
  -- Resolve tutor database UUID
  SELECT id INTO v_tutor_db_id
  FROM public.users
  WHERE id = _tutor_id OR auth_user_id = _tutor_id
  LIMIT 1;

  IF v_tutor_db_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tutor not found.');
  END IF;

  -- Lock session row for update to prevent concurrent race condition
  SELECT * INTO v_session
  FROM public.class_sessions
  WHERE id = _session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session does not exist.');
  END IF;

  IF v_session.status != 'available' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This session has already been claimed or is no longer available.');
  END IF;

  -- Verify tutor qualification for this course
  SELECT EXISTS (
    SELECT 1 FROM public.tutor_qualifications
    WHERE tutor_id = v_tutor_db_id AND course_id = v_session.course_id
  ) OR EXISTS (
    SELECT 1 FROM public.course_tutors
    WHERE tutor_id = v_tutor_db_id AND course_id = v_session.course_id
  ) OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_tutor_db_id AND role IN ('admin', 'ultimate_tutor')
  ) INTO v_is_qualified;

  IF NOT v_is_qualified THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not qualified to teach this course.');
  END IF;

  -- Update session to assigned
  UPDATE public.class_sessions
  SET tutor_id = v_tutor_db_id,
      status = 'assigned',
      claimed_at = now(),
      terms_accepted_version = _terms_version
  WHERE id = _session_id;

  -- Log action
  INSERT INTO public.audit_logs (
    action_type,
    performed_by,
    target_type,
    target_id,
    details,
    status
  ) VALUES (
    'claim_class_session',
    v_tutor_db_id::text,
    'class_session',
    _session_id::text,
    jsonb_build_object(
      'terms_version', _terms_version,
      'claimed_at', now()
    ),
    'success'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Session successfully claimed!',
    'session_id', _session_id
  );
END;
$$;
