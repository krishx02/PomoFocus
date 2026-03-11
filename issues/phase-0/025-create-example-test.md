---
title: "[0.4] Create example test in packages/core to validate pipeline"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

A minimal test file exists in `packages/core/` that validates the entire test pipeline works end-to-end: Vitest discovers the test, runs it, and reports pass/fail.

## Context & Background

Phase 0, sub-item 0.4 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #024 — Per-package Vitest configs must exist first.

This is a smoke test for the test infrastructure. It proves that the full chain works: Vitest workspace -> per-package config -> TypeScript compilation -> test execution -> result reporting. The test itself can be trivial — the value is in validating the pipeline.

**Referenced research:**
- [08-testing-frameworks.md](../../research/08-testing-frameworks.md) — Tests co-located as `*.test.ts` per TST-006.

## Affected Files

- `packages/core/src/example.test.ts` — Create minimal test file

## Acceptance Criteria

- [ ] `packages/core/src/example.test.ts` exists with at least one passing test
- [ ] Test imports from `@pomofocus/types` work (validates cross-package resolution)
- [ ] `pnpm nx test @pomofocus/core` runs and passes
- [ ] `pnpm nx affected --target=test` detects and runs the test

## Out of Scope

- Do NOT implement domain logic — this is just a pipeline validation test
- Do NOT create tests in other packages yet

## Test Plan

```bash
pnpm nx test @pomofocus/core --run
```

## Platform

Shared/Cross-platform
