-- First, let's add authentication functionality and ensure proper user management

-- Remove the password column from users table as we'll use Supabase Auth
ALTER TABLE public.users DROP COLUMN IF EXISTS password;

-- Update users table structure for better user management
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create a lessons table for course content
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on lessons table
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Create policy for lessons - students can only see lessons from enrolled courses
CREATE POLICY "Students can view lessons from enrolled courses" 
ON public.lessons 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE enrollments.course_id = lessons.course_id 
    AND enrollments.student_id = auth.uid()
  )
);

-- Tutors and admins can view all lessons
CREATE POLICY "Tutors and admins can view all lessons" 
ON public.lessons 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role IN ('tutor', 'admin')
  )
);

-- Only tutors and admins can manage lessons
CREATE POLICY "Only tutors/admins can manage lessons" 
ON public.lessons 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role IN ('tutor', 'admin')
  )
);

-- Create a lesson_progress table to track student progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

-- Enable RLS on lesson_progress
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Students can only see their own progress
CREATE POLICY "Students can view own progress" 
ON public.lesson_progress 
FOR SELECT 
USING (student_id = auth.uid());

-- Students can update their own progress
CREATE POLICY "Students can update own progress" 
ON public.lesson_progress 
FOR ALL 
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Tutors can view and manage progress of their students
CREATE POLICY "Tutors can manage student progress" 
ON public.lesson_progress 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_user_id = auth.uid() 
    AND users.role IN ('tutor', 'admin')
  )
);

-- Update enrollments table to better track enrollment details
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Update RLS policies for users table to allow admin to manage all users
DROP POLICY IF EXISTS "Allow read" ON public.users;
DROP POLICY IF EXISTS "Allow student signup" ON public.users;
DROP POLICY IF EXISTS "Update own profile (no role)" ON public.users;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" 
ON public.users 
FOR SELECT 
USING (auth_user_id = auth.uid());

-- Admins can view all users
CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users admin_user 
    WHERE admin_user.auth_user_id = auth.uid() 
    AND admin_user.role = 'admin'
  )
);

-- Only students can sign up directly
CREATE POLICY "Students can sign up" 
ON public.users 
FOR INSERT 
WITH CHECK (
  role = 'student' 
  AND auth_user_id = auth.uid()
);

-- Admins can create tutors and other users
CREATE POLICY "Admins can create users" 
ON public.users 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users admin_user 
    WHERE admin_user.auth_user_id = auth.uid() 
    AND admin_user.role = 'admin'
  )
);

-- Users can update their own profile (but not role unless admin)
CREATE POLICY "Users can update own profile" 
ON public.users 
FOR UPDATE 
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid() 
  AND (
    role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid()) -- Role unchanged
    OR EXISTS (
      SELECT 1 FROM public.users admin_user 
      WHERE admin_user.auth_user_id = auth.uid() 
      AND admin_user.role = 'admin'
    )
  )
);

-- Create function to automatically create user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'student', -- Default role for new signups
    FALSE -- Students need approval
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_lessons_updated_at ON public.lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();