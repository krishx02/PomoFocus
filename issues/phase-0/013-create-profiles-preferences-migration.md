---
title: "[0.2] Create profiles and user_preferences tables migration"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates the `profiles` and `user_preferences` tables with all columns, constraints, foreign keys, and defaults as specified in the database design doc.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #012 — Enum types must exist first (user_preferences references no enums, but maintaining order).

These are the foundational user tables. Every other table references `profiles.id` via foreign key. `user_preferences` stores timer configuration (work duration, break duration, etc.).

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — UUID PKs, timestamptz, hard deletes.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact column definitions for both tables.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_profiles.sql` — Create migration

## Acceptance Criteria

- [ ] `profiles` table created with columns: `id` (uuid PK), `auth_user_id` (uuid UNIQUE FK to auth.users), `display_name` (text NOT NULL), `username` (text UNIQUE NOT NULL), `avatar_url` (text nullable), `created_at` (timestamptz), `updated_at` (timestamptz)
- [ ] `user_preferences` table created with columns: `id` (uuid PK), `user_id` (uuid UNIQUE FK to profiles ON DELETE CASCADE), `work_duration_minutes` (int4 DEFAULT 25), `short_break_minutes` (int4 DEFAULT 5), `long_break_minutes` (int4 DEFAULT 15), `sessions_before_long_break` (int4 DEFAULT 4), `reflection_enabled` (bool DEFAULT true), `timezone` (text DEFAULT 'UTC'), `created_at`, `updated_at`
- [ ] All PKs use `gen_random_uuid()` default
- [ ] All timestamps use `timestamptz`
- [ ] Indexes created per design doc: UNIQUE on `profiles.auth_user_id`, UNIQUE on `profiles.username`
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT create RLS policies — issue #018
- Do NOT create trigger functions for `updated_at` auto-update (can be deferred)

## Test Plan

```bash
supabase db reset
```

## Platform

Infrastructure
