---
title: "[0.1] Scaffold packages/state, packages/ui, and packages/ble-protocol stubs"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/state/`, `packages/ui/`, and `packages/ble-protocol/` exist as Nx libraries importable as `@pomofocus/state`, `@pomofocus/ui`, and `@pomofocus/ble-protocol` respectively, each with correct dependency declarations and Nx tags.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

These three packages are grouped because they are all leaf-level consumers with minimal scaffolding needed at this stage:
- `packages/state/` — Zustand stores + TanStack Query hooks. Depends on core, data-access, types.
- `packages/ui/` — Shared React/RN components. Depends on types only.
- `packages/ble-protocol/` — BLE GATT profile, transport interface, Protobuf types. Isolated package.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Import direction: types <- core <- data-access/analytics <- state. UI depends on types only.
- [ADR-003](../../research/decisions/003-client-state-management.md) — State uses Zustand + TanStack Query.
- [ADR-013](../../research/decisions/013-ble-gatt-protocol-design.md) — BLE protocol types and transport interface.

## Affected Files

- `packages/state/package.json` — Create with `name: "@pomofocus/state"`, deps on types, core, data-access
- `packages/state/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/state/src/index.ts` — Barrel export (placeholder)
- `packages/state/project.json` — Nx project with tags `["type:state", "scope:shared"]`
- `packages/ui/package.json` — Create with `name: "@pomofocus/ui"`, dep on types only
- `packages/ui/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/ui/src/index.ts` — Barrel export (placeholder)
- `packages/ui/project.json` — Nx project with tags `["type:ui", "scope:shared"]`
- `packages/ble-protocol/package.json` — Create with `name: "@pomofocus/ble-protocol"`
- `packages/ble-protocol/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/ble-protocol/src/index.ts` — Barrel export (placeholder)
- `packages/ble-protocol/project.json` — Nx project with tags `["type:ble", "scope:shared"]`

## Acceptance Criteria

- [ ] All three packages have `package.json`, `tsconfig.json`, `src/index.ts`
- [ ] `@pomofocus/state`, `@pomofocus/ui`, `@pomofocus/ble-protocol` are resolvable via TypeScript path aliases
- [ ] Each Nx project has both type and scope tags: `["type:state", "scope:shared"]`, `["type:ui", "scope:shared"]`, `["type:ble", "scope:shared"]`
- [ ] `pnpm nx type-check @pomofocus/state` passes
- [ ] `pnpm nx type-check @pomofocus/ui` passes
- [ ] `pnpm nx type-check @pomofocus/ble-protocol` passes

## Out of Scope

- Do NOT add Zustand, TanStack Query, or React dependencies yet
- Do NOT create BLE Protobuf definitions

## Test Plan

```bash
pnpm nx type-check @pomofocus/state
pnpm nx type-check @pomofocus/ui
pnpm nx type-check @pomofocus/ble-protocol
```

## Platform

Shared/Cross-platform
