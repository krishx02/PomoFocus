---
title: "[0.1] Configure Nx dependency constraints and module boundaries"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Nx module boundary rules are configured in `eslint.config.ts` via `@nx/eslint-plugin` to enforce the package dependency direction: `types <- core <- data-access/analytics <- state`, with apps consuming all. Violations produce lint errors.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #002-#009 — All package and app stubs must exist first so Nx tags are defined.

The dependency graph must be enforced from day one to prevent coupling violations that are expensive to fix later. Nx tags on each project enable the `@nx/enforce-module-boundaries` rule.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Import direction: `types <- core <- data-access/analytics <- state`. Never import downward.

**Referenced coding standards:**
- [coding-standards-eslint-nx.md](../../research/coding-standards-eslint-nx.md) — Nx `@nx/enforce-module-boundaries` configuration, tag-based constraints.

## Affected Files

- `eslint.config.ts` — Add `@nx/enforce-module-boundaries` rule with `depConstraints` and `bannedExternalImports` (per coding-standards-eslint-nx.md Section 5)

## Acceptance Criteria

Use exact tag names from `coding-standards-eslint-nx.md` Section 4-5:

- [ ] `depConstraints` configured with these exact rules:
  - `type:types` depends on nothing (leaf node)
  - `type:domain` depends on `['type:domain', 'type:types']`
  - `type:infra` depends on `['type:domain', 'type:types']`
  - `type:ble` depends on `['type:types']`
  - `type:state` depends on `['type:domain', 'type:infra', 'type:types']`
  - `type:ui` depends on `['type:types']`
  - `type:app` depends on `['type:state', 'type:domain', 'type:infra', 'type:ble', 'type:ui', 'type:types']`
  - Scope constraints: `scope:web`/`scope:mobile`/`scope:vscode`/`scope:mcp` depend on `['scope:shared']`; `scope:shared` depends on `['scope:shared']`
- [ ] Importing `@pomofocus/data-access` from `packages/core/` triggers a lint error (`type:domain` cannot depend on `type:infra`)
- [ ] Importing `@pomofocus/state` from `packages/core/` triggers a lint error
- [ ] Importing `@pomofocus/core` from `packages/types/` triggers a lint error
- [ ] `packages/state/` can import from `types`, `core`, and `data-access` without errors
- [ ] `pnpm nx graph` renders the correct dependency diagram
- [ ] `pnpm nx lint` passes on all packages (no existing violations)

## Out of Scope

- Do NOT configure per-package import restriction rules (no-restricted-imports) — issue #030
- Do NOT configure ESLint base rules — issue #028

## Test Plan

```bash
pnpm nx graph --file=output.json
pnpm nx lint @pomofocus/core
# Manually verify: add a test import of @pomofocus/data-access in packages/core/src/index.ts, run lint, confirm error, then remove
```

## Platform

Infrastructure
