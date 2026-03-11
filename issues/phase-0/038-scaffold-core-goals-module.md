---
title: "[0.7] Scaffold packages/core/src/goals/ module with placeholder types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "enhancement"]
---

## Goal

`packages/core/src/goals/` exists with `index.ts` barrel export and placeholder types for goal domain logic (streak calculation, goal validation), importable from `@pomofocus/core`.

## Context & Background

Phase 0, sub-item 0.7 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #003 (packages/core stub) and #021 (type barrel exports from types package).

Goals are the second core domain object after sessions. This module will contain streak calculation logic, goal validation rules, and grace period handling. At this stage, only placeholder types are needed.

**Referenced ADRs:**
- [ADR-005](../../research/decisions/005-database-schema-data-model.md) — Goal hierarchy: long-term goals -> process goals -> session intentions. Streak: consecutive calendar days with 1-day grace period.
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Core module structure.

## Affected Files

- `packages/core/src/goals/index.ts` — Barrel export
- `packages/core/src/goals/types.ts` — Placeholder types: `StreakResult`, `GoalProgress`, function signatures
- `packages/core/src/index.ts` — Re-export goals module

## Acceptance Criteria

- [ ] `packages/core/src/goals/` directory exists
- [ ] Placeholder types defined: `StreakResult` (currentStreak, longestStreak, gracePeriodActive), `GoalProgress` (goalId, completedToday, target)
- [ ] `import type { StreakResult } from '@pomofocus/core'` compiles
- [ ] `pnpm nx type-check @pomofocus/core` passes

## Out of Scope

- Do NOT implement streak calculation — Phase 2
- Do NOT implement goal CRUD logic — Phase 2

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
```

## Platform

Shared/Cross-platform
