-- Migration: Refine RLS policies for profiles and user_preferences
-- Issue: #287
-- Depends on: #41 (get_user_id() helper and initial RLS policies)
-- Reference: ADR-005, ADR-012
--
-- Changes from initial policies (#41):
--   profiles:
--     - SELECT uses get_user_id() instead of auth.uid() for consistency
--     - UPDATE restricted to display_name, username, avatar_url columns
--     - INSERT removed (handled by signup trigger via service_role)
--     - DELETE removed (handled by GDPR endpoint via service_role)
--   user_preferences:
--     - FOR ALL replaced with granular SELECT, UPDATE, INSERT (no DELETE)

-- ============================================================================
-- profiles: Drop existing policies and recreate with refinements
-- ============================================================================

-- Drop the broad policies created in migration 000006
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

-- Users can SELECT their own profile row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT get_user_id()));

-- Users can UPDATE only display_name, username, avatar_url on their own row
-- The USING clause controls which rows are visible for update.
-- The WITH CHECK clause ensures the updated row still satisfies the condition.
-- Column restriction is not enforceable via RLS alone — the API layer (ADR-007)
-- validates which columns are accepted. RLS ensures row-level ownership.
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT get_user_id()))
  WITH CHECK (id = (SELECT get_user_id()));

-- No INSERT policy: profile creation is handled by the signup trigger (service_role)
-- No DELETE policy: account deletion is handled by GDPR endpoint (service_role)

-- ============================================================================
-- user_preferences: Drop FOR ALL and replace with granular policies
-- ============================================================================

DROP POLICY IF EXISTS "prefs_all_own" ON user_preferences;

-- Users can SELECT their own preferences
CREATE POLICY "prefs_select_own" ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = (SELECT get_user_id()));

-- Users can UPDATE their own preferences
CREATE POLICY "prefs_update_own" ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT get_user_id()))
  WITH CHECK (user_id = (SELECT get_user_id()));

-- Users can INSERT their own preferences (first-time setup)
CREATE POLICY "prefs_insert_own" ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT get_user_id()));
