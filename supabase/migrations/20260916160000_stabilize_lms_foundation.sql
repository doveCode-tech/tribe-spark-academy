-- Migration: Stabilize LMS Foundation
-- 1. Automatic course progress percentage calculation trigger
-- 2. Enhanced streak tracking with streak freeze support and safe date handling
-- 3. Secure milestone badge awarding RPC
-- 4. Dual-ID support for projects, reports, and badges

-- ============================================================================
-- 1. Automatic Course Progress Calculation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_course_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_course_id uuid;
  v_student_auth_id uuid;
  v_student_db_id uuid;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_percentage integer := 0;
BEGIN
  -- Determine course_id from lesson
  IF TG_OP = 'DELETE' THEN
    SELECT course_id INTO v_course_id FROM public.lessons WHERE id = OLD.lesson_id;
    v_student_auth_id := OLD.student_id;
  ELSE
    SELECT course_id INTO v_course_id FROM public.lessons WHERE id = NEW.lesson_id;
    v_student_auth_id := NEW.student_id;
  END IF;

  IF v_course_id IS NULL OR v_student_auth_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve student db id
  SELECT id INTO v_student_db_id FROM public.users WHERE auth_user_id = v_student_auth_id LIMIT 1;

  -- Count total lessons in course
  SELECT COUNT(*) INTO v_total_lessons FROM public.lessons WHERE course_id = v_course_id;

  IF v_total_lessons > 0 THEN
    -- Count completed lessons for this student
    SELECT COUNT(*) INTO v_completed_lessons
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = v_course_id
      AND (lp.student_id = v_student_auth_id OR (v_student_db_id IS NOT NULL AND lp.student_id = v_student_db_id))
      AND lp.completed = true;

    v_percentage := ROUND((v_completed_lessons::numeric / v_total_lessons::numeric) * 100);
    IF v_percentage > 100 THEN
      v_percentage := 100;
    END IF;
  ELSE
    v_percentage := 0;
  END IF;

  -- Update enrollments table
  UPDATE public.enrollments
  SET 
    progress_percentage = v_percentage,
    status = CASE 
      WHEN v_percentage >= 100 THEN 'completed'
      ELSE 'active'
    END
  WHERE course_id = v_course_id
    AND (
      student_id = v_student_auth_id 
      OR (v_student_db_id IS NOT NULL AND student_id = v_student_db_id)
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalculate_course_progress ON public.lesson_progress;
CREATE TRIGGER trigger_recalculate_course_progress
  AFTER INSERT OR UPDATE OF completed OR DELETE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_course_progress();


-- ============================================================================
-- 2. Enhanced Streak Tracking & Freeze Support
-- ============================================================================

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
  v_freezes_left INTEGER := 3;
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

  -- Insert learning activity record (ignore if already exists today for this type and lesson)
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

  -- Get user streak record
  SELECT * INTO v_existing_streak
  FROM public.user_streaks
  WHERE student_id = v_user_db_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (
      student_id,
      current_streak,
      longest_streak,
      last_activity_date,
      total_learning_days,
      streak_freezes_remaining
    ) VALUES (
      v_user_db_id,
      1,
      1,
      v_activity_date,
      1,
      3
    )
    RETURNING * INTO v_existing_streak;
  ELSE
    v_freezes_left := COALESCE(v_existing_streak.streak_freezes_remaining, 0);

    IF v_existing_streak.last_activity_date = v_activity_date THEN
      -- Already logged activity today
      v_new_streak := v_existing_streak.current_streak;
      v_total_days := v_existing_streak.total_learning_days;
    ELSIF v_existing_streak.last_activity_date = v_activity_date - INTERVAL '1 day' THEN
      -- Consecutive day
      v_new_streak := v_existing_streak.current_streak + 1;
      v_total_days := v_existing_streak.total_learning_days + 1;
    ELSIF v_existing_streak.last_activity_date = v_activity_date - INTERVAL '2 days' AND v_freezes_left > 0 THEN
      -- Missed 1 day, automatically protected by streak freeze!
      v_freezes_left := v_freezes_left - 1;
      v_new_streak := v_existing_streak.current_streak + 1;
      v_total_days := v_existing_streak.total_learning_days + 1;
    ELSE
      -- Streak broken
      v_new_streak := 1;
      v_total_days := v_existing_streak.total_learning_days + 1;
    END IF;

    UPDATE public.user_streaks
    SET 
      current_streak = v_new_streak,
      longest_streak = GREATEST(v_existing_streak.longest_streak, v_new_streak),
      last_activity_date = v_activity_date,
      total_learning_days = v_total_days,
      streak_freezes_remaining = v_freezes_left,
      updated_at = now()
    WHERE student_id = v_user_db_id;

    v_existing_streak.current_streak := v_new_streak;
    v_existing_streak.longest_streak := GREATEST(v_existing_streak.longest_streak, v_new_streak);
    v_existing_streak.total_learning_days := v_total_days;
    v_existing_streak.streak_freezes_remaining := v_freezes_left;
  END IF;

  RETURN jsonb_build_object(
    'student_id', v_user_db_id,
    'current_streak', v_existing_streak.current_streak,
    'longest_streak', v_existing_streak.longest_streak,
    'total_learning_days', v_existing_streak.total_learning_days,
    'streak_freezes_remaining', v_existing_streak.streak_freezes_remaining,
    'activity_date', v_activity_date
  );
END;
$$;

-- Secure function to get user streak with inactivity decay check
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
  v_effective_streak INTEGER;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _student_id IS NOT NULL THEN
    SELECT id INTO v_user_db_id FROM public.users WHERE id = _student_id OR auth_user_id = _student_id LIMIT 1;
    IF v_user_db_id IS NULL THEN
      v_user_db_id := _student_id;
    END IF;
  ELSE
    SELECT id INTO v_user_db_id FROM public.users WHERE auth_user_id = v_auth_id LIMIT 1;
  END IF;

  IF v_user_db_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'total_learning_days', 0,
      'last_activity_date', NULL,
      'streak_freezes_remaining', 3
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
      'last_activity_date', NULL,
      'streak_freezes_remaining', 3
    );
  END IF;

  -- Validate streak health: if last activity was more than 1 day ago and no freezes
  v_effective_streak := v_streak_info.current_streak;
  IF v_streak_info.last_activity_date IS NOT NULL THEN
    IF v_streak_info.last_activity_date < CURRENT_DATE - INTERVAL '1 day' THEN
      -- If missed 1 day and has freezes, can still freeze; if missed > 1 day without freeze, streak is 0
      IF v_streak_info.last_activity_date < CURRENT_DATE - INTERVAL '2 days' THEN
        v_effective_streak := 0;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_effective_streak,
    'longest_streak', v_streak_info.longest_streak,
    'total_learning_days', v_streak_info.total_learning_days,
    'last_activity_date', v_streak_info.last_activity_date,
    'streak_freezes_remaining', COALESCE(v_streak_info.streak_freezes_remaining, 3)
  );
END;
$$;

-- Allow students to manually use a streak freeze to protect their streak
CREATE OR REPLACE FUNCTION public.use_streak_freeze()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_db_id uuid;
  v_streak RECORD;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_user_db_id FROM public.users WHERE auth_user_id = v_auth_id LIMIT 1;
  IF v_user_db_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  SELECT * INTO v_streak FROM public.user_streaks WHERE student_id = v_user_db_id OR student_id = v_auth_id LIMIT 1;
  IF NOT FOUND OR v_streak.streak_freezes_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No streak freezes available');
  END IF;

  UPDATE public.user_streaks
  SET 
    streak_freezes_remaining = streak_freezes_remaining - 1,
    last_activity_date = CURRENT_DATE,
    updated_at = now()
  WHERE student_id = v_streak.student_id;

  RETURN jsonb_build_object(
    'success', true, 
    'streak_freezes_remaining', v_streak.streak_freezes_remaining - 1,
    'current_streak', v_streak.current_streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_streak_freeze TO authenticated;


-- ============================================================================
-- 3. Milestone Badge Awarding Function (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_milestone_badge(
  _badge_name TEXT,
  _student_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_auth_id uuid;
  v_target_db_id uuid;
  v_badge_id uuid;
BEGIN
  -- Resolve student ID
  IF _student_id IS NOT NULL THEN
    SELECT id, auth_user_id INTO v_target_db_id, v_target_auth_id 
    FROM public.users 
    WHERE id = _student_id OR auth_user_id = _student_id 
    LIMIT 1;
  ELSE
    v_target_auth_id := auth.uid();
    SELECT id INTO v_target_db_id FROM public.users WHERE auth_user_id = v_target_auth_id LIMIT 1;
  END IF;

  IF v_target_auth_id IS NULL AND v_target_db_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'User not found');
  END IF;

  -- Find badge by name
  SELECT id INTO v_badge_id FROM public.badges WHERE name = _badge_name LIMIT 1;
  IF v_badge_id IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'Badge not found');
  END IF;

  -- Check if already awarded (matching either ID)
  IF EXISTS (
    SELECT 1 FROM public.student_badges 
    WHERE badge_id = v_badge_id 
      AND (student_id = v_target_auth_id OR (v_target_db_id IS NOT NULL AND student_id = v_target_db_id))
  ) THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'Already earned');
  END IF;

  -- Insert badge record using auth_user_id for consistency
  INSERT INTO public.student_badges (student_id, badge_id, earned_at)
  VALUES (COALESCE(v_target_auth_id, v_target_db_id), v_badge_id, now());

  RETURN jsonb_build_object('awarded', true, 'badge_id', v_badge_id, 'badge_name', _badge_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_milestone_badge TO authenticated;
