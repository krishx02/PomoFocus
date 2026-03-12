---
title: "[0.4] Add per-package Vitest configs for all 7 packages"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

Each of the 7 packages (`types`, `core`, `analytics`, `data-access`, `state`, `ui`, `ble-protocol`) has a `vitest.config.ts` that extends the shared root configuration and can run tests independently.

## Context & Background

Phase 0, sub-item 0.4 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #023 — Root Vitest config must exist first.

Per-package configs enable `pnpm nx test @pomofocus/core` to run only core's tests. Each config extends the shared base but can override settings (e.g., different test environments for UI components vs pure logic).

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — Each package has its own test target.

## Affected Files

- `packages/types/vitest.config.ts` — Create (types may have minimal tests)
- `packages/core/vitest.config.ts` — Create (test environment: node)
- `packages/analytics/vitest.config.ts` — Create (test environment: node)
- `packages/data-access/vitest.config.ts` — Create (test environment: node)
- `packages/state/vitest.config.ts` — Create (test environment: jsdom for React hooks)
- `packages/ui/vitest.config.ts` — Create (test environment: jsdom for components)
- `packages/ble-protocol/vitest.config.ts` — Create (test environment: node)

## Acceptance Criteria

- [ ] All 7 packages have a `vitest.config.ts`
- [ ] Each config extends or references the shared root config
- [ ] `packages/state/` and `packages/ui/` use `jsdom` test environment
- [ ] Other packages use `node` test environment
- [ ] TypeScript path aliases (`@pomofocus/*`) resolve correctly in test files

## Out of Scope

- Do NOT create test files — issue #025
- Do NOT configure coverage — issue #026

## Test Plan

```bash
# Verify each config is valid by running vitest in each package
pnpm nx test @pomofocus/core --run 2>&1 | head -5
pnpm nx test @pomofocus/state --run 2>&1 | head -5
```

## Platform

Shared/Cross-platform
