-- Fix courses.created_by foreign key to reference users.auth_user_id (matches auth.uid())
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;

-- Ensure users.auth_user_id is unique so it can be referenced by FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_auth_user_id_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX users_auth_user_id_unique_idx ON public.users (auth_user_id);
  END IF;
END $$;

-- Re-add FK to auth_user_id
ALTER TABLE public.courses
  ADD CONSTRAINT courses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(auth_user_id);
