-- Create admin settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read admin settings
CREATE POLICY "Admins can read admin settings"
  ON public.admin_settings
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Only admins can insert admin settings
CREATE POLICY "Admins can insert admin settings"
  ON public.admin_settings
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can update admin settings
CREATE POLICY "Admins can update admin settings"
  ON public.admin_settings
  FOR UPDATE
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Insert default settings
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES 
  ('founder_signature_url', '{"url": null, "uploaded_at": null}'::jsonb),
  ('company_logo_url', '{"url": null, "uploaded_at": null}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger to update timestamp
CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for admin assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-assets', 'admin-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for admin assets
CREATE POLICY "Admins can upload admin assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'admin-assets' AND
    is_admin(auth.uid())
  );

CREATE POLICY "Admins can update admin assets"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'admin-assets' AND
    is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete admin assets"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'admin-assets' AND
    is_admin(auth.uid())
  );

CREATE POLICY "Admin assets are publicly readable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'admin-assets');