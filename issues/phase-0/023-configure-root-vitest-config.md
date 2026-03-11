---
title: "[0.4] Configure root Vitest config with workspace mode"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A root `vitest.config.ts` (or `vitest.workspace.ts`) is configured for workspace mode, enabling Vitest to discover and run tests across all 7 packages from a single command.

## Context & Background

Phase 0, sub-item 0.4 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Nx workspace must exist first.

Tests are THE feedback loop for agents (Willison, Cherny). Without Vitest configured, no Red/Green TDD is possible. Every subsequent issue depends on `pnpm test` working. Vitest workspace mode runs tests across all packages while respecting per-package configs.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI runs `nx affected --target=test`.

**Referenced research:**
- [08-testing-frameworks.md](../../research/08-testing-frameworks.md) — Vitest for all TypeScript packages.

## Affected Files

- `vitest.workspace.ts` — Create workspace configuration listing all packages
- `package.json` — Add `vitest` as root devDependency
- `vitest.config.ts` — Optional shared base config (test environment, globals, etc.)

## Acceptance Criteria

- [ ] `vitest` is installed as a root devDependency
- [ ] `vitest.workspace.ts` references all 7 packages
- [ ] `pnpm vitest --run` executes without config errors (may report "no tests found" which is OK at this stage)
- [ ] Shared test configuration (TypeScript support, path aliases) works

## Out of Scope

- Do NOT create per-package configs — issue #024
- Do NOT create any test files — issue #025
- Do NOT configure coverage — issue #026

## Test Plan

```bash
pnpm vitest --run 2>&1 | grep -v "No test files found"
# Should exit cleanly without configuration errors
```

## Platform

Infrastructure
