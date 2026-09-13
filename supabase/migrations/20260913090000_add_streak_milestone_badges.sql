-- Migration: Add streak milestone badges
-- Creates badges for learning streak achievements

-- Insert streak milestone badges
INSERT INTO public.badges (name, description, icon, color, criteria) VALUES
(
  '3-Day Streak',
  'Started your learning journey! Keep the momentum going!',
  'Flame',
  '#22c55e',
  '{"type": "streak", "days": 3}'::jsonb
),
(
  '7-Day Streak',
  'One week of consistent learning! You are building great habits!',
  'Flame',
  '#eab308',
  '{"type": "streak", "days": 7}'::jsonb
),
(
  '14-Day Streak',
  'Two weeks of dedication! Your consistency is impressive!',
  'Flame',
  '#f97316',
  '{"type": "streak", "days": 14}'::jsonb
),
(
  '30-Day Streak',
  'One month of learning! You are unstoppable!',
  'Flame',
  '#ef4444',
  '{"type": "streak", "days": 30}'::jsonb
),
(
  '100-Day Streak',
  'Century club! You have achieved incredible consistency!',
  'Trophy',
  '#a855f7',
  '{"type": "streak", "days": 100}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Create function to award streak badges automatically
CREATE OR REPLACE FUNCTION public.award_streak_badges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_streak_badge RECORD;
  v_user_streak RECORD;
  v_has_badge BOOLEAN;
BEGIN
  -- Get all streak badges
  FOR v_streak_badge IN 
    SELECT id, criteria->>'days' as required_days
    FROM public.badges
    WHERE criteria->>'type' = 'streak'
  LOOP
    -- Get all users who have reached this streak milestone
    FOR v_user_streak IN
      SELECT student_id, current_streak
      FROM public.user_streaks
      WHERE current_streak >= CAST(v_streak_badge.required_days AS INTEGER)
    LOOP
      -- Check if user already has this badge
      SELECT EXISTS(
        SELECT 1 FROM public.student_badges
        WHERE student_id = v_user_streak.student_id
        AND badge_id = v_streak_badge.id
      ) INTO v_has_badge;

      -- Award badge if not already earned
      IF NOT v_has_badge THEN
        INSERT INTO public.student_badges (student_id, badge_id, earned_at)
        VALUES (v_user_streak.student_id, v_streak_badge.id, now());
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_streak_badges TO authenticated;

-- Create trigger to automatically award streak badges when streaks are updated
CREATE OR REPLACE FUNCTION public.check_streak_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Award streak badges after streak update
  PERFORM public.award_streak_badges();
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_streak_badges_after_update
  AFTER UPDATE ON public.user_streaks
  FOR EACH ROW
  WHEN (NEW.current_streak IS DISTINCT FROM OLD.current_streak)
  EXECUTE FUNCTION public.check_streak_badges();

-- Award existing streak badges for users who already have streaks
SELECT public.award_streak_badges();
