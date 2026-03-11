---
title: "[0.1] Scaffold packages/types stub"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/types/` exists as an Nx library with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export, importable as `@pomofocus/types` from any downstream package.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

`packages/types/` is auto-generated from Postgres schema via `supabase gen types`. At this stage we only create the stub structure. The actual type generation is configured in issue #020.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Types package is the leaf dependency; all other packages import from it. Never edit manually once generation is configured.

## Affected Files

- `packages/types/package.json` — Create with `name: "@pomofocus/types"`, Nx project config
- `packages/types/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/types/tsconfig.lib.json` — Library-specific TS config
- `packages/types/src/index.ts` — Barrel export (placeholder: `export {}`)
- `packages/types/project.json` — Nx project configuration with `type:types` tag

## Acceptance Criteria

- [ ] `packages/types/package.json` exists with `"name": "@pomofocus/types"`
- [ ] `packages/types/src/index.ts` exists and compiles
- [ ] `@pomofocus/types` is resolvable via TypeScript path aliases in `tsconfig.base.json`
- [ ] Nx project has tag `type:types` for dependency constraint enforcement
- [ ] `pnpm nx build @pomofocus/types` passes (or `type-check` if no build target yet)

## Out of Scope

- Do NOT generate types from Supabase (issue #020)
- Do NOT create barrel exports for specific types (issue #021)

## Test Plan

```bash
pnpm nx type-check @pomofocus/types
```

## Platform

Shared/Cross-platform
