-- Create role enum if not exists
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('student', 'tutor', 'ultimate_tutor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update users table to use enum and add new fields
ALTER TABLE public.users 
  ALTER COLUMN role TYPE app_role USING role::app_role,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

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

-- Enhanced admin functions for enrollment management
CREATE OR REPLACE FUNCTION public.admin_enroll_user(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_ultimate_tutor(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, enrolled_by)
  VALUES (_user_id, _course_id, 'active', auth.uid())
  ON CONFLICT (student_id, course_id) DO NOTHING;
END;
$$;

-- Function to check if user is ultimate tutor
CREATE OR REPLACE FUNCTION public.is_ultimate_tutor(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = user_id AND role = 'ultimate_tutor'
  );
$$;

-- Enhanced password reset function
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(_user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- This will need to be implemented through edge function
  -- as we can't directly reset passwords from SQL
  INSERT INTO public.notifications (recipient_role, type, title, message, data)
  VALUES (
    'admin',
    'password_reset_request',
    'Password reset requested',
    'Admin requested password reset for user: ' || _user_email,
    jsonb_build_object('user_email', _user_email)
  );
END;
$$;

-- Bulk user registration function
CREATE OR REPLACE FUNCTION public.admin_bulk_register_users(_users jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{"success": [], "errors": []}';
  user_data jsonb;
  temp_password text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  FOR user_data IN SELECT * FROM jsonb_array_elements(_users)
  LOOP
    BEGIN
      -- Generate temporary password
      temp_password := 'temp' || floor(random() * 10000)::text;
      
      -- This will need edge function integration for actual auth user creation
      -- For now, just log the request
      INSERT INTO public.notifications (recipient_role, type, title, message, data)
      VALUES (
        'admin',
        'bulk_registration',
        'Bulk user registration requested',
        'Bulk registration for: ' || (user_data->>'email'),
        jsonb_build_object(
          'user_data', user_data,
          'temp_password', temp_password
        )
      );
      
      result := jsonb_set(result, '{success}', 
        (result->'success') || jsonb_build_array(user_data->>'email'));
    EXCEPTION
      WHEN OTHERS THEN
        result := jsonb_set(result, '{errors}', 
          (result->'errors') || jsonb_build_array(
            jsonb_build_object(
              'email', user_data->>'email',
              'error', SQLERRM
            )
          ));
    END;
  END LOOP;
  
  RETURN result;
END;
$$;