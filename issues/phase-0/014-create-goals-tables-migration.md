---
title: "[0.2] Create long_term_goals and process_goals tables migration"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates the `long_term_goals` and `process_goals` tables with all columns, constraints, and foreign keys as specified in the database design doc.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #013 — Profiles table must exist first (FK references).

Goals use a two-level hierarchy: long-term goals contain process goals. Process goals have a denormalized `user_id` for RLS optimization. Both use the `goal_status` enum.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Three-layer goal hierarchy, denormalized user_id on process_goals for RLS.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact column definitions.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_goals.sql` — Create migration

## Acceptance Criteria

- [ ] `long_term_goals` table: `id` (uuid PK), `user_id` (uuid FK to profiles), `title` (text NOT NULL), `description` (text nullable), `status` (goal_status DEFAULT 'active'), `sort_order` (int4 DEFAULT 0), `created_at`, `updated_at`
- [ ] `process_goals` table: `id` (uuid PK), `long_term_goal_id` (uuid FK to long_term_goals), `user_id` (uuid FK to profiles, denormalized), `title` (text NOT NULL), `target_sessions_per_day` (int4 DEFAULT 1), `recurrence` (recurrence_type DEFAULT 'daily'), `status` (goal_status DEFAULT 'active'), `sort_order` (int4 DEFAULT 0), `created_at`, `updated_at`
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT create RLS policies — issue #018
- Do NOT implement streak calculation logic — Phase 2

## Test Plan

```bash
supabase db reset
```

## Platform

Infrastructure
