-- Enable realtime on notifications (and keep full row for updates)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- (Optional) Make enrollment_requests realtime-ready as well
ALTER TABLE public.enrollment_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollment_requests;

-- Allow admins to view all enrollments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='enrollments' AND policyname='Admins can view all enrollments'
  ) THEN
    CREATE POLICY "Admins can view all enrollments"
    ON public.enrollments
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;
END$$;