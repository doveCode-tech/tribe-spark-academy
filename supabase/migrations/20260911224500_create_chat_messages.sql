-- Create chat_messages table for live chat between students and tutors/admins
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  recipient_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read messages they sent, received, or if staff (admin/tutor/ultimate_tutor)
CREATE POLICY "Users can read their messages and staff can read student chats"
ON public.chat_messages FOR SELECT
USING (
  auth.uid() = sender_id OR 
  auth.uid() = recipient_id OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'tutor', 'ultimate_tutor')
  )
);

-- Allow authenticated users to insert messages where they are the sender
CREATE POLICY "Users can send messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- Realtime subscription setup
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
