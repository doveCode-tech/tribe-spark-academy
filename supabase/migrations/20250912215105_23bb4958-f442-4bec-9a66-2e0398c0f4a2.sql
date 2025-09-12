-- Create demo badges for the badge system
INSERT INTO public.badges (name, description, icon, color) VALUES
  ('Course Completion', 'Awarded for completing a course and passing the final quiz', 'Trophy', '#FFD700'),
  ('First Steps', 'Awarded for completing your first lesson', 'Star', '#4F46E5'),
  ('Quiz Master', 'Awarded for scoring 100% on a quiz', 'Award', '#10B981'),
  ('Portfolio Builder', 'Awarded for submitting your first project', 'BookOpen', '#F59E0B'),
  ('Persistent Learner', 'Awarded for completing 5 courses', 'GraduationCap', '#8B5CF6'),
  ('Gaming Champion', 'Awarded for completing all mini-games in a course', 'Gamepad2', '#EF4444'),
  ('Early Bird', 'Awarded for being among the first 10 students to join', 'Users', '#06B6D4'),
  ('Report Writer', 'Awarded for submitting your first tutor report', 'FileText', '#84CC16');