---
title: "[0.1] Initialize Nx workspace with pnpm"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

An Nx integrated monorepo with pnpm is initialized at the repo root with `tsconfig.base.json`, `nx.json`, `pnpm-workspace.yaml`, and root `package.json` configured for the `@pomofocus` scope.

## Context & Background

Phase 0, sub-item 0.1 of the [MVP Roadmap](../../research/mvp-roadmap.md).

This is the very first infrastructure issue — everything else depends on the monorepo existing. The workspace must use Nx integrated mode (not package-based) with pnpm as the package manager.

**Referenced ADRs:**
- [ADR-001](../../research/decisions/001-monorepo-package-structure.md) — Monorepo package structure, Nx + pnpm, `@pomofocus/` scope convention

## Affected Files

- `package.json` — Create root package.json with `@pomofocus/root` name, pnpm workspaces config
- `nx.json` — Create Nx configuration with default targets, caching, and task pipeline
- `pnpm-workspace.yaml` — Define workspace packages (`packages/*`, `apps/*`)
- `tsconfig.base.json` — Create shared TypeScript config with strict settings, path aliases for `@pomofocus/*`
- `.npmrc` — Configure pnpm settings (e.g., `shamefully-hoist=false`)
- `.nvmrc` — Pin Node.js version (LTS 20.x or 22.x)

## Acceptance Criteria

- [ ] `pnpm install` succeeds with no errors
- [ ] `nx.json` exists with correct configuration
- [ ] `pnpm-workspace.yaml` lists `packages/*` and `apps/*`
- [ ] `tsconfig.base.json` has `compilerOptions.paths` for `@pomofocus/*` packages
- [ ] `tsconfig.base.json` enables `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`
- [ ] Root `package.json` has `"packageManager"` field set to pnpm version

## Out of Scope

- Do NOT create any package or app stubs (separate issues #002-#009)
- Do NOT configure ESLint or Prettier (issue #028)
- Do NOT configure Vitest (issue #023)

## Test Plan

```bash
pnpm install
npx nx --version
cat tsconfig.base.json | node -e "const j=require('fs').readFileSync('/dev/stdin','utf8'); const c=JSON.parse(j); console.assert(c.compilerOptions.strict===true,'strict must be true')"
```

## Platform

Infrastructure
