-- Add new columns to users table for enhanced data
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS last_access TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;

-- Add new columns to lessons table
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS video_urls TEXT[], -- Array of video URLs
ADD COLUMN IF NOT EXISTS exercises JSONB DEFAULT '[]'::jsonb, -- Exercise data
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'lesson'; -- lesson, quiz, game

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Course Quiz',
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of question objects
  pass_percentage INTEGER DEFAULT 70,
  attempts_allowed INTEGER DEFAULT -1, -- -1 means unlimited
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quizzes
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quiz attempts
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Lucide icon name
  color TEXT DEFAULT '#FFD700', -- Default gold color
  criteria JSONB, -- Conditions for earning the badge
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Create student_badges table (many-to-many)
CREATE TABLE IF NOT EXISTS public.student_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_by UUID, -- Admin/tutor who awarded it
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_id)
);

-- Enable RLS on student_badges
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- Create certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  quiz_attempt_id UUID REFERENCES public.quiz_attempts(id),
  student_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  founder_name TEXT DEFAULT 'STEMTribe Founder',
  certificate_data JSONB, -- Additional certificate customization
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Enable RLS on certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  tutor_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  reviewer_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL, -- After which lesson (3 or 7)
  title TEXT NOT NULL,
  description TEXT,
  game_type TEXT NOT NULL, -- 'memory', 'quiz', 'puzzle', etc.
  game_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Create game_scores table
CREATE TABLE IF NOT EXISTS public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on game_scores
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Create portfolios table (for better organization)
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  title TEXT DEFAULT 'My Portfolio',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  theme_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id)
);

-- Enable RLS on portfolios
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Add portfolio_id to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES public.portfolios(id);

-- RLS Policies for quizzes
CREATE POLICY "Students can view quizzes for enrolled courses" 
ON public.quizzes FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.enrollments 
  WHERE course_id = quizzes.course_id AND student_id = auth.uid()
));

CREATE POLICY "Tutors and admins can manage quizzes" 
ON public.quizzes FOR ALL 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for quiz_attempts
CREATE POLICY "Students can view own quiz attempts" 
ON public.quiz_attempts FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "Students can create own quiz attempts" 
ON public.quiz_attempts FOR INSERT 
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Tutors can view quiz attempts for their courses" 
ON public.quiz_attempts FOR SELECT 
USING (public.is_ultimate_tutor_or_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM public.course_tutors ct 
  WHERE ct.course_id = quiz_attempts.course_id AND ct.tutor_id = auth.uid()
));

-- RLS Policies for badges
CREATE POLICY "Everyone can view badges" 
ON public.badges FOR SELECT 
USING (true);

CREATE POLICY "Tutors and admins can manage badges" 
ON public.badges FOR ALL 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for student_badges
CREATE POLICY "Students can view own badges" 
ON public.student_badges FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "Tutors can award badges to their students" 
ON public.student_badges FOR INSERT 
WITH CHECK (
  public.is_ultimate_tutor_or_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() AND u.role IN ('tutor', 'ultimate_tutor', 'admin')
  )
);

CREATE POLICY "Tutors and admins can view student badges" 
ON public.student_badges FOR SELECT 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for certificates
CREATE POLICY "Students can view own certificates" 
ON public.certificates FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "System can create certificates" 
ON public.certificates FOR INSERT 
WITH CHECK (true); -- Certificates are auto-generated

CREATE POLICY "Tutors and admins can view all certificates" 
ON public.certificates FOR SELECT 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for reports
CREATE POLICY "Students can view own reports" 
ON public.reports FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "Tutors can create reports for their students" 
ON public.reports FOR INSERT 
WITH CHECK (tutor_id = auth.uid());

CREATE POLICY "Tutors can manage own reports" 
ON public.reports FOR ALL 
USING (tutor_id = auth.uid());

CREATE POLICY "Admins and ultimate tutors can manage all reports" 
ON public.reports FOR ALL 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for games
CREATE POLICY "Students can view games for enrolled courses" 
ON public.games FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.enrollments 
  WHERE course_id = games.course_id AND student_id = auth.uid()
));

CREATE POLICY "Tutors and admins can manage games" 
ON public.games FOR ALL 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for game_scores
CREATE POLICY "Students can manage own game scores" 
ON public.game_scores FOR ALL 
USING (student_id = auth.uid());

CREATE POLICY "Tutors can view game scores for their courses" 
ON public.game_scores FOR SELECT 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- RLS Policies for portfolios
CREATE POLICY "Students can manage own portfolio" 
ON public.portfolios FOR ALL 
USING (student_id = auth.uid());

CREATE POLICY "Public portfolios are viewable by everyone" 
ON public.portfolios FOR SELECT 
USING (is_public = true);

CREATE POLICY "Tutors and admins can view all portfolios" 
ON public.portfolios FOR SELECT 
USING (public.is_ultimate_tutor_or_admin(auth.uid()));

-- Update triggers for updated_at
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default badges
INSERT INTO public.badges (name, description, icon, color) VALUES
('Star of Excellence', 'Awarded for outstanding performance', 'Star', '#FFD700'),
('Master Coder', 'Demonstrated exceptional coding skills', 'Laptop', '#00FF00'),
('Quiz Champion', 'Scored 100% on a quiz', 'Trophy', '#FFD700'),
('Project Hero', 'Completed an outstanding project', 'Shield', '#4169E1'),
('Fast Learner', 'Completed lessons quickly', 'Zap', '#FFFF00'),
('Perfect Score', 'Achieved a perfect score', 'Target', '#FFD700'),
('Persistent Learner', 'Showed great persistence', 'Mountain', '#32CD32'),
('Team Player', 'Excellent collaboration skills', 'Users', '#FF69B4')
ON CONFLICT DO NOTHING;

-- Function to suspend user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(_user_id UUID, _suspended BOOLEAN DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_ultimate_tutor_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  UPDATE public.users 
  SET suspended = _suspended, last_access = now()
  WHERE auth_user_id = _user_id;
END;
$$;

-- Function to award badge
CREATE OR REPLACE FUNCTION public.award_badge(_student_id UUID, _badge_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has permission to award badges
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('tutor', 'ultimate_tutor', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to award badges';
  END IF;
  
  INSERT INTO public.student_badges (student_id, badge_id, awarded_by)
  VALUES (_student_id, _badge_id, auth.uid())
  ON CONFLICT (student_id, badge_id) DO NOTHING;
END;
$$;

-- Function to auto-generate certificate
CREATE OR REPLACE FUNCTION public.generate_certificate(_student_id UUID, _course_id UUID, _quiz_attempt_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cert_id UUID;
  student_name TEXT;
  course_title TEXT;
BEGIN
  -- Get student name and course title
  SELECT u.first_name || ' ' || u.last_name INTO student_name
  FROM public.users u WHERE u.auth_user_id = _student_id;
  
  SELECT c.title INTO course_title
  FROM public.courses c WHERE c.id = _course_id;
  
  -- Insert certificate
  INSERT INTO public.certificates (
    student_id, course_id, quiz_attempt_id, 
    student_name, course_title
  ) VALUES (
    _student_id, _course_id, _quiz_attempt_id,
    COALESCE(student_name, 'Student'), course_title
  ) RETURNING id INTO cert_id;
  
  RETURN cert_id;
END;
$$;