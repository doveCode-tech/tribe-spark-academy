-- Ensure users.approved has a default
ALTER TABLE public.users
ALTER COLUMN approved SET DEFAULT false;

-- Fix foreign key on enrollments.student_id to reference users.auth_user_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'enrollments_student_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
    DROP CONSTRAINT enrollments_student_id_fkey;
  END IF;
END $$;

ALTER TABLE public.enrollments
ADD CONSTRAINT enrollments_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES public.users (auth_user_id)
ON DELETE CASCADE;

-- Create function to ensure a public.users row exists for a given auth user id
CREATE OR REPLACE FUNCTION public.ensure_user_profile_exists(_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE
  v_email text;
  v_name text;
  v_first text;
  v_last text;
  v_phone text;
  v_city text;
  v_country text;
BEGIN
  -- If already exists, nothing to do
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = _auth_user_id) THEN
    RETURN;
  END IF;

  -- Fetch details from auth.users
  SELECT email,
         COALESCE(raw_user_meta_data->>'name', email) AS name,
         raw_user_meta_data->>'first_name',
         raw_user_meta_data->>'last_name',
         raw_user_meta_data->>'phone',
         raw_user_meta_data->>'city',
         raw_user_meta_data->>'country'
    INTO v_email, v_name, v_first, v_last, v_phone, v_city, v_country
  FROM auth.users
  WHERE id = _auth_user_id;

  -- Insert minimal profile
  INSERT INTO public.users (
    auth_user_id, email, name, role, approved, first_name, last_name, phone, city, country
  ) VALUES (
    _auth_user_id, COALESCE(v_email, ''), COALESCE(v_name, v_email), 'student', false,
    v_first, v_last, v_phone, v_city, v_country
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
END;
$function$;

-- Update admin_approve_enrollment_request to ensure user exists before enrollment
CREATE OR REPLACE FUNCTION public.admin_approve_enrollment_request(_request_id uuid, _note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req RECORD;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO req FROM public.enrollment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE public.enrollment_requests
  SET status = 'approved', processed_at = now(), processed_by = auth.uid(), note = _note
  WHERE id = _request_id;

  -- Ensure user profile exists for the student
  PERFORM public.ensure_user_profile_exists(req.student_id);

  -- Create enrollment if not exists
  INSERT INTO public.enrollments (student_id, course_id, status)
  SELECT req.student_id, req.course_id, 'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.enrollments e WHERE e.student_id = req.student_id AND e.course_id = req.course_id
  );

  -- Notify student
  INSERT INTO public.notifications (recipient_user_id, type, title, message, data)
  VALUES (
    req.student_id,
    'enrollment_approved',
    'Enrollment approved',
    'Your enrollment request has been approved',
    jsonb_build_object('course_id', req.course_id, 'request_id', req.id)
  );
END;
$function$;

-- Create trigger to auto-create public.users on new auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
BEGIN
  PERFORM 1 FROM public.users WHERE auth_user_id = NEW.id;
  IF NOT FOUND THEN
    INSERT INTO public.users (auth_user_id, email, name, role, approved, first_name, last_name, phone, city, country)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      'student',
      false,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'city',
      NEW.raw_user_meta_data->>'country'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();