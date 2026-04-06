-- Add missing DELETE RLS policy for encouragement_taps
-- Only the sender can delete their own taps
CREATE POLICY "taps_delete" ON encouragement_taps
  FOR DELETE TO authenticated USING (
    sender_id = (SELECT get_user_id())
  );
