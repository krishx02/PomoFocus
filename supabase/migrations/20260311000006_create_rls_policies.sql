-- Migration: Create get_user_id() helper and skeleton RLS policies
-- Issue: #41
-- Depends on: #35-#40 (all tables must exist)
-- Reference: ADR-005, ADR-012, research/designs/database-schema-data-model.md

-- ---- get_user_id() helper ----

CREATE OR REPLACE FUNCTION get_user_id() RETURNS uuid AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- profiles (uses auth.uid() directly, not get_user_id()) ----

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

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

-- ---- social tables (bidirectional: sender OR recipient) ----

CREATE POLICY "fr_all_own" ON friend_requests
  FOR ALL TO authenticated USING (
    sender_id = (SELECT get_user_id()) OR recipient_id = (SELECT get_user_id())
  );

CREATE POLICY "friendships_all_own" ON friendships
  FOR ALL TO authenticated USING (
    user_id = (SELECT get_user_id()) OR friend_id = (SELECT get_user_id())
  );

CREATE POLICY "taps_all_own" ON encouragement_taps
  FOR ALL TO authenticated USING (
    sender_id = (SELECT get_user_id()) OR recipient_id = (SELECT get_user_id())
  );
