-- Migration: Granular RLS policies for devices and device_sync_log
-- Issue: #290
-- Depends on: #41 (get_user_id() helper and initial RLS policies)
-- Reference: ADR-005, ADR-012, ADR-013

-- Drop the broad FOR ALL policies created in 20260311000006
DROP POLICY IF EXISTS "devices_all_own" ON devices;
DROP POLICY IF EXISTS "sync_log_all_own" ON device_sync_log;

-- ---- devices (per-operation policies) ----

-- SELECT: users can see their own devices
CREATE POLICY "devices_select_own" ON devices
  FOR SELECT TO authenticated USING (user_id = (SELECT get_user_id()));

-- INSERT: enforces user_id = get_user_id() — prevents registering under another user
CREATE POLICY "devices_insert_own" ON devices
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT get_user_id()));

-- UPDATE: users can update their own devices
CREATE POLICY "devices_update_own" ON devices
  FOR UPDATE TO authenticated USING (user_id = (SELECT get_user_id()));

-- DELETE: users can delete their own devices
CREATE POLICY "devices_delete_own" ON devices
  FOR DELETE TO authenticated USING (user_id = (SELECT get_user_id()));

-- ---- device_sync_log (SELECT + INSERT only — no UPDATE/DELETE needed) ----

-- SELECT: users can see sync logs for their own devices
CREATE POLICY "sync_log_select_own" ON device_sync_log
  FOR SELECT TO authenticated USING (
    device_id IN (SELECT id FROM devices WHERE user_id = (SELECT get_user_id()))
  );

-- INSERT: users can create sync logs for their own devices
CREATE POLICY "sync_log_insert_own" ON device_sync_log
  FOR INSERT TO authenticated WITH CHECK (
    device_id IN (SELECT id FROM devices WHERE user_id = (SELECT get_user_id()))
  );
