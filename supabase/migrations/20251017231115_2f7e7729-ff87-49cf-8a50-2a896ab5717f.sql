-- Add parent_email column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parent_email TEXT;

-- Create audit_logs table for tracking email sends and other actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  target_id UUID,
  target_type TEXT,
  details JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- System can create audit logs
CREATE POLICY "System can create audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);