---
title: "[0.3] Verify type imports from downstream packages"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

A verification test in `packages/core/` confirms that types from `@pomofocus/types` are importable and that TypeScript path aliases resolve correctly across the monorepo dependency chain.

## Context & Background

Phase 0, sub-item 0.3 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #021 — Barrel exports must exist first.

This is the final validation of the type generation pipeline. If `packages/core` can import types from `@pomofocus/types`, the entire downstream chain (core -> data-access -> state -> apps) will work.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Import direction and TypeScript path alias configuration.

## Affected Files

- `packages/core/src/type-check.ts` — Create a simple file that imports types from `@pomofocus/types` (can be deleted after verification, or kept as a smoke test)

## Acceptance Criteria

- [ ] `import type { Session, Profile, GoalStatus } from '@pomofocus/types'` compiles in `packages/core/`
- [ ] `pnpm nx type-check @pomofocus/core` passes
- [ ] `pnpm nx type-check` passes for all packages (no type errors introduced)

## Out of Scope

- Do NOT verify imports from other packages (state, data-access) — they follow the same pattern

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
pnpm nx run-many --target=type-check
```

## Platform

Shared/Cross-platform
