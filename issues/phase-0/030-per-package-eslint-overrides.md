---
title: "[0.5] Add per-package ESLint overrides (core no-IO, analytics no-IO, etc.)"
labels: ["agent-ready", "effort:small", "phase:0", "platform:shared", "chore"]
---

## Goal

Per-package ESLint overrides are configured in `eslint.config.ts` to enforce package-level import restrictions: `packages/core/` bans IO, React, Supabase, and timer APIs; `packages/analytics/` bans IO and React; `packages/data-access/` bans React; `packages/ui/` bans Zustand and TanStack Query.

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #028 — Base ESLint config must exist first.

These rules enforce the architectural boundaries defined in ADR-001. If an agent accidentally imports `fetch` in `packages/core/`, the lint error provides immediate feedback. This is the most important lint configuration for preventing coupling violations.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Package purity constraints.

**Referenced coding standards:**
- [coding-standards.md](../../research/coding-standards.md) — Package-level rules PKG-C01 through PKG-U02.
- [coding-standards-eslint-nx.md](../../research/coding-standards-eslint-nx.md) — Exact `no-restricted-imports` and `no-restricted-globals` patterns per package.

## Affected Files

- `eslint.config.ts` — Add per-package override sections with `no-restricted-imports` and `no-restricted-globals`

## Acceptance Criteria

- [ ] `packages/core/**/*.ts` files:
  - Banned globals: `setTimeout`, `setInterval`, `Date`, `performance`, `fetch`, `XMLHttpRequest`
  - Banned imports: `react`, `react-dom`, `react-native`, `@supabase/*`, `@tanstack/*`, `zustand`, `node:*`, `fs`, `path`, `http`, `https`, `expo-*`
- [ ] `packages/analytics/**/*.ts` files: Same IO/React bans as core
- [ ] `packages/data-access/**/*.ts` files: Banned imports: `react`, `react-dom`, `react-native`
- [ ] `packages/ui/**/*.ts` files: Banned imports: `@supabase/*`, `zustand`, `zustand/*`, `@tanstack/*`
- [ ] Adding `import { fetch } from 'node-fetch'` in `packages/core/` triggers a lint error
- [ ] `pnpm nx lint @pomofocus/core` passes (no existing violations in stubs)

## Out of Scope

- Do NOT configure Nx module boundary rules — issue #031
- Do NOT add app-level overrides (apps have fewer restrictions)

## Test Plan

```bash
pnpm nx lint @pomofocus/core
pnpm nx lint @pomofocus/analytics
pnpm nx lint @pomofocus/data-access
pnpm nx lint @pomofocus/ui
```

## Platform

Shared/Cross-platform
