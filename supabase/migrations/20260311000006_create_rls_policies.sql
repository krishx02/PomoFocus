-- Migration: Create get_user_id() helper and skeleton RLS policies
-- Issue: #41
-- Depends on: #35-#40 (all tables must exist)
-- Reference: ADR-005, ADR-012, research/designs/database-schema-data-model.md

-- ---- get_user_id() helper ----

CREATE OR REPLACE FUNCTION get_user_id() RETURNS uuid AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- Missing updated_at triggers for profiles and user_preferences ----
-- (update_updated_at() was created in migration 000002 but these tables
--  were created in 000001 before the function existed)

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- profiles (uses auth.uid() directly, not get_user_id()) ----

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

-- Friends can see each other's profiles (needed for social features)
CREATE POLICY "profiles_select_friends" ON profiles
  FOR SELECT TO authenticated USING (
    id IN (SELECT friend_id FROM friendships WHERE user_id = (SELECT get_user_id()))
  );

-- Anyone can search profiles by username (for friend search)
CREATE POLICY "profiles_select_by_username" ON profiles
  FOR SELECT TO authenticated USING (username IS NOT NULL);

-- ---- user-owned tables (use (SELECT get_user_id()) per DB-006) ----

CREATE POLICY "prefs_all_own" ON user_preferences
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "ltg_all_own" ON long_term_goals
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "pg_all_own" ON process_goals
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "sessions_all_own" ON sessions
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "breaks_all_own" ON breaks
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "devices_all_own" ON devices
  FOR ALL TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "sync_log_all_own" ON device_sync_log
  FOR ALL TO authenticated USING (
    device_id IN (SELECT id FROM devices WHERE user_id = (SELECT get_user_id()))
  );

-- ---- friend_requests (per-operation to prevent sender_id spoofing) ----

CREATE POLICY "fr_select" ON friend_requests
  FOR SELECT TO authenticated USING (
    sender_id = (SELECT get_user_id()) OR recipient_id = (SELECT get_user_id())
  );

CREATE POLICY "fr_insert" ON friend_requests
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = (SELECT get_user_id())
  );

-- Only recipient can accept/decline
CREATE POLICY "fr_update" ON friend_requests
  FOR UPDATE TO authenticated USING (
    recipient_id = (SELECT get_user_id())
  );

-- Either party can withdraw/dismiss
CREATE POLICY "fr_delete" ON friend_requests
  FOR DELETE TO authenticated USING (
    sender_id = (SELECT get_user_id()) OR recipient_id = (SELECT get_user_id())
  );

-- ---- friendships (per-operation; dual-row pattern means user_id is always you) ----

CREATE POLICY "friendships_select_own" ON friendships
  FOR SELECT TO authenticated USING (
    user_id = (SELECT get_user_id())
  );

CREATE POLICY "friendships_insert" ON friendships
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT get_user_id())
  );

CREATE POLICY "friendships_delete_own" ON friendships
  FOR DELETE TO authenticated USING (
    user_id = (SELECT get_user_id())
  );

-- ---- encouragement_taps (per-operation with friendship check on insert) ----

-- Recipients see taps they received (senders don't see sent taps — fire and forget)
CREATE POLICY "taps_select_received" ON encouragement_taps
  FOR SELECT TO authenticated USING (
    recipient_id = (SELECT get_user_id())
  );

-- Can only send taps as yourself, and only to friends
CREATE POLICY "taps_insert" ON encouragement_taps
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = (SELECT get_user_id())
    AND recipient_id IN (
      SELECT friend_id FROM friendships WHERE user_id = (SELECT get_user_id())
    )
  );
