---
title: "[0.1] Scaffold packages/core stub"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/core/` exists as an Nx library with `package.json`, `tsconfig.json`, and `src/index.ts` barrel export, importable as `@pomofocus/core` from downstream packages. It declares a dependency on `@pomofocus/types`.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

`packages/core/` contains pure domain logic (timer, goals, sessions, sync protocol). NO IO, NO React, NO Supabase imports are allowed. The module structure (timer/, goals/, sync/, session/) is created in issues #037-#040.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Core is pure domain logic, depends only on types. Never import data-access, state, or any app package.
- [ADR-004](../../research/decisions/004-timer-state-machine.md) — Timer state machine lives in core as pure functions.

## Affected Files

- `packages/core/package.json` — Create with `name: "@pomofocus/core"`, dependency on `@pomofocus/types`
- `packages/core/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/core/tsconfig.lib.json` — Library-specific TS config
- `packages/core/src/index.ts` — Barrel export (placeholder: `export {}`)
- `packages/core/project.json` — Nx project configuration with tags `type:domain, scope:shared`

## Acceptance Criteria

- [ ] `packages/core/package.json` exists with `"name": "@pomofocus/core"`
- [ ] `packages/core/src/index.ts` exists and compiles
- [ ] `@pomofocus/core` is resolvable via TypeScript path aliases
- [ ] Nx project has tags `["type:domain", "scope:shared"]` (per `coding-standards-eslint-nx.md` Section 4)
- [ ] `pnpm nx type-check @pomofocus/core` passes

## Out of Scope

- Do NOT create module subdirectories (timer/, goals/, etc.) — issues #037-#040
- Do NOT add any domain logic implementation

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
```

## Platform

Shared/Cross-platform
