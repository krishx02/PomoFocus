---
title: "[0.5] Configure ESLint flat config with typescript-eslint strict"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

A root `eslint.config.ts` is configured using ESLint flat config format with `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked` presets, enforcing the universal coding standards (no `any`, named exports only, `import type`, `type` over `interface`, etc.).

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — Nx workspace must exist first.

Agents produce better code with lint feedback. The ESLint configuration encodes all universal coding standards from `research/coding-standards.md` as enforceable rules. ESLint flat config (`eslint.config.ts`) is the modern format.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Import direction enforcement.
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI runs `nx affected --target=lint`.

**Referenced coding standards:**
- [coding-standards.md](../../research/coding-standards.md) — Universal rules U-001 through U-013.
- [coding-standards-eslint-nx.md](../../research/coding-standards-eslint-nx.md) — Exact ESLint plugin configuration.

## Affected Files

- `eslint.config.ts` — Create root ESLint flat config
- `package.json` — Add devDependencies: `eslint`, `typescript-eslint`, `eslint-plugin-import`, `@nx/eslint-plugin`

## Acceptance Criteria

- [ ] `eslint.config.ts` exists using flat config format
- [ ] `typescript-eslint` `strictTypeChecked` preset is enabled
- [ ] Rules enforced: `no-explicit-any` (error), `no-unsafe-*` (error), `consistent-type-imports` (prefer type-imports), `consistent-type-definitions` (type), `explicit-function-return-type` (error), `switch-exhaustiveness-check` (error), `no-floating-promises` (error)
- [ ] `import/no-default-export` enabled with framework file exceptions (`page.tsx`, `layout.tsx`, `*.config.*`)
- [ ] `no-restricted-syntax` blocks `TSEnumDeclaration` (use `as const` instead)
- [ ] Generated and build output files are ignored (`**/generated/**`, `**/database.ts`, `**/dist/**`, `**/.next/**`, `**/coverage/**`, `**/node_modules/**`)
- [ ] `pnpm eslint --version` runs without error

## Out of Scope

- Do NOT configure per-package overrides (no-restricted-imports) — issue #030
- Do NOT configure Nx module boundary rules — issue #031
- Do NOT configure Prettier — issue #029

## Test Plan

```bash
pnpm eslint --print-config packages/core/src/index.ts | head -20
pnpm nx lint @pomofocus/core
```

## Platform

Infrastructure
