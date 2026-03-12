---
title: "[0.1] Scaffold packages/data-access stub"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

`packages/data-access/` exists as an Nx library importable as `@pomofocus/data-access`, with dependencies on `@pomofocus/types` and `@pomofocus/core`.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Initialize Nx workspace must be merged first.

`packages/data-access/` contains all server interaction via generated OpenAPI client (queries, auth token management, sync drivers). All auth imports live here. Core never imports this. Clients never talk to Supabase directly.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — data-access depends on types and core. Contains all auth, all API client code, all sync drivers.
- [ADR-007](../../research/decisions/007-api-architecture.md) — Uses openapi-fetch generated from Hono OpenAPI spec.

## Affected Files

- `packages/data-access/package.json` — Create with `name: "@pomofocus/data-access"`
- `packages/data-access/tsconfig.json` — Extends `../../tsconfig.base.json`
- `packages/data-access/tsconfig.lib.json` — Library-specific TS config
- `packages/data-access/src/index.ts` — Barrel export (placeholder)
- `packages/data-access/project.json` — Nx project with tags `type:infra, scope:shared` (IO/infrastructure adapter)

## Acceptance Criteria

- [ ] `packages/data-access/package.json` exists with `"name": "@pomofocus/data-access"`
- [ ] `@pomofocus/data-access` is resolvable via TypeScript path aliases
- [ ] Nx project has tags `["type:infra", "scope:shared"]` (per `coding-standards-eslint-nx.md` Section 4)
- [ ] `pnpm nx type-check @pomofocus/data-access` passes

## Out of Scope

- Do NOT implement OpenAPI client generation — Phase 1
- Do NOT implement auth module — Phase 2

## Test Plan

```bash
pnpm nx type-check @pomofocus/data-access
```

## Platform

Shared/Cross-platform
