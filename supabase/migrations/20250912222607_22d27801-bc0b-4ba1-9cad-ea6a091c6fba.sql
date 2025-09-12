-- Fix notifications RLS policy to allow system inserts
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Allow system/admin inserts for notifications
CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Fix course deletion policy for admins
DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;

CREATE POLICY "Admins can delete courses" 
ON public.courses 
FOR DELETE 
USING (is_admin(auth.uid()));