---
title: "[0.6] Create GitHub Actions CI workflow (lint, test, type-check, build)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A GitHub Actions CI workflow at `.github/workflows/ci.yml` runs on PR and push to main, executing `nx affected` for lint, test, type-check, and build targets on `ubuntu-latest`.

## Context & Background

Phase 0, sub-item 0.6 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #027 (Nx test targets) and #033 (Nx lint targets) — CI needs targets to run.

CI is the gatekeeper that validates every PR. Without it, agents can merge broken code. The workflow uses `nx affected` to only validate changed packages, keeping CI fast.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI on ubuntu-latest, nx affected for lint/test/type-check/build, pnpm + Nx caching.

## Affected Files

- `.github/workflows/ci.yml` — Create CI workflow

## Acceptance Criteria

- [ ] Workflow triggers on: `push` to `main`, `pull_request` to `main`
- [ ] Runs on `ubuntu-latest`
- [ ] Steps: checkout, setup Node.js, setup pnpm, `pnpm install`, then `nx affected` for each target
- [ ] Targets run in order: `lint` -> `test` -> `type-check` -> `build`
- [ ] Uses `actions/checkout@v4` with `fetch-depth: 0` (needed for `nx affected`)
- [ ] Sets `NX_BASE` and `NX_HEAD` for affected detection on PRs
- [ ] Workflow file is valid YAML

## Out of Scope

- Do NOT configure caching — issue #035
- Do NOT configure branch protection — issue #036
- Do NOT add deploy workflows (dormant workflows come later)

## Test Plan

```bash
# Validate YAML syntax
cat .github/workflows/ci.yml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin); print('Valid YAML')"
# Full validation: push a branch and verify CI triggers
```

## Platform

Infrastructure
