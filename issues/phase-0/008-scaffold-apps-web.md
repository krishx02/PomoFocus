---
title: "[0.1] Scaffold apps/web stub (Expo web)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:web", "chore"]
---

## Goal

`apps/web/` exists as an Nx application configured as an Expo app targeting web output, with `package.json`, `app.json`, and a minimal entry point.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

The web app is an Expo application configured for web output. It shares code with the mobile app via packages. At this stage, only the project skeleton is created.

> **Source doc conflict:** `product-brief.md` says "Web (Next.js — zero-friction entry point)" but `mvp-roadmap.md` says "Minimal Expo Web App" for Phase 1. This issue follows the roadmap. **Resolve this conflict before implementation.**

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Apps consume all packages.
- [ADR-003](../../research/decisions/003-client-state-management.md) — Web app imports from `@pomofocus/state`.

## Affected Files

- `apps/web/package.json` — Create with `name: "@pomofocus/web"`, Expo dependencies
- `apps/web/tsconfig.json` — Extends `../../tsconfig.base.json`
- `apps/web/app.json` — Expo app configuration
- `apps/web/app/index.tsx` — Minimal entry point (placeholder screen)
- `apps/web/project.json` — Nx project with `type:app`, `platform:web` tags

## Acceptance Criteria

- [ ] `apps/web/package.json` exists with `"name": "@pomofocus/web"`
- [ ] `apps/web/app.json` exists with valid Expo configuration
- [ ] `apps/web/app/index.tsx` exists and exports a React component
- [ ] Nx project has tags `type:app`, `platform:web`
- [ ] `pnpm nx type-check @pomofocus/web` passes

## Out of Scope

- Do NOT implement any UI screens — Phase 1
- Do NOT configure navigation — Phase 1
- Do NOT deploy to Vercel — Phase 1

## Test Plan

```bash
pnpm nx type-check @pomofocus/web
```

## Platform

Web
