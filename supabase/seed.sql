-- Seed data for local development
-- Runs automatically after migrations during `supabase db reset`
-- Reference: Issue #42

-- ============================================================================
-- Fixed UUIDs for reproducibility
-- ============================================================================

-- Auth user IDs (stub rows in auth.users for FK satisfaction)
-- These are NOT real Supabase Auth users — just FK targets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a1111111-1111-1111-1111-111111111111') THEN
    INSERT INTO auth.users (id, email, role, aud, created_at, updated_at)
    VALUES
      ('a1111111-1111-1111-1111-111111111111', 'alice@example.com', 'authenticated', 'authenticated', now(), now()),
      ('b2222222-2222-2222-2222-222222222222', 'bob@example.com', 'authenticated', 'authenticated', now(), now());
  END IF;
END $$;

-- Profile IDs
-- Alice: 'aaaa1111-0000-0000-0000-000000000001'
-- Bob:   'bbbb2222-0000-0000-0000-000000000002'

INSERT INTO profiles (id, auth_user_id, display_name, username)
VALUES
  ('aaaa1111-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'Alice', 'alice'),
  ('bbbb2222-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'Bob', 'bob')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- User Preferences
-- ============================================================================

INSERT INTO user_preferences (id, user_id, work_duration_minutes, short_break_minutes, long_break_minutes, sessions_before_long_break, timezone)
VALUES
  ('cccc0001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 30, 5, 20, 4, 'America/New_York'),
  ('cccc0002-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002', 25, 5, 15, 4, 'America/Los_Angeles')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Goals
-- ============================================================================

-- Alice: Long-term goal + 2 process goals
INSERT INTO long_term_goals (id, user_id, title, description, status)
VALUES
  ('dddd0001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'Ship PomoFocus MVP', 'Build and launch the first version', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO process_goals (id, long_term_goal_id, user_id, title, target_sessions_per_day, recurrence)
VALUES
  ('eeee0001-0000-0000-0000-000000000001', 'dddd0001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'Write backend code', 3, 'daily'),
  ('eeee0002-0000-0000-0000-000000000002', 'dddd0001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'Design UI screens', 2, 'daily')
ON CONFLICT (id) DO NOTHING;

-- Bob: Long-term goal + 2 process goals
INSERT INTO long_term_goals (id, user_id, title, description, status)
VALUES
  ('dddd0002-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002', 'Learn TypeScript', 'Master TS for professional use', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO process_goals (id, long_term_goal_id, user_id, title, target_sessions_per_day, recurrence)
VALUES
  ('eeee0003-0000-0000-0000-000000000003', 'dddd0002-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002', 'Read TS handbook', 2, 'daily'),
  ('eeee0004-0000-0000-0000-000000000004', 'dddd0002-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002', 'Practice coding exercises', 1, 'daily')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Sessions (spans last 7 days)
-- ============================================================================

-- Alice: 4 sessions (3 completed, 1 abandoned)
INSERT INTO sessions (id, user_id, process_goal_id, intention_text, started_at, ended_at, completed, focus_quality, distraction_type, abandonment_reason)
VALUES
  -- Completed: locked_in, 30 min
  ('ff000001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'eeee0001-0000-0000-0000-000000000001',
   'Implement session API endpoints', now() - interval '6 days 2 hours', now() - interval '6 days 1 hour 30 minutes', true,
   'locked_in', NULL, NULL),
  -- Completed: decent, 30 min
  ('ff000002-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', 'eeee0001-0000-0000-0000-000000000001',
   'Write database migrations', now() - interval '4 days 3 hours', now() - interval '4 days 2 hours 30 minutes', true,
   'decent', NULL, NULL),
  -- Completed: struggled with phone distraction, 25 min
  ('ff000003-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', 'eeee0002-0000-0000-0000-000000000002',
   'Design settings page', now() - interval '2 days 4 hours', now() - interval '2 days 3 hours 35 minutes', true,
   'struggled', 'phone', NULL),
  -- Abandoned: had_to_stop, 15 min in
  ('ff000004-0000-0000-0000-000000000004', 'aaaa1111-0000-0000-0000-000000000001', 'eeee0002-0000-0000-0000-000000000002',
   'Wireframe timer view', now() - interval '1 day 2 hours', now() - interval '1 day 1 hour 45 minutes', false,
   NULL, NULL, 'had_to_stop')
ON CONFLICT (id) DO NOTHING;

-- Bob: 3 sessions (2 completed, 1 abandoned)
INSERT INTO sessions (id, user_id, process_goal_id, intention_text, started_at, ended_at, completed, focus_quality, distraction_type, abandonment_reason)
VALUES
  -- Completed: decent, 25 min
  ('ff000005-0000-0000-0000-000000000005', 'bbbb2222-0000-0000-0000-000000000002', 'eeee0003-0000-0000-0000-000000000003',
   'Read generics chapter', now() - interval '5 days 1 hour', now() - interval '5 days 35 minutes', true,
   'decent', NULL, NULL),
  -- Completed: locked_in, 25 min
  ('ff000006-0000-0000-0000-000000000006', 'bbbb2222-0000-0000-0000-000000000002', 'eeee0004-0000-0000-0000-000000000004',
   'Solve advent of code problem', now() - interval '3 days 2 hours', now() - interval '3 days 1 hour 35 minutes', true,
   'locked_in', NULL, NULL),
  -- Abandoned: gave_up, 10 min in
  ('ff000007-0000-0000-0000-000000000007', 'bbbb2222-0000-0000-0000-000000000002', 'eeee0003-0000-0000-0000-000000000003',
   'Read utility types section', now() - interval '1 day 3 hours', now() - interval '1 day 2 hours 50 minutes', false,
   NULL, NULL, 'gave_up')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Breaks (one per completed session)
-- ============================================================================

INSERT INTO breaks (id, session_id, user_id, type, started_at, ended_at, usefulness)
VALUES
  -- Alice's breaks
  ('bb000001-0000-0000-0000-000000000001', 'ff000001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001',
   'short', now() - interval '6 days 1 hour 30 minutes', now() - interval '6 days 1 hour 25 minutes', 'yes'),
  ('bb000002-0000-0000-0000-000000000002', 'ff000002-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001',
   'short', now() - interval '4 days 2 hours 30 minutes', now() - interval '4 days 2 hours 25 minutes', 'somewhat'),
  ('bb000003-0000-0000-0000-000000000003', 'ff000003-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001',
   'long', now() - interval '2 days 3 hours 35 minutes', now() - interval '2 days 3 hours 20 minutes', 'yes'),
  -- Bob's breaks
  ('bb000004-0000-0000-0000-000000000004', 'ff000005-0000-0000-0000-000000000005', 'bbbb2222-0000-0000-0000-000000000002',
   'short', now() - interval '5 days 35 minutes', now() - interval '5 days 30 minutes', 'no'),
  ('bb000005-0000-0000-0000-000000000005', 'ff000006-0000-0000-0000-000000000006', 'bbbb2222-0000-0000-0000-000000000002',
   'short', now() - interval '3 days 1 hour 35 minutes', now() - interval '3 days 1 hour 30 minutes', 'yes')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Social: Friendship between Alice and Bob
-- ============================================================================

-- Friend request (accepted)
INSERT INTO friend_requests (id, sender_id, recipient_id, status)
VALUES
  ('1f000001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002', 'accepted')
ON CONFLICT (id) DO NOTHING;

-- Dual-row friendship pattern
INSERT INTO friendships (id, user_id, friend_id)
VALUES
  ('2f000001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002'),
  ('2f000002-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Encouragement tap: Alice tapped Bob
INSERT INTO encouragement_taps (id, sender_id, recipient_id)
VALUES
  ('3f000001-0000-0000-0000-000000000001', 'aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;
