---
title: "[0.1] Scaffold packages/analytics stub"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/analytics/` exists as an Nx library importable as `@pomofocus/analytics`, with dependencies on `@pomofocus/types` and `@pomofocus/core` only.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

`packages/analytics/` contains component metrics (completion rate, focus quality, consistency, streaks, trends) and insight computation. Pure functions only — no IO, no React, no Supabase.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Analytics depends on types and core only.
- [ADR-014](../../research/decisions/014-analytics-insights-architecture.md) — Individual component metrics with trend arrows, no composite Focus Score.

## Affected Files

- `packages/analytics/package.json` — Create with `name: "@pomofocus/analytics"`
- `packages/analytics/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/analytics/tsconfig.lib.json` — Library-specific TS config
- `packages/analytics/src/index.ts` — Barrel export (placeholder)
- `packages/analytics/project.json` — Nx project with tags `type:domain, scope:shared` (same type tag as core — both are pure domain logic)

## Acceptance Criteria

- [ ] `packages/analytics/package.json` exists with `"name": "@pomofocus/analytics"`
- [ ] `@pomofocus/analytics` is resolvable via TypeScript path aliases
- [ ] Nx project has tags `["type:domain", "scope:shared"]` (per `coding-standards-eslint-nx.md` Section 4)
- [ ] `pnpm nx type-check @pomofocus/analytics` passes

## Out of Scope

- Do NOT implement any analytics functions — those come in Phase 5

## Test Plan

```bash
pnpm nx type-check @pomofocus/analytics
```

## Platform

Shared/Cross-platform
