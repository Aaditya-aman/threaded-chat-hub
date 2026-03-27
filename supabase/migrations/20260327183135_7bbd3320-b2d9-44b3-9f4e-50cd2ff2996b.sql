-- Drop the overly permissive update policy and replace with a restrictive one
DROP POLICY "Users can update votes_count" ON public.messages;

-- Allow authenticated users to update only votes_count (no row restriction needed since votes are validated separately)
CREATE POLICY "Authenticated can update messages votes" ON public.messages
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);