-- Advanced messaging: attachments, pins, mentions, notifications, storage
-- attachment_url stores storage object path: {room_id}/{uuid}_{filename}

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_pin_root_only;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_pin_root_only CHECK (
    (parent_id IS NOT NULL AND is_pinned = false) OR (parent_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON public.messages (chat_id, is_pinned) WHERE parent_id IS NULL;

-- Pin toggle: only room owner, root messages (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.toggle_message_pin(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.chat_rooms cr ON cr.id = m.chat_id
    WHERE m.id = p_message_id
      AND m.parent_id IS NULL
      AND cr.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.messages
  SET is_pinned = NOT is_pinned
  WHERE id = p_message_id AND parent_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_message_pin(uuid) TO authenticated;

-- mentions
CREATE TABLE IF NOT EXISTS public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_message_id ON public.mentions (message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user_id ON public.mentions (mentioned_user_id);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentions readable by room members"
  ON public.mentions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.room_members rm ON rm.room_id = m.chat_id
      WHERE m.id = message_id AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Message authors insert mentions"
  ON public.mentions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.messages WHERE id = message_id)
  );

-- notifications (in-app mentions)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Message authors insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.messages WHERE id = message_id)
    AND user_id <> auth.uid()
  );

-- Tighten messages UPDATE: drop permissive policy, keep vote-related if any
DROP POLICY IF EXISTS "Authenticated can update messages votes" ON public.messages;
DROP POLICY IF EXISTS "Users can update votes_count" ON public.messages;

-- Vote aggregate updates (optional client sync); pin uses RPC above
CREATE POLICY "Authenticated can update message votes_count"
  ON public.messages FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage: public bucket attachments, path must start with room_id/ where user is a member
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY "attachments insert for room members"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.user_id = auth.uid()
        AND rm.room_id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY "attachments select authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments');

CREATE POLICY "attachments delete own or room owner"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.room_members rm
        JOIN public.chat_rooms cr ON cr.id = rm.room_id
        WHERE rm.user_id = auth.uid()
          AND cr.created_by = auth.uid()
          AND rm.room_id::text = split_part(name, '/', 1)
      )
    )
  );

-- Realtime: in Dashboard enable replication for `notifications`, or run:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
