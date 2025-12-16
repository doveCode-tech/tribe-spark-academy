-- Add lesson_id column to projects table for per-lesson submission tracking
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_lesson_id ON public.projects(lesson_id);