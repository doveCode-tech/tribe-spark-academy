-- Add grade and attachments columns to reports table
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS grade integer,
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for report attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for report-attachments bucket
CREATE POLICY "Tutors and admins can upload report attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'report-attachments' 
  AND (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('tutor', 'ultimate_tutor', 'admin')
    )
  )
);

CREATE POLICY "Tutors and admins can view report attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'report-attachments' 
  AND (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('tutor', 'ultimate_tutor', 'admin')
    )
  )
);

CREATE POLICY "Tutors can delete their own report attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-attachments' 
  AND (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('tutor', 'ultimate_tutor', 'admin')
    )
  )
);