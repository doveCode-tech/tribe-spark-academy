-- Add report_required column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS report_required BOOLEAN DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_report_required ON public.users(report_required) WHERE role = 'student';

-- Update the reviewReport process to set report_required to false when approved
-- This will be handled in the application code, but we can create a trigger if needed
CREATE OR REPLACE FUNCTION public.mark_student_report_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a report is approved, mark the student as not requiring a report
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.users
    SET report_required = false
    WHERE auth_user_id = NEW.student_id AND role = 'student';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically update report_required when report is approved
DROP TRIGGER IF EXISTS trigger_mark_student_report_complete ON public.reports;
CREATE TRIGGER trigger_mark_student_report_complete
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_student_report_complete();