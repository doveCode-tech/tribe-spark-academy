-- Re-enable secure admin-wide user listing without triggering RLS recursion on public.users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT u.*
  FROM public.users u
  WHERE public.is_admin(auth.uid())
  ORDER BY u.created_at DESC;
$$;