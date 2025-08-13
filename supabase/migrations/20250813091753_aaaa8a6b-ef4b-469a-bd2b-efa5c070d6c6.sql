-- Add new columns for enhanced user info without modifying role column
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS role_level INTEGER DEFAULT 1; -- 1=student, 2=tutor, 3=ultimate_tutor, 4=admin

-- Update role_level based on current role
UPDATE public.users SET role_level = CASE
  WHEN role = 'student' THEN 1
  WHEN role = 'tutor' THEN 2
  WHEN role = 'admin' THEN 4
  ELSE 1
END;

-- Create function to check enrollment request status
CREATE OR REPLACE FUNCTION public.check_enrollment_request_status(_request_id uuid)
RETURNS TEXT AS $$
DECLARE
  request_status TEXT;
BEGIN
  SELECT status INTO request_status 
  FROM public.enrollment_requests 
  WHERE id = _request_id;
  
  RETURN COALESCE(request_status, 'not_found');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is ultimate tutor or admin
CREATE OR REPLACE FUNCTION public.is_ultimate_tutor_or_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = user_id AND (role = 'admin' OR role_level >= 3)
  );
$$;

-- Enhanced admin functions for enrollment management
CREATE OR REPLACE FUNCTION public.admin_enroll_user(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_ultimate_tutor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, enrolled_by)
  VALUES (_user_id, _course_id, 'active', auth.uid())
  ON CONFLICT (student_id, course_id) DO NOTHING;
END;
$$;

-- Function to get only unresolved enrollment requests
CREATE OR REPLACE FUNCTION public.get_unresolved_enrollment_notifications()
RETURNS TABLE(
  id uuid,
  recipient_user_id uuid,
  recipient_role text,
  type text,
  title text,
  message text,
  read boolean,
  created_at timestamptz,
  data jsonb,
  request_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.recipient_user_id,
    n.recipient_role,
    n.type,
    n.title,
    n.message,
    n.read,
    n.created_at,
    n.data,
    COALESCE(er.status, 'not_found') as request_status
  FROM public.notifications n
  LEFT JOIN public.enrollment_requests er ON (n.data->>'request_id')::uuid = er.id
  WHERE n.type = 'enrollment_request' 
    AND (er.status = 'pending' OR er.status IS NULL)
    AND (
      (n.recipient_role = 'admin' AND public.is_admin(auth.uid()))
      OR n.recipient_user_id = auth.uid()
    )
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove resolved notifications
CREATE OR REPLACE FUNCTION public.cleanup_resolved_notifications(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  DELETE FROM public.notifications 
  WHERE type = 'enrollment_request' 
    AND (data->>'request_id')::uuid = _request_id;
END;
$$;