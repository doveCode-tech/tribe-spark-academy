-- Add instructions and youtube_urls columns to lessons table
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS instructions text DEFAULT '',
ADD COLUMN IF NOT EXISTS youtube_urls text[] DEFAULT ARRAY[]::text[];