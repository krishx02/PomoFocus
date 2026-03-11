---
title: "[0.2] Create devices and device_sync_log tables migration"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase migration creates the `devices` and `device_sync_log` tables for BLE device registration and incremental sync tracking.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #013 — Profiles table must exist first (FK references).

These tables support BLE device sync (Phase 7). The `devices` table registers physical devices; `device_sync_log` tracks incremental sync progress per entity. Creating these now ensures the schema is complete for type generation.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Device registration and sync log schema.
- [ADR-013](../../research/decisions/013-ble-gatt-protocol-design.md) — BLE sync requires incremental tracking.

**Referenced design docs:**
- [Database Schema Design](../../research/designs/database-schema-data-model.md) — Exact column definitions.

## Affected Files

- `supabase/migrations/YYYYMMDDHHMMSS_create_devices.sql` — Create migration

## Acceptance Criteria

- [ ] `devices` table: `id` (uuid PK), `user_id` (uuid FK to profiles), `device_name` (text NOT NULL), `hardware_id` (text UNIQUE NOT NULL), `last_synced_at` (timestamptz nullable), `created_at`, `updated_at`
- [ ] `device_sync_log` table: `id` (uuid PK), `device_id` (uuid FK to devices), `direction` (sync_direction NOT NULL), `entity_type` (text NOT NULL), `entity_id` (uuid NOT NULL), `synced_at` (timestamptz DEFAULT now())
- [ ] `supabase db reset` applies without error

## Out of Scope

- Do NOT create RLS policies — issue #018
- Do NOT implement BLE sync logic — Phase 7

## Test Plan

```bash
supabase db reset
```

## Platform

Infrastructure
