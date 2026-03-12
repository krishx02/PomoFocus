---
title: "[0.2] Create seed data script for local development"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A seed data SQL script exists at `supabase/seed.sql` that populates the local development database with representative test data across all tables.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #018 — All tables and RLS policies must exist first.

Seed data enables local development and manual testing without manually creating records. It should create at least 2 users with profiles, preferences, goals, sessions, and a friendship between them.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Schema structure for all tables.

## Affected Files

- `supabase/seed.sql` — Create seed data script
- `package.json` — Add `db:seed` script (optional convenience)

## Acceptance Criteria

- [ ] `supabase/seed.sql` exists and creates representative data
- [ ] At least 2 test user profiles with preferences
- [ ] At least 1 long-term goal with 2 process goals per user
- [ ] At least 3 sessions per user (mix of completed and abandoned)
- [ ] At least 1 friendship between the test users
- [ ] `supabase db reset` applies migrations and seed without error

## Notes

The seed script must insert test users into `auth.users` first (required for `profiles.auth_user_id` NOT NULL FK). This is standard practice for Supabase local development — `auth.users` is only "managed by Supabase Auth" in production. `supabase db reset` runs against a local Postgres instance where direct `auth.users` inserts are necessary and expected.

## Out of Scope

- Do NOT create test fixtures for automated tests (those belong in test files)

## Test Plan

```bash
supabase db reset
# seed.sql runs automatically after migrations during db reset
```

## Platform

Infrastructure
