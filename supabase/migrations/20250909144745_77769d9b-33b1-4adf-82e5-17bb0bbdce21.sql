-- Update the admin_enroll_user function (this should work now with the constraint)
CREATE OR REPLACE FUNCTION public.admin_enroll_user(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_ultimate_tutor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, enrolled_by)
  VALUES (_user_id, _course_id, 'active', auth.uid())
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    status = EXCLUDED.status,
    enrolled_by = EXCLUDED.enrolled_by,
    enrolled_at = now();
END;
$function$;

-- Create demo courses
INSERT INTO public.courses (id, title, description, category) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Python for Beginners', 'Learn the fundamentals of Python programming', 'Python'),
  ('22222222-2222-2222-2222-222222222222', 'Scratch Programming', 'Create games and animations with Scratch', 'Scratch'),
  ('33333333-3333-3333-3333-333333333333', 'Web Development', 'Build websites with HTML, CSS, and JavaScript', 'Web Development')
ON CONFLICT (id) DO NOTHING;

-- Create badges with proper UUIDs
INSERT INTO public.badges (id, name, description, icon, color, criteria) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Star of Excellence', 'Awarded for outstanding performance', '⭐', '#FFD700', '{"type": "completion", "threshold": 100}'),
  ('b2222222-2222-2222-2222-222222222222', 'Master Coder', 'Expert programming skills', '💻', '#00FF00', '{"type": "coding_excellence", "projects": 5}'),
  ('b3333333-3333-3333-3333-333333333333', 'Quiz Champion', 'Perfect quiz performance', '🏆', '#FF6B35', '{"type": "quiz_score", "percentage": 100}'),
  ('b4444444-4444-4444-4444-444444444444', 'Project Hero', 'Exceptional project submissions', '🛡️', '#4A90E2', '{"type": "project_quality", "rating": "excellent"}')
ON CONFLICT (id) DO NOTHING;