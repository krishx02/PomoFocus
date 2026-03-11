---
title: "[0.3] Configure supabase gen types script in packages/types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

A `gen:types` script in `packages/types/package.json` runs `supabase gen types typescript` and outputs to `packages/types/src/database.ts`. The generated file is committed and importable.

## Context & Background

Phase 0, sub-item 0.3 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #002 (packages/types stub) and #018 (all tables with RLS exist for type generation).

The schema is the source of truth for `packages/types/`. Types are auto-generated — never manually edited. The generation script must be runnable as an Nx target so CI can verify type drift.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — packages/types is auto-generated from Postgres schema. Never edit manually.
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Run `supabase gen types` after any schema change.

## Affected Files

- `packages/types/package.json` — Add `gen:types` script
- `packages/types/src/database.ts` — Generated output (committed to repo)
- `packages/types/project.json` — Add Nx `gen` target for the script

## Acceptance Criteria

- [ ] `pnpm nx run @pomofocus/types:gen` produces `packages/types/src/database.ts`
- [ ] Generated file contains TypeScript types for all 12 tables and 9 enums
- [ ] Generated file compiles without errors
- [ ] `import type { Database } from '@pomofocus/types'` works from downstream packages

## Out of Scope

- Do NOT create barrel exports for individual types — issue #021
- Do NOT set up Swift type generation — post-v1

## Test Plan

```bash
pnpm nx run @pomofocus/types:gen
pnpm nx type-check @pomofocus/types
```

## Platform

Shared/Cross-platform
