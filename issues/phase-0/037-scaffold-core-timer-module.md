---
title: "[0.7] Scaffold packages/core/src/timer/ module with placeholder types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "enhancement"]
---

## Goal

`packages/core/src/timer/` exists with `index.ts` barrel export and placeholder types for timer state (`TimerState`), timer events (`TimerEvent`), and the transition function signature, importable as `@pomofocus/core/timer`.

## Context & Background

Phase 0, sub-item 0.7 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #003 (packages/core stub) and #021 (type barrel exports from types package).

The timer is the core of the entire product. This issue creates the module skeleton with placeholder types that define the shape of the API. The actual state machine implementation comes in Phase 1 (issue 1.1). The placeholder types should match the ADR-004 design: 9 states as a discriminated union, events, and a pure `transition(state, event) -> newState` function signature.

**Referenced ADRs:**
- [ADR-004](../../research/decisions/004-timer-state-machine.md) — Timer states: idle, focusing, paused, short_break, long_break, break_paused, reflection, completed, abandoned. Pure transition function.
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Core module structure.

## Affected Files

- `packages/core/src/timer/index.ts` — Barrel export
- `packages/core/src/timer/types.ts` — Placeholder `TimerState` discriminated union, `TimerEvent` union, `TimerConfig` type
- `packages/core/src/index.ts` — Re-export timer module

## Acceptance Criteria

- [ ] `packages/core/src/timer/` directory exists
- [ ] `TimerState` type is defined as a discriminated union with `status` field covering 9 states
- [ ] `TimerEvent` type is defined as a union of event types
- [ ] `TimerConfig` type is defined with `workDurationMinutes`, `shortBreakMinutes`, `longBreakMinutes`, `sessionsBeforeLongBreak`
- [ ] `import { TimerState } from '@pomofocus/core/timer'` compiles (or `import { TimerState } from '@pomofocus/core'`)
- [ ] `pnpm nx type-check @pomofocus/core` passes

## Out of Scope

- Do NOT implement the transition function — Phase 1
- Do NOT implement guard functions — Phase 1
- Do NOT add tests (no logic to test yet)

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
```

## Platform

Shared/Cross-platform
