---
title: "[0.1] Scaffold apps/api stub (Hono on CF Workers)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:api", "chore"]
---

## Goal

`apps/api/` exists as an Nx application configured for Hono on Cloudflare Workers, with `wrangler.toml`, `package.json`, and a minimal `src/index.ts` entry point.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

The API is a Hono REST application deployed to Cloudflare Workers. At this stage we only create the project skeleton — no routes, no Supabase connection. Actual routes are implemented in Phase 1.

**Referenced ADRs:**
- [ADR-007](../../research/decisions/007-api-architecture.md) — Hono on CF Workers, `@hono/zod-openapi` for validation + spec generation, `wrangler` for dev/deploy.
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Apps consume all packages.

## Affected Files

- `apps/api/package.json` — Create with `name: "@pomofocus/api"`, deps on hono, wrangler
- `apps/api/tsconfig.json` — Extends `../../tsconfig.base.json`
- `apps/api/src/index.ts` — Minimal Hono app with `export default app`
- `apps/api/wrangler.toml` — CF Workers configuration (name, compatibility_date)
- `apps/api/project.json` — Nx project with `type:app` and `platform:api` tags

## Acceptance Criteria

- [ ] `apps/api/package.json` exists with `"name": "@pomofocus/api"`
- [ ] `apps/api/src/index.ts` exports a Hono app
- [ ] `apps/api/wrangler.toml` exists with valid configuration
- [ ] Nx project has tags `type:app`, `platform:api`
- [ ] `pnpm nx type-check @pomofocus/api` passes

## Out of Scope

- Do NOT implement any API routes — Phase 1
- Do NOT configure Supabase client — Phase 1
- Do NOT deploy to Cloudflare — Phase 1

## Test Plan

```bash
pnpm nx type-check @pomofocus/api
```

## Platform

API (Cloudflare Workers)
