-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

-- Create storage policies for avatar uploads
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add capstone project functionality
ALTER TABLE public.courses
ADD COLUMN capstone_project_title TEXT DEFAULT 'Final Project',
ADD COLUMN capstone_project_description TEXT DEFAULT 'Complete this capstone project to finish the course and add it to your portfolio.';

-- Update the existing Python course with capstone project details
UPDATE public.courses 
SET 
  capstone_project_title = 'Python Portfolio Project',
  capstone_project_description = 'Create a complete Python application that demonstrates your understanding of programming fundamentals, data structures, and problem-solving skills.'
WHERE title = 'Python Programming Fundamentals';