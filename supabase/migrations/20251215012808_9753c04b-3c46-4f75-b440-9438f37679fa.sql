-- Enable realtime for lessons table
ALTER TABLE public.lessons REPLICA IDENTITY FULL;

-- Add lessons to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'lessons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
  END IF;
END $$;