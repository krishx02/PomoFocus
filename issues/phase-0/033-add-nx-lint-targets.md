---
title: "[0.5] Add Nx lint targets for all packages and apps"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Every package and app has an Nx `lint` target in its `project.json` that runs ESLint, enabling `pnpm nx lint @pomofocus/[name]` and `pnpm nx affected --target=lint` across the monorepo.

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #028 — ESLint config must exist first.

Nx lint targets enable CI to run linting per-package using the `affected` command, only linting packages impacted by a change.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI runs `nx affected --target=lint`.

## Affected Files

- `packages/*/project.json` — Add `lint` target pointing to ESLint
- `apps/*/project.json` — Add `lint` target
- `nx.json` — Configure default lint target if using targetDefaults

## Acceptance Criteria

- [ ] `pnpm nx lint @pomofocus/core` runs ESLint on core package
- [ ] `pnpm nx lint @pomofocus/types` runs without error
- [ ] `pnpm nx affected --target=lint` correctly detects and lints affected packages
- [ ] `pnpm nx run-many --target=lint --all` lints all packages
- [ ] All packages pass linting with no violations

## Out of Scope

- Do NOT configure CI workflow — issue #034

## Test Plan

```bash
pnpm nx lint @pomofocus/core
pnpm nx run-many --target=lint --all
```

## Platform

Infrastructure
