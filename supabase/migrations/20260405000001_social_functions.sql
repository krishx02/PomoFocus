-- Migration: Social helper functions and friendship-pair trigger
-- Issue: #417
-- Depends on: #40 (social tables in 20260311000005), #41 (get_user_id() in 20260311000006)
-- Reference: ADR-005, ADR-018, research/designs/database-schema-data-model.md
--
-- Adds the three helper functions required by the social schema:
--   1. create_friendship_pair() — trigger function that inserts dual friendship
--      rows and deletes the friend_request when status transitions 'pending' -> 'accepted'.
--   2. is_friend_focusing(friend_profile_id) — integration test helper. Per ADR-018,
--      production API endpoints enforce privacy via friendship JOINs. Not called from
--      production code paths.
--   3. did_friend_focus_today(friend_profile_id) — same as above.

-- ---- create_friendship_pair trigger function ----

CREATE OR REPLACE FUNCTION create_friendship_pair()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO friendships (user_id, friend_id) VALUES (NEW.sender_id, NEW.recipient_id);
    INSERT INTO friendships (user_id, friend_id) VALUES (NEW.recipient_id, NEW.sender_id);
    DELETE FROM friend_requests WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_create_friendship_pair
  AFTER UPDATE ON friend_requests FOR EACH ROW EXECUTE FUNCTION create_friendship_pair();

-- ---- is_friend_focusing (Library Mode integration test helper) ----

CREATE OR REPLACE FUNCTION is_friend_focusing(friend_profile_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions
    WHERE user_id = friend_profile_id AND ended_at IS NULL
  )
  AND friend_profile_id IN (
    SELECT friend_id FROM friendships WHERE user_id = get_user_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- did_friend_focus_today (Quiet Feed integration test helper) ----

CREATE OR REPLACE FUNCTION did_friend_focus_today(friend_profile_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions
    WHERE user_id = friend_profile_id
      AND completed = true
      AND started_at::date = CURRENT_DATE
  )
  AND friend_profile_id IN (
    SELECT friend_id FROM friendships WHERE user_id = get_user_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
