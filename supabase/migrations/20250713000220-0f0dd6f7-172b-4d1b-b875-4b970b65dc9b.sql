-- Insert placeholder Python course for testing
INSERT INTO public.courses (title, description, category, created_by) 
VALUES (
  'Python Programming Fundamentals',
  'Learn the basics of Python programming including variables, functions, loops, and data structures. Perfect for beginners starting their coding journey.',
  'Python',
  (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
);

-- Add first_name and last_name columns to users table for better name handling
ALTER TABLE public.users 
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Update existing users to split their names if they have one
UPDATE public.users 
SET 
  first_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN split_part(name, ' ', 1)
    ELSE name
  END,
  last_name = CASE 
    WHEN name IS NOT NULL AND position(' ' in name) > 0 
    THEN substring(name from position(' ' in name) + 1)
    ELSE NULL
  END
WHERE name IS NOT NULL;