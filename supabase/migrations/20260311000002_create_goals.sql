-- Migration: Create long_term_goals and process_goals tables
-- Issue: #37
-- Depends on: #35 (enum types), #36 (profiles table)
-- Reference: ADR-005, research/designs/database-schema-data-model.md

-- ---- Helper function for updated_at triggers ----

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---- long_term_goals ----

CREATE TABLE long_term_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      goal_status NOT NULL DEFAULT 'active',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- process_goals ----

CREATE TABLE process_goals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  long_term_goal_id       uuid NOT NULL REFERENCES long_term_goals (id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title                   text NOT NULL,
  target_sessions_per_day integer NOT NULL DEFAULT 1,
  recurrence              recurrence_type NOT NULL DEFAULT 'daily',
  status                  goal_status NOT NULL DEFAULT 'active',
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---- Indexes ----

CREATE INDEX idx_long_term_goals_user_id ON long_term_goals (user_id);
CREATE INDEX idx_long_term_goals_user_active ON long_term_goals (user_id) WHERE status = 'active';

CREATE INDEX idx_process_goals_user_id ON process_goals (user_id);
CREATE INDEX idx_process_goals_long_term ON process_goals (long_term_goal_id);
CREATE INDEX idx_process_goals_user_active ON process_goals (user_id) WHERE status = 'active';

-- ---- Triggers ----

CREATE TRIGGER tr_long_term_goals_updated_at
  BEFORE UPDATE ON long_term_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_process_goals_updated_at
  BEFORE UPDATE ON process_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
