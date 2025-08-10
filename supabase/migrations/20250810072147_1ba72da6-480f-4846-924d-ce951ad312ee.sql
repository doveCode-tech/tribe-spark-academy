-- Fix infinite recursion in RLS policies on public.users by removing self-referential admin policies
DO $$
BEGIN
  -- Drop policy that caused recursion by self-referencing the users table in an ALL policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Allow admin access'
  ) THEN
    DROP POLICY "Allow admin access" ON public.users;
  END IF;

  -- Drop admin-wide SELECT policy that calls is_admin() (which queries users) inside a policy on users
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins can view all users'
  ) THEN
    DROP POLICY "Admins can view all users" ON public.users;
  END IF;

  -- Drop admin INSERT policy that checks is_admin() inside a policy on users
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Admins can create users'
  ) THEN
    DROP POLICY "Admins can create users" ON public.users;
  END IF;
END
$$;

-- Keep/ensure essential self-scoped policies remain (these should already exist; re-create if missing)
DO $$
BEGIN
  -- Users can view their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    USING (auth.uid() = auth_user_id);
  END IF;

  -- Users can update their own profile
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);
  END IF;

  -- Students can sign up (self-insert)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Students can sign up'
  ) THEN
    CREATE POLICY "Students can sign up"
    ON public.users
    FOR INSERT
    WITH CHECK (role = 'student'::text AND auth_user_id = auth.uid());
  END IF;
END
$$;