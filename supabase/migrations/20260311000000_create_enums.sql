-- Migration: Create all 9 Postgres enum types
-- Issue: #35
-- Depends on: #34 (Supabase project initialization)
-- Reference: ADR-005, research/designs/database-schema-data-model.md

CREATE TYPE goal_status AS ENUM ('active', 'completed', 'retired');
CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly');
CREATE TYPE abandonment_reason AS ENUM ('had_to_stop', 'gave_up');
CREATE TYPE focus_quality AS ENUM ('locked_in', 'decent', 'struggled');
CREATE TYPE distraction_type AS ENUM ('phone', 'people', 'thoughts_wandering', 'got_stuck', 'other');
CREATE TYPE break_type AS ENUM ('short', 'long');
CREATE TYPE break_usefulness AS ENUM ('yes', 'somewhat', 'no');
CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE sync_direction AS ENUM ('up', 'down');
