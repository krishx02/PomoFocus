---
title: "[0.5] Configure import boundary rules via @nx/eslint-plugin"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

The `@nx/enforce-module-boundaries` ESLint rule is configured with `depConstraints` based on Nx project tags, preventing packages from importing outside their allowed dependency direction.

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #010 (Nx tags on all projects) and #028 (ESLint config exists).

This is complementary to issue #010 (Nx dependency constraints) and #030 (per-package no-restricted-imports). While #030 blocks specific import patterns (React, fetch), this rule blocks structural violations (core importing from data-access, types importing from core).

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Dependency direction: types <- core <- data-access/analytics <- state.

**Referenced coding standards:**
- [coding-standards-eslint-nx.md](../../research/coding-standards-eslint-nx.md) — `@nx/enforce-module-boundaries` depConstraints configuration.

## Affected Files

- `eslint.config.ts` — Add `@nx/enforce-module-boundaries` rule with `depConstraints`

## Acceptance Criteria

Use exact tag names from `coding-standards-eslint-nx.md` Section 4-5 (NOT `type:core` or `type:analytics` — those don't exist):

- [ ] `@nx/enforce-module-boundaries` rule is configured in `eslint.config.ts`
- [ ] `type:types` can only import from external (no internal PomoFocus packages)
- [ ] `type:domain` (core, analytics) can import from `type:domain` and `type:types` only
- [ ] `type:infra` (data-access) can import from `type:domain` and `type:types` only
- [ ] `type:ble` can import from `type:types` only
- [ ] `type:state` can import from `type:domain`, `type:infra`, and `type:types`
- [ ] `type:ui` can import from `type:types` only
- [ ] `type:app` can import from all tags
- [ ] Violating imports produce lint errors

## Out of Scope

- Do NOT duplicate import restrictions already covered by #030

## Test Plan

```bash
pnpm nx lint @pomofocus/core
# Verify: temporarily add `import {} from '@pomofocus/data-access'` in core, run lint, confirm error, remove
```

## Platform

Infrastructure
