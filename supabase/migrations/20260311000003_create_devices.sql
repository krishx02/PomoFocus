-- Migration: Create devices and device_sync_log tables
-- Issue: #39
-- Depends on: #35 (enums), #36 (profiles)
-- Reference: ADR-005, research/designs/database-schema-data-model.md

-- ---- devices ----

CREATE TABLE devices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  device_name    text NOT NULL,
  hardware_id    text NOT NULL UNIQUE,
  last_synced_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---- device_sync_log ----

CREATE TABLE device_sync_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  direction   sync_direction NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  synced_at   timestamptz NOT NULL DEFAULT now()
);

-- ---- Indexes ----

CREATE INDEX idx_devices_user ON devices (user_id);
-- hardware_id UNIQUE constraint already creates a unique index
CREATE INDEX idx_device_sync_log_lookup ON device_sync_log (device_id, entity_type, entity_id);

-- ---- Triggers ----

CREATE TRIGGER tr_devices_updated_at
  BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS (default-deny until policies are added in #41)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sync_log ENABLE ROW LEVEL SECURITY;
