-- Migration: Correct RLS policies for social tables
-- Issue: #291
-- Depends on: #41 (initial RLS policies in 20260311000006)
-- Reference: ADR-005, ADR-018, ADR-012
--
-- Fixes:
--   1. friend_requests DELETE: restrict to sender only (was sender OR recipient)
--   2. friendships: remove direct INSERT/DELETE (managed by accept/unfriend functions)
--   3. encouragement_taps SELECT: allow sender OR recipient (was recipient only)
--   4. encouragement_taps INSERT: remove RLS friendship check (enforced in API per ADR-018)

-- ---- friend_requests: restrict DELETE to sender only ----

DROP POLICY "fr_delete" ON friend_requests;

CREATE POLICY "fr_delete" ON friend_requests
  FOR DELETE TO authenticated USING (
    sender_id = (SELECT get_user_id())
  );

-- ---- friendships: remove direct INSERT/DELETE (managed by DB functions) ----

DROP POLICY "friendships_insert" ON friendships;
DROP POLICY "friendships_delete_own" ON friendships;

-- ---- encouragement_taps: allow both sender and recipient to SELECT ----

DROP POLICY "taps_select_received" ON encouragement_taps;

CREATE POLICY "taps_select" ON encouragement_taps
  FOR SELECT TO authenticated USING (
    sender_id = (SELECT get_user_id()) OR recipient_id = (SELECT get_user_id())
  );

-- ---- encouragement_taps: simplify INSERT (friendship enforced in API per ADR-018) ----

DROP POLICY "taps_insert" ON encouragement_taps;

CREATE POLICY "taps_insert" ON encouragement_taps
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = (SELECT get_user_id())
  );
