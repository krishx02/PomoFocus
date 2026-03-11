---
title: "[0.2] Initialize Supabase project and config"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A Supabase project is initialized with `supabase/config.toml`, `.env.example` for Supabase URL and keys (actual `.env` gitignored), and the Supabase CLI is configured for local development.

## Context & Background

Phase 0, sub-item 0.2 of the [MVP Roadmap](../../research/mvp-roadmap.md).

This sets up the Supabase project structure locally. The actual database tables are created in subsequent migration issues (#012-#017). The Supabase CLI enables `supabase db push`, `supabase gen types`, and local development with `supabase start`.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Database schema, conventions (timestamptz, UUID PKs, hard deletes, RLS).

## Affected Files

- `supabase/config.toml` — Create Supabase project configuration
- `.env.example` — Template with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` placeholders
- `.gitignore` — Ensure `.env` is gitignored (should already be, verify)
- `package.json` — Add `supabase` as devDependency at root

## Acceptance Criteria

- [ ] `supabase/config.toml` exists with valid project configuration
- [ ] `.env.example` lists all required Supabase environment variables
- [ ] `.env` is listed in `.gitignore`
- [ ] `npx supabase --version` runs without error
- [ ] `supabase/migrations/` directory exists (empty initially)

## Out of Scope

- Do NOT create any database tables — issues #012-#017
- Do NOT set up remote Supabase project (dashboard setup is manual)

## Test Plan

```bash
npx supabase --version
test -f supabase/config.toml && echo "config exists" || echo "MISSING"
test -d supabase/migrations && echo "migrations dir exists" || echo "MISSING"
grep ".env" .gitignore
```

## Platform

Infrastructure
