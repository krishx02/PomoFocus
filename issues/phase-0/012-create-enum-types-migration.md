---
title: "[0.2] Create enum types migration (9 enums)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates all 9 Postgres enum types used across the schema: `goal_status`, `recurrence_type`, `abandonment_reason`, `focus_quality`, `distraction_type`, `break_type`, `break_usefulness`, `request_status`, `sync_direction`.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #011 — Supabase project must be initialized first.

Enums must be created before any table that references them. This migration is deliberately separate from table migrations so that enum changes can be tracked independently.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Use Postgres ENUM types for fixed domain values, never store enum strings as plain text.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact enum value lists.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_enums.sql` — Create migration with all 9 enum types

## Acceptance Criteria

- [ ] Migration file exists in `supabase/migrations/`
- [ ] All 9 enum types are defined:
  - `goal_status` — `'active'`, `'completed'`, `'retired'`
  - `recurrence_type` — `'daily'`, `'weekly'`
  - `abandonment_reason` — `'had_to_stop'`, `'gave_up'`
  - `focus_quality` — `'locked_in'`, `'decent'`, `'struggled'`
  - `distraction_type` — `'phone'`, `'people'`, `'thoughts_wandering'`, `'got_stuck'`, `'other'`
  - `break_type` — `'short'`, `'long'`
  - `break_usefulness` — `'yes'`, `'somewhat'`, `'no'`
  - `request_status` — `'pending'`, `'accepted'`, `'declined'`
  - `sync_direction` — `'up'`, `'down'`
- [ ] `supabase db push` applies the migration without error (or `supabase db reset` on local)

## Out of Scope

- Do NOT create any tables — issues #013-#017
- Do NOT create RLS policies — issue #018

## Test Plan

```bash
supabase db reset
# Verify enums exist:
supabase db lint
```

## Platform

Infrastructure
