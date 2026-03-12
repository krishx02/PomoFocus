---
title: "[0.4] Configure test coverage reporting"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Vitest coverage reporting is configured with `@vitest/coverage-v8`, generating coverage reports for all packages. Coverage output is gitignored.

## Context & Background

Phase 0, sub-item 0.4 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #024 — Per-package Vitest configs must exist first.

Coverage reporting helps agents and humans understand test quality. The `@vitest/coverage-v8` provider is the standard choice for Vitest. Reports should be generated in both `text` (terminal) and `lcov` (CI integration) formats.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI pipeline should report coverage.

## Affected Files

- `vitest.config.ts` (or `vitest.workspace.ts`) — Add coverage configuration
- `package.json` — Add `@vitest/coverage-v8` devDependency
- `.gitignore` — Add `coverage/` directory

## Acceptance Criteria

- [ ] `@vitest/coverage-v8` is installed as a devDependency
- [ ] Running `pnpm vitest --run --coverage` produces a coverage report
- [ ] Coverage reports output in `text` and `lcov` formats
- [ ] `coverage/` directory is gitignored
- [ ] Coverage configuration is shared (not duplicated per package)

## Out of Scope

- Do NOT set coverage thresholds — too early with no code
- Do NOT configure CI coverage upload — can be added when CI is mature

## Test Plan

```bash
pnpm vitest --run --coverage 2>&1 | tail -10
test -d coverage || echo "no coverage dir yet (expected if no tests)"
grep "coverage" .gitignore
```

## Platform

Infrastructure
