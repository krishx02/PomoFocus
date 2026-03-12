---
title: "[0.7] Scaffold packages/core/src/session/ module with placeholder types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "enhancement"]
---

## Goal

`packages/core/src/session/` exists with `index.ts` barrel export and placeholder types for session domain logic (session lifecycle, reflection data), importable from `@pomofocus/core`.

## Context & Background

Phase 0, sub-item 0.7 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #003 (packages/core stub) and #021 (type barrel exports from types package).

The session module contains business logic for session lifecycle — creating sessions, associating with goals, recording reflection data, computing duration. At this stage, only placeholder types are needed.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Session stores 8 data points, reflection fields, intention text (200 char max).
- [ADR-004](../../research/decisions/004-timer-state-machine.md) — Session lifecycle is driven by timer state transitions.
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Core module structure.

## Affected Files

- `packages/core/src/session/index.ts` — Barrel export
- `packages/core/src/session/types.ts` — Placeholder types: `SessionData` (pre-persistence shape), `ReflectionData` (focus quality, distraction type, notes)
- `packages/core/src/index.ts` — Re-export session module

## Acceptance Criteria

- [ ] `packages/core/src/session/` directory exists
- [ ] Placeholder types defined: `SessionData`, `ReflectionData`
- [ ] `import type { SessionData } from '@pomofocus/core'` compiles
- [ ] `pnpm nx type-check @pomofocus/core` passes
- [ ] `pnpm nx build @pomofocus/core` passes

## Out of Scope

- Do NOT implement session creation logic — Phase 1
- Do NOT implement reflection flow — Phase 3

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
```

## Platform

Shared/Cross-platform
