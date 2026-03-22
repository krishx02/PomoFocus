-- Migration: Replace FOR ALL goals policies with per-operation RLS policies
-- Issue: #288
-- Depends on: #41 (get_user_id() helper and skeleton RLS)
-- Reference: ADR-005, ADR-012
--
-- Replaces the broad FOR ALL policies on long_term_goals and process_goals
-- with explicit per-operation policies. INSERT uses WITH CHECK to prevent
-- users from inserting goals with another user's user_id.

-- ---- Drop existing FOR ALL policies ----

DROP POLICY IF EXISTS "ltg_all_own" ON long_term_goals;
DROP POLICY IF EXISTS "pg_all_own" ON process_goals;

-- ---- long_term_goals: per-operation policies ----

CREATE POLICY "ltg_select_own" ON long_term_goals
  FOR SELECT TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "ltg_insert_own" ON long_term_goals
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT get_user_id()));

CREATE POLICY "ltg_update_own" ON long_term_goals
  FOR UPDATE TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "ltg_delete_own" ON long_term_goals
  FOR DELETE TO authenticated USING (user_id = (SELECT get_user_id()));

-- ---- process_goals: per-operation policies ----

CREATE POLICY "pg_select_own" ON process_goals
  FOR SELECT TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "pg_insert_own" ON process_goals
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT get_user_id()));

CREATE POLICY "pg_update_own" ON process_goals
  FOR UPDATE TO authenticated USING (user_id = (SELECT get_user_id()));

CREATE POLICY "pg_delete_own" ON process_goals
  FOR DELETE TO authenticated USING (user_id = (SELECT get_user_id()));
