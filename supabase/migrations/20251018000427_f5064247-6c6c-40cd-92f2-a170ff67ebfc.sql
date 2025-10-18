-- Enable realtime for lessons table
ALTER TABLE public.lessons REPLICA IDENTITY FULL;

-- Add lessons table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;