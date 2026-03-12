---
title: "[0.1] Scaffold apps/mobile stub (Expo)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:mobile", "chore"]
---

## Goal

`apps/mobile/` exists as an Nx application configured as an Expo app targeting iOS and Android, with `package.json`, `app.json`, and a minimal entry point.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

The mobile app is the primary Expo application targeting iOS and Android. It also hosts the iOS widget target directory (`apps/mobile/targets/ios-widget/`). At this stage, only the project skeleton is created.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Apps consume all packages.
- [ADR-017](../../research/decisions/017-ios-widget-architecture.md) — iOS widget files live in `apps/mobile/targets/ios-widget/`.

## Affected Files

- `apps/mobile/package.json` — Create with `name: "@pomofocus/mobile"`, Expo dependencies
- `apps/mobile/tsconfig.json` — Extends `../../tsconfig.base.json`
- `apps/mobile/app.json` — Expo app configuration with iOS/Android schemes
- `apps/mobile/app/index.tsx` — Minimal entry point (placeholder screen)
- `apps/mobile/project.json` — Nx project with tags `["type:app", "scope:mobile"]`

## Acceptance Criteria

- [ ] `apps/mobile/package.json` exists with `"name": "@pomofocus/mobile"`
- [ ] `apps/mobile/app.json` exists with valid Expo configuration
- [ ] `apps/mobile/app/index.tsx` exists and exports a React component
- [ ] Nx project has tags `["type:app", "scope:mobile"]`
- [ ] `pnpm nx type-check @pomofocus/mobile` passes

## Out of Scope

- Do NOT create iOS widget target directory — Phase 6
- Do NOT configure EAS Build — Phase 4
- Do NOT implement any UI screens

## Test Plan

```bash
pnpm nx type-check @pomofocus/mobile
```

## Platform

iOS / Android (Expo)
