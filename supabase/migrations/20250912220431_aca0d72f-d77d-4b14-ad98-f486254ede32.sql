-- Fix the foreign key constraint in courses table by removing the constraint
-- The created_by field should reference the users.id column, not auth.users
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.courses ADD CONSTRAINT courses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id);