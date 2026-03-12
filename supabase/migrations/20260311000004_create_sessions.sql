-- Migration: Create sessions and breaks tables
-- Issue: #38
-- Depends on: #35 (enums), #36 (profiles), #37 (goals), #39 (devices)
-- Reference: ADR-005, research/designs/database-schema-data-model.md

-- ---- sessions ----

CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  process_goal_id    uuid NOT NULL REFERENCES process_goals (id) ON DELETE CASCADE,
  intention_text     text,
  started_at         timestamptz NOT NULL,
  ended_at           timestamptz,
  completed          boolean NOT NULL DEFAULT false,
  abandonment_reason abandonment_reason,
  focus_quality      focus_quality,
  distraction_type   distraction_type,
  device_id          uuid REFERENCES devices (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ---- breaks ----

CREATE TABLE breaks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL UNIQUE REFERENCES sessions (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type        break_type NOT NULL,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,
  usefulness  break_usefulness,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Indexes ----

CREATE INDEX idx_sessions_user_started ON sessions (user_id, started_at);
CREATE INDEX idx_sessions_process_goal ON sessions (process_goal_id);
CREATE INDEX idx_sessions_active ON sessions (user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_sessions_device ON sessions (device_id) WHERE device_id IS NOT NULL;

CREATE INDEX idx_breaks_user ON breaks (user_id);
-- breaks(session_id) UNIQUE constraint already creates a unique index

-- No updated_at triggers — sessions and breaks are append-only

-- Enable RLS (default-deny until policies are added in #41)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
