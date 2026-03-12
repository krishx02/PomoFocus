-- Migration: Create social tables (friend_requests, friendships, encouragement_taps)
-- Issue: #40
-- Depends on: #36 (profiles)
-- Reference: ADR-005, ADR-018, research/designs/database-schema-data-model.md

-- ---- friend_requests ----

CREATE TABLE friend_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  status       request_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, recipient_id),
  CHECK (sender_id != recipient_id)
);

-- ---- friendships ----

CREATE TABLE friendships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  friend_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- ---- encouragement_taps ----

CREATE TABLE encouragement_taps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id != recipient_id)
);

-- ---- Indexes ----

-- friend_requests: UNIQUE(sender_id, recipient_id) already creates a unique index
CREATE INDEX idx_friend_requests_recipient ON friend_requests (recipient_id);

-- friendships: UNIQUE(user_id, friend_id) already creates a unique index
CREATE INDEX idx_friendships_friend ON friendships (friend_id);

-- encouragement_taps
CREATE INDEX idx_taps_recipient ON encouragement_taps (recipient_id, created_at);
CREATE INDEX idx_taps_sender ON encouragement_taps (sender_id);

-- ---- Triggers ----

CREATE TRIGGER tr_friend_requests_updated_at
  BEFORE UPDATE ON friend_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS (default-deny until policies are added in #41)
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE encouragement_taps ENABLE ROW LEVEL SECURITY;
