-- Add FK from messages.user_id to profiles.user_id
ALTER TABLE public.messages ADD CONSTRAINT messages_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add UPDATE policy on messages for vote count updates
CREATE POLICY "Users can update votes_count" ON public.messages
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Re-create the trigger for auto profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create room_join_requests table
CREATE TABLE public.room_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requests viewable by authenticated" ON public.room_join_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can request to join" ON public.room_join_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Room creators can update requests" ON public.room_join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms WHERE id = room_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can cancel their requests" ON public.room_join_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);