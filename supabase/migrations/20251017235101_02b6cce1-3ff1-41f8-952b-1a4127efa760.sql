-- Add assignment and quiz requirement toggles to lessons table
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS assignment_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiz_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_end_of_course BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS assignment_data JSONB,
ADD COLUMN IF NOT EXISTS quiz_data JSONB;

-- Add comment to explain the columns
COMMENT ON COLUMN public.lessons.assignment_required IS 'If true, student must complete assignment before marking lesson complete';
COMMENT ON COLUMN public.lessons.quiz_required IS 'If true, student must pass quiz before marking lesson complete';
COMMENT ON COLUMN public.lessons.is_end_of_course IS 'If true, this lesson contains end-of-course activities (final project/quiz/presentation)';
COMMENT ON COLUMN public.lessons.assignment_data IS 'JSON data for assignment details (title, description, requirements)';
COMMENT ON COLUMN public.lessons.quiz_data IS 'JSON data for quiz details (questions, answers, pass score)';