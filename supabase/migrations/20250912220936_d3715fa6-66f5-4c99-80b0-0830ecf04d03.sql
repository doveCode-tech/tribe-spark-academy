-- Simply remove the foreign key constraint that's causing the issue
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;