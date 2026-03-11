---
title: "[0.2] Create sessions and breaks tables migration"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates the `sessions` and `breaks` tables with all columns, constraints, and foreign keys, including the 8 reflection data points on sessions.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #014 — Goals tables must exist first (sessions FK to process_goals).

Sessions are the core data entity. Each session stores 8 data points including post-session reflection (focus_quality, distraction_type, abandonment_reason). Breaks have a 1:1 relationship with sessions (UNIQUE constraint on session_id). Duration is computed, not stored.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Reflection data as columns on sessions (1:1, never joined separately). Duration computed via `EXTRACT(EPOCH FROM ended_at - started_at)`.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact column definitions, enum references.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_sessions.sql` — Create migration

## Acceptance Criteria

- [ ] `sessions` table: `id` (uuid PK), `user_id` (uuid FK to profiles), `process_goal_id` (uuid FK to process_goals), `intention_text` (text nullable), `started_at` (timestamptz NOT NULL), `ended_at` (timestamptz nullable), `completed` (bool DEFAULT false), `abandonment_reason` (abandonment_reason nullable), `focus_quality` (focus_quality nullable), `distraction_type` (distraction_type nullable), `device_id` (uuid FK to devices nullable), `created_at` (timestamptz)
- [ ] `breaks` table: `id` (uuid PK), `session_id` (uuid UNIQUE FK to sessions), `user_id` (uuid FK to profiles, denormalized), `type` (break_type NOT NULL), `started_at` (timestamptz NOT NULL), `ended_at` (timestamptz nullable), `usefulness` (break_usefulness nullable), `created_at` (timestamptz)
- [ ] Indexes created per design doc: `sessions(user_id, started_at)`, `sessions(process_goal_id)`, `sessions(user_id) WHERE ended_at IS NULL` (active sessions), `sessions(device_id) WHERE device_id IS NOT NULL`, `breaks(session_id)` UNIQUE, `breaks(user_id)`
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT create RLS policies — issue #018
- Do NOT implement session lifecycle logic — Phase 1

## Test Plan

```bash
supabase db reset
```

## Platform

Infrastructure
