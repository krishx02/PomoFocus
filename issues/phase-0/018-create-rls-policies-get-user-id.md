---
title: "[0.2] Create get_user_id() helper function and skeleton RLS policies"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

The `get_user_id()` SQL helper function is created, RLS is enabled on all 11 application tables, and skeleton RLS policies (SELECT/INSERT/UPDATE/DELETE using `get_user_id()`) are applied to all user-owned tables.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #013-#017 — All tables must exist first.

RLS is defense-in-depth (ADR-012). Every table must have RLS enabled. The `get_user_id()` function provides a clean path from `auth.uid()` to `profiles.id` — all policies use this instead of inlining the lookup. Social tables have bidirectional policies (sender and recipient).

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — RLS on every table, `get_user_id()` helper.
- [ADR-012](../../research/decisions/012-security-data-privacy.md) — RLS as defense-in-depth.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — RLS policy patterns.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_rls_policies.sql` — Create migration with get_user_id() and all RLS policies

## Acceptance Criteria

- [ ] `get_user_id()` function created with exact signature: `CREATE OR REPLACE FUNCTION get_user_id() RETURNS uuid AS $$ SELECT id FROM profiles WHERE auth_user_id = auth.uid() $$ LANGUAGE sql SECURITY DEFINER STABLE;`
- [ ] RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) on all 11 application tables (auth.users is Supabase-managed): profiles, user_preferences, long_term_goals, process_goals, sessions, breaks, devices, device_sync_log, friend_requests, friendships, encouragement_taps
- [ ] User-owned tables (profiles, user_preferences, long_term_goals, process_goals, sessions, breaks, devices, device_sync_log) have policies using `user_id = get_user_id()`
- [ ] Social tables (friend_requests, friendships, encouragement_taps) have bidirectional policies allowing access where user is sender OR recipient
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT implement fine-grained social visibility rules (API-level enforcement) — Phase 8
- Do NOT write integration tests for RLS isolation — Phase 2

## Test Plan

```bash
supabase db reset
supabase db lint
```

## Platform

Infrastructure
