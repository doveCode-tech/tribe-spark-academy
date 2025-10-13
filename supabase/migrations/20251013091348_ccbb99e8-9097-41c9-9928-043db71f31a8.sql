-- Create function to check if user is a tutor or admin
CREATE OR REPLACE FUNCTION public.is_tutor_or_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = user_id 
    AND role IN ('tutor', 'ultimate_tutor', 'admin')
  );
$function$;

-- Add RLS policy to allow tutors to view students
CREATE POLICY "Tutors can view students"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.is_tutor_or_admin(auth.uid()) 
  AND role = 'student'
);