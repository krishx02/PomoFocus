---
title: "[0.4] Add Nx test targets for all packages and apps"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Every package and app has an Nx `test` target in its `project.json` that runs Vitest, enabling `pnpm nx test @pomofocus/[name]` and `pnpm nx affected --target=test` across the monorepo.

## Context & Background

Phase 0, sub-item 0.4 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #024 — Per-package Vitest configs must exist first.

Nx targets are how CI discovers and runs tests per package. The `affected` command only runs tests for packages impacted by a change — essential for fast CI in a monorepo.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI runs `nx affected --target=test`.

## Affected Files

- `packages/*/project.json` — Add `test` target pointing to Vitest
- `apps/*/project.json` — Add `test` target (apps may not have tests initially)
- `nx.json` — Configure default test target if using targetDefaults

## Acceptance Criteria

- [ ] `pnpm nx test @pomofocus/core --run` runs Vitest for core package
- [ ] `pnpm nx test @pomofocus/types --run` runs without error
- [ ] `pnpm nx affected --target=test` correctly detects and runs affected tests
- [ ] `pnpm nx run-many --target=test --all --run` runs tests across all packages
- [ ] Test target uses Vitest (not Jest or another runner)

## Out of Scope

- Do NOT configure CI workflow — issue #034
- Do NOT add type-check or build targets here (they may already exist from scaffolding)

## Test Plan

```bash
pnpm nx test @pomofocus/core --run
pnpm nx run-many --target=test --all --run
```

## Platform

Infrastructure
