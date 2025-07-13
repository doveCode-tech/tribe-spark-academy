-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can create users" ON public.users;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Create a simple admin policy that doesn't reference the users table recursively
CREATE POLICY "Allow admin access" ON public.users
FOR ALL USING (
  auth.uid() IN (
    SELECT auth_user_id FROM public.users 
    WHERE role = 'admin' AND auth_user_id = auth.uid()
  )
);