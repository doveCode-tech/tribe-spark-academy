-- Drop the foreign key constraint first
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;

-- Update any courses with invalid created_by values to null
UPDATE public.courses 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL);

-- Now add the correct foreign key constraint
ALTER TABLE public.courses 
ADD CONSTRAINT courses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(auth_user_id);