---
title: "[0.2] Create social tables migration (friend_requests, friendships, encouragement_taps)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates the `friend_requests`, `friendships`, and `encouragement_taps` tables with all constraints including the dual-row friendship pattern and CHECK constraints.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #013 — Profiles table must exist first (FK references).

Social tables use a dual-row pattern for friendships: when A befriends B, both (A,B) and (B,A) rows are inserted. This simplifies RLS to `WHERE user_id = get_user_id()` and avoids OR conditions in queries.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Dual-row friendship pattern, CHECK constraints.
- [ADR-018](../../research/decisions/018-social-features-architecture.md) — Social features architecture, privacy enforcement.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact column definitions, UNIQUE and CHECK constraints.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_social.sql` — Create migration

## Acceptance Criteria

- [ ] `friend_requests` table: `id` (uuid PK), `sender_id` (uuid FK to profiles), `recipient_id` (uuid FK to profiles), `status` (request_status DEFAULT 'pending'), UNIQUE(sender_id, recipient_id), CHECK(sender_id != recipient_id), `created_at`, `updated_at`
- [ ] `friendships` table: `id` (uuid PK), `user_id` (uuid FK to profiles), `friend_id` (uuid FK to profiles), CHECK(user_id != friend_id), `created_at`
- [ ] `encouragement_taps` table: `id` (uuid PK), `sender_id` (uuid FK to profiles), `recipient_id` (uuid FK to profiles), `created_at`
- [ ] Indexes created per design doc: UNIQUE on `friend_requests(sender_id, recipient_id)`, `friend_requests(recipient_id)`, UNIQUE on `friendships(user_id, friend_id)`, `friendships(friend_id)`, `encouragement_taps(recipient_id, created_at)`, `encouragement_taps(sender_id)`
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT create RLS policies — issue #018
- Do NOT implement social API endpoints — Phase 8
- Do NOT create the dual-row trigger (application-level in Phase 8)

## Test Plan

```bash
supabase db reset
```

## Platform

Infrastructure
