-- Migration: Replace FOR ALL policies on sessions/breaks with per-operation policies
-- Issue: #289
-- Depends on: #41 (get_user_id() helper and skeleton RLS policies)
-- Reference: ADR-005, ADR-012, ADR-018

-- ============================================================
-- Drop existing FOR ALL policies (created in migration 000006)
-- ============================================================

DROP POLICY IF EXISTS "sessions_all_own" ON sessions;
DROP POLICY IF EXISTS "breaks_all_own" ON breaks;

-- ============================================================
-- sessions — per-operation policies using (SELECT get_user_id())
-- ============================================================

-- RLS is already enabled (migration 000004). Re-stating for safety.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT get_user_id()));

CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT get_user_id()));

CREATE POLICY "sessions_update_own" ON sessions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT get_user_id()));

CREATE POLICY "sessions_delete_own" ON sessions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT get_user_id()));

-- ============================================================
-- breaks — per-operation policies using (SELECT get_user_id())
-- ============================================================

-- RLS is already enabled (migration 000004). Re-stating for safety.
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breaks_select_own" ON breaks
  FOR SELECT TO authenticated
  USING (user_id = (SELECT get_user_id()));

CREATE POLICY "breaks_insert_own" ON breaks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT get_user_id()));

CREATE POLICY "breaks_update_own" ON breaks
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT get_user_id()));

CREATE POLICY "breaks_delete_own" ON breaks
  FOR DELETE TO authenticated
  USING (user_id = (SELECT get_user_id()));
