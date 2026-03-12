-- Migration: Create profiles and user_preferences tables
-- Issue: #36
-- Depends on: #35 (enum types)
-- Reference: ADR-005, research/designs/database-schema-data-model.md

-- ---- profiles ----

CREATE TABLE profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  username      text NOT NULL UNIQUE,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- user_preferences ----

CREATE TABLE user_preferences (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  work_duration_minutes       integer NOT NULL DEFAULT 25,
  short_break_minutes         integer NOT NULL DEFAULT 5,
  long_break_minutes          integer NOT NULL DEFAULT 15,
  sessions_before_long_break  integer NOT NULL DEFAULT 4,
  reflection_enabled          boolean NOT NULL DEFAULT true,
  timezone                    text NOT NULL DEFAULT 'UTC',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
