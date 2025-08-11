-- Create enrollment_requests table
CREATE TABLE IF NOT EXISTS public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  note text
);

-- Enable RLS
ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Policies for enrollment_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'enrollment_requests' AND policyname = 'Students can create own enrollment requests'
  ) THEN
    CREATE POLICY "Students can create own enrollment requests"
    ON public.enrollment_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'enrollment_requests' AND policyname = 'Students can view own enrollment requests'
  ) THEN
    CREATE POLICY "Students can view own enrollment requests"
    ON public.enrollment_requests
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'enrollment_requests' AND policyname = 'Admins can view all enrollment requests'
  ) THEN
    CREATE POLICY "Admins can view all enrollment requests"
    ON public.enrollment_requests
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'enrollment_requests' AND policyname = 'Admins can update enrollment requests'
  ) THEN
    CREATE POLICY "Admins can update enrollment requests"
    ON public.enrollment_requests
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (true);
  END IF;
END
$$;

-- Prevent multiple pending requests per student+course
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_enrollment_request
ON public.enrollment_requests (student_id, course_id)
WHERE status = 'pending';

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid,
  recipient_role text,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Users can view their notifications'
  ) THEN
    CREATE POLICY "Users can view their notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Admins can view admin role notifications'
  ) THEN
    CREATE POLICY "Admins can view admin role notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING ((recipient_role = 'admin' AND public.is_admin(auth.uid())) OR recipient_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Users can update read status of own notifications'
  ) THEN
    CREATE POLICY "Users can update read status of own notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Admins can update admin notifications'
  ) THEN
    CREATE POLICY "Admins can update admin notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (true);
  END IF;
END$$;

-- Trigger to notify admins on new enrollment request
CREATE OR REPLACE FUNCTION public.notify_admins_on_enrollment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_role, type, title, message, data)
  VALUES (
    'admin',
    'enrollment_request',
    'New enrollment request',
    'A student requested to enroll in a course',
    jsonb_build_object(
      'request_id', NEW.id,
      'student_id', NEW.student_id,
      'course_id', NEW.course_id
    )
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_admins_on_enrollment_request'
  ) THEN
    CREATE TRIGGER trg_notify_admins_on_enrollment_request
    AFTER INSERT ON public.enrollment_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_admins_on_enrollment_request();
  END IF;
END$$;

-- RPC: Approve enrollment request
CREATE OR REPLACE FUNCTION public.admin_approve_enrollment_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- RPC: Reject enrollment request
CREATE OR REPLACE FUNCTION public.admin_reject_enrollment_request(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SET status = 'rejected', processed_at = now(), processed_by = auth.uid(), note = _reason
  WHERE id = _request_id;

  -- Notify student
  INSERT INTO public.notifications (recipient_user_id, type, title, message, data)
  VALUES (
    req.student_id,
    'enrollment_rejected',
    'Enrollment rejected',
    COALESCE(_reason, 'Your enrollment request has been rejected'),
    jsonb_build_object('course_id', req.course_id, 'request_id', req.id)
  );
END;
$$;

-- RPC: Unenroll a student from a course
CREATE OR REPLACE FUNCTION public.admin_unenroll_student(_student_id uuid, _course_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.enrollments
  WHERE student_id = _student_id AND course_id = _course_id;

  INSERT INTO public.notifications (recipient_user_id, type, title, message, data)
  VALUES (
    _student_id,
    'unenrolled',
    'You have been unenrolled',
    COALESCE(_reason, 'You have been unenrolled from a course'),
    jsonb_build_object('course_id', _course_id)
  );
END;
$$;

-- Admin policies for users table: allow admin manage users directly via RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='Admins can view all users'
  ) THEN
    CREATE POLICY "Admins can view all users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='Admins can update any user'
  ) THEN
    CREATE POLICY "Admins can update any user"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='Admins can delete any user'
  ) THEN
    CREATE POLICY "Admins can delete any user"
    ON public.users
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;
END$$;
