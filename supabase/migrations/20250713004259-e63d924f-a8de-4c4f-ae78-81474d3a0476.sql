-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Allow admin access" ON public.users;

-- Create a security definer function to check admin role without recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = user_id AND role = 'admin'
  );
$$;

-- Create admin policies using the function
CREATE POLICY "Admins can view all users" ON public.users
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create users" ON public.users
FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Students can sign up" ON public.users
FOR INSERT WITH CHECK (role = 'student' AND auth_user_id = auth.uid());