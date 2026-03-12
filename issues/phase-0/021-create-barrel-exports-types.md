---
title: "[0.3] Create barrel exports for commonly used types"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/types/src/index.ts` re-exports commonly used type aliases (Session, Profile, Goal, Break, etc.) extracted from the generated `database.ts`, providing ergonomic imports for downstream packages.

## Context & Background

Phase 0, sub-item 0.3 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #020 — Generated types must exist first.

The raw Supabase generated types use deeply nested paths like `Database['public']['Tables']['sessions']['Row']`. Barrel exports provide cleaner aliases: `import type { Session } from '@pomofocus/types'`.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Types package provides barrel exports for commonly used types.

## Affected Files

- `packages/types/src/index.ts` — Create type aliases and re-exports from database.ts

## Acceptance Criteria

- [ ] Type aliases exist for at least: `Profile`, `UserPreferences`, `LongTermGoal`, `ProcessGoal`, `Session`, `Break`, `Device`, `DeviceSyncLog`, `FriendRequest`, `Friendship`, `EncouragementTap`
- [ ] Enum value types are re-exported: `GoalStatus`, `RecurrenceType`, `AbandonmentReason`, `FocusQuality`, `DistractionType`, `BreakType`, `BreakUsefulness`, `RequestStatus`, `SyncDirection`
- [ ] `Database` type itself is re-exported
- [ ] `import type { Session } from '@pomofocus/types'` compiles in downstream packages
- [ ] `pnpm nx type-check @pomofocus/types` passes

## Out of Scope

- Do NOT add runtime values or functions — types package is types only
- Do NOT create insert/update type variants yet (add when needed)

## Test Plan

```bash
pnpm nx type-check @pomofocus/types
```

## Platform

Shared/Cross-platform
