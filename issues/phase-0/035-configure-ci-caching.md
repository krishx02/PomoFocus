---
title: "[0.6] Configure pnpm and Nx caching in CI"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

The CI workflow caches both the pnpm store and Nx computation cache, reducing CI run times for subsequent builds.

## Context & Background

Phase 0, sub-item 0.6 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #034 — CI workflow must exist first.

Caching is critical for fast CI. The pnpm store cache avoids re-downloading dependencies. The Nx cache avoids re-running unchanged targets. Together they can reduce CI from minutes to seconds for incremental changes.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — pnpm store + Nx cache in CI.

## Affected Files

- `.github/workflows/ci.yml` — Add caching steps

## Acceptance Criteria

- [ ] pnpm store is cached using `actions/cache` with key based on `pnpm-lock.yaml` hash
- [ ] Nx cache directory (`.nx/cache`) is cached using `actions/cache`
- [ ] Second CI run on same branch is measurably faster than first
- [ ] Cache key includes OS and lockfile hash for correct invalidation

## Out of Scope

- Do NOT configure Nx Cloud (free tier is optional, can be added later)
- Do NOT add other workflow optimizations (matrix builds, etc.)

## Test Plan

```bash
# Verify caching config in workflow
grep -A 5 "actions/cache" .github/workflows/ci.yml
# Full validation: push twice to same branch, compare CI run times
```

## Platform

Infrastructure
