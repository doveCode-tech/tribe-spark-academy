-- Migration: Create learning activity and streak tracking system
-- Enables study streak tracking and learning calendar features

-- 1. Create learning_activity table to track daily learning activities
CREATE TABLE IF NOT EXISTS public.learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL, -- 'lesson_complete', 'quiz_complete', 'project_submit', etc.
  lesson_id UUID,
  course_id UUID,
  points_earned INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one activity record per student per date per type
  UNIQUE(student_id, activity_date, activity_type, lesson_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_activity_student_date ON public.learning_activity(student_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_learning_activity_course ON public.learning_activity(course_id);

-- 2. Create user_streaks table to track current streak information
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_learning_days INTEGER DEFAULT 0,
  streak_freezes_remaining INTEGER DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_student ON public.user_streaks(student_id);

-- 3. Enable RLS on both tables
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for learning_activity
CREATE POLICY "Students can read own learning activity"
ON public.learning_activity FOR SELECT
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'tutor', 'ultimate_tutor')
  )
);

CREATE POLICY "Students can insert own learning activity"
ON public.learning_activity FOR INSERT
WITH CHECK (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Students can update own learning activity"
ON public.learning_activity FOR UPDATE
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- 5. RLS policies for user_streaks
CREATE POLICY "Students can read own streaks"
ON public.user_streaks FOR SELECT
USING (
  student_id = auth.uid()
  OR student_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'tutor', 'ultimate_tutor')
  )
);

CREATE POLICY "System can update streaks"
ON public.user_streaks FOR ALL
USING (
  auth.uid() IS NOT NULL
);

-- 6. Create function to record learning activity and update streaks
CREATE OR REPLACE FUNCTION public.record_learning_activity(
  _activity_type TEXT,
  _lesson_id UUID DEFAULT NULL,
  _course_id UUID DEFAULT NULL,
  _points INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_db_id uuid;
  v_activity_date DATE := CURRENT_DATE;
  v_existing_streak RECORD;
  v_new_streak INTEGER;
  v_total_days INTEGER;
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

  -- Insert learning activity record (ignore if already exists for today)
  INSERT INTO public.learning_activity (
    student_id, 
    activity_date, 
    activity_type, 
    lesson_id, 
    course_id,
    points_earned
  ) VALUES (
    v_user_db_id,
    v_activity_date,
    _activity_type,
    _lesson_id,
    _course_id,
    _points
  )
  ON CONFLICT (student_id, activity_date, activity_type, lesson_id) 
  DO NOTHING;

  -- Get or create user streak record
  SELECT * INTO v_existing_streak
  FROM public.user_streaks
  WHERE student_id = v_user_db_id;

  IF NOT FOUND THEN
    -- Create new streak record
    INSERT INTO public.user_streaks (
      student_id,
      current_streak,
      longest_streak,
      last_activity_date,
      total_learning_days
    ) VALUES (
      v_user_db_id,
      1,
      1,
      v_activity_date,
      1
    )
    RETURNING * INTO v_existing_streak;
  ELSE
    -- Update existing streak
    IF v_existing_streak.last_activity_date = v_activity_date THEN
      -- Already logged activity today, no streak change
      v_new_streak := v_existing_streak.current_streak;
      v_total_days := v_existing_streak.total_learning_days;
    ELSIF v_existing_streak.last_activity_date = v_activity_date - INTERVAL '1 day' THEN
      -- Consecutive day, increment streak
      v_new_streak := v_existing_streak.current_streak + 1;
      v_total_days := v_existing_streak.total_learning_days + 1;
    ELSE
      -- Streak broken, start new streak
      v_new_streak := 1;
      v_total_days := v_existing_streak.total_learning_days + 1;
    END IF;

    -- Update longest streak if needed
    UPDATE public.user_streaks
    SET 
      current_streak = v_new_streak,
      longest_streak = GREATEST(v_existing_streak.longest_streak, v_new_streak),
      last_activity_date = v_activity_date,
      total_learning_days = v_total_days,
      updated_at = now()
    WHERE student_id = v_user_db_id;

    v_existing_streak.current_streak := v_new_streak;
    v_existing_streak.longest_streak := GREATEST(v_existing_streak.longest_streak, v_new_streak);
    v_existing_streak.total_learning_days := v_total_days;
  END IF;

  RETURN jsonb_build_object(
    'student_id', v_user_db_id,
    'current_streak', v_existing_streak.current_streak,
    'longest_streak', v_existing_streak.longest_streak,
    'total_learning_days', v_existing_streak.total_learning_days,
    'activity_date', v_activity_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_learning_activity TO authenticated;

-- 7. Create function to get user streak information
CREATE OR REPLACE FUNCTION public.get_user_streak(_student_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_db_id uuid;
  v_streak_info RECORD;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Use provided student_id or resolve from auth
  IF _student_id IS NOT NULL THEN
    v_user_db_id := _student_id;
  ELSE
    SELECT id INTO v_user_db_id
    FROM public.users
    WHERE auth_user_id = v_auth_id
    LIMIT 1;
  END IF;

  IF v_user_db_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'total_learning_days', 0,
      'last_activity_date', NULL
    );
  END IF;

  SELECT * INTO v_streak_info
  FROM public.user_streaks
  WHERE student_id = v_user_db_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'total_learning_days', 0,
      'last_activity_date', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_streak_info.current_streak,
    'longest_streak', v_streak_info.longest_streak,
    'total_learning_days', v_streak_info.total_learning_days,
    'last_activity_date', v_streak_info.last_activity_date,
    'streak_freezes_remaining', v_streak_info.streak_freezes_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_streak TO authenticated;

-- 8. Create function to get learning activity for calendar
CREATE OR REPLACE FUNCTION public.get_learning_activity_calendar(
  _student_id UUID DEFAULT NULL,
  _start_date DATE DEFAULT NULL,
  _end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  activity_date DATE,
  activity_count INTEGER,
  points_earned INTEGER,
  activity_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_db_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Use provided student_id or resolve from auth
  IF _student_id IS NOT NULL THEN
    v_user_db_id := _student_id;
  ELSE
    SELECT id INTO v_user_db_id
    FROM public.users
    WHERE auth_user_id = v_auth_id
    LIMIT 1;
  END IF;

  IF v_user_db_id IS NULL THEN
    RETURN;
  END IF;

  -- Set default date range to last 90 days if not provided
  IF _start_date IS NULL THEN
    _start_date := CURRENT_DATE - INTERVAL '90 days';
  END IF;
  
  IF _end_date IS NULL THEN
    _end_date := CURRENT_DATE;
  END IF;

  RETURN QUERY
  SELECT 
    activity_date,
    COUNT(*) as activity_count,
    SUM(points_earned) as points_earned,
    ARRAY_AGG(DISTINCT activity_type) as activity_types
  FROM public.learning_activity
  WHERE student_id = v_user_db_id
    AND activity_date >= _start_date
    AND activity_date <= _end_date
  GROUP BY activity_date
  ORDER BY activity_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_learning_activity_calendar TO authenticated;

-- 9. Add realtime for learning_activity (for dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_streaks;

-- 10. Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
