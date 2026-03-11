---
title: "[0.7] Scaffold packages/core/src/sync/ module with placeholder types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "enhancement"]
---

## Goal

`packages/core/src/sync/` exists with `index.ts` barrel export and placeholder types for the sync FSM (queue states, sync events, retry policy), importable from `@pomofocus/core`.

## Context & Background

Phase 0, sub-item 0.7 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #003 (packages/core stub) and #021 (type barrel exports from types package).

The sync module contains the pure outbox queue state machine. Same pattern as the timer: pure `transition(queueState, event) -> newQueueState`. No IO, no network calls. The actual implementation comes in Phase 2.

**Referenced ADRs:**
- [ADR-006](../../research/decisions/006-offline-first-sync-architecture.md) — Custom outbox pattern, queue FSM, conflict rules, retry policy. Pure sync protocol in core, drivers in data-access.
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Core module structure.

## Affected Files

- `packages/core/src/sync/index.ts` — Barrel export
- `packages/core/src/sync/types.ts` — Placeholder types: `QueueItemState` (pending, uploading, uploaded, failed), `SyncEvent`, `RetryPolicy`
- `packages/core/src/index.ts` — Re-export sync module

## Acceptance Criteria

- [ ] `packages/core/src/sync/` directory exists
- [ ] Placeholder types defined: `QueueItemState` discriminated union, `SyncEvent` union, `RetryPolicy` config type
- [ ] `import type { QueueItemState } from '@pomofocus/core'` compiles
- [ ] `pnpm nx type-check @pomofocus/core` passes

## Out of Scope

- Do NOT implement sync state machine transitions — Phase 2
- Do NOT implement retry logic — Phase 2

## Test Plan

```bash
pnpm nx type-check @pomofocus/core
```

## Platform

Shared/Cross-platform
