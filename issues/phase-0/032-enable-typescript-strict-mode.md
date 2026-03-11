---
title: "[0.5] Enable TypeScript strict mode in tsconfig.base.json"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

`tsconfig.base.json` enables all strict TypeScript compiler options including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, and `noPropertyAccessFromIndexSignature`. All packages inherit these settings.

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #001 — tsconfig.base.json must exist first.

Strict TypeScript catches entire categories of bugs at compile time. `noUncheckedIndexedAccess` is particularly important — it makes `array[0]` return `T | undefined`, forcing null checks. This may already be partially configured in #001, but this issue ensures ALL strict settings are verified and documented.

**Referenced coding standards:**
- [coding-standards.md](../../research/coding-standards.md) — Rule U-013: noUncheckedIndexedAccess.
- [coding-standards-eslint-nx.md](../../research/coding-standards-eslint-nx.md) — Full tsconfig.base.json specification.

## Affected Files

- `tsconfig.base.json` — Verify/update strict compiler options

## Acceptance Criteria

- [ ] `strict: true` is set
- [ ] `noUncheckedIndexedAccess: true` is set
- [ ] `exactOptionalPropertyTypes: true` is set
- [ ] `verbatimModuleSyntax: true` is set
- [ ] `noPropertyAccessFromIndexSignature: true` is set
- [ ] `moduleResolution: "bundler"` is set
- [ ] `module: "esnext"` and `target: "esnext"` are set
- [ ] `pnpm nx run-many --target=type-check` passes on all packages

## Out of Scope

- Do NOT modify per-package tsconfig files beyond what inherits from base

## Test Plan

```bash
cat tsconfig.base.json | node -e "const j=require('fs').readFileSync('/dev/stdin','utf8'); const c=JSON.parse(j).compilerOptions; console.assert(c.strict===true); console.assert(c.noUncheckedIndexedAccess===true); console.log('OK')"
pnpm nx run-many --target=type-check
```

## Platform

Infrastructure
