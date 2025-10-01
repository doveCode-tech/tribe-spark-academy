-- Create default badges for the LMS
INSERT INTO public.badges (name, description, color, icon, criteria) VALUES
  ('First Course Complete', 'Completed your first course successfully', '#FFD700', '🎓', '{"type": "course_completion", "count": 1}'::jsonb),
  ('Quiz Master', 'Passed a quiz with 100% score', '#FF6B6B', '🧠', '{"type": "perfect_quiz", "count": 1}'::jsonb),
  ('Rising Star', 'Earned 3 achievements', '#4ECDC4', '⭐', '{"type": "achievements", "count": 3}'::jsonb)
ON CONFLICT DO NOTHING;

-- Update RLS policy for projects table to use auth_user_id
DROP POLICY IF EXISTS "Student reads own projects" ON public.projects;
CREATE POLICY "Student reads own projects" ON public.projects
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Allow student insert" ON public.projects;
CREATE POLICY "Allow student insert" ON public.projects
  FOR INSERT WITH CHECK (student_id = auth.uid());