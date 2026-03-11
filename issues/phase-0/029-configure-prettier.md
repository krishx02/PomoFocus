---
title: "[0.5] Configure Prettier and editor settings"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Prettier is configured with a `.prettierrc` (or `prettier.config.js`) and VS Code workspace settings are set up for consistent formatting across the team and agents.

## Context & Background

Phase 0, sub-item 0.5 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #028 — ESLint config must exist first (Prettier should not conflict with ESLint rules).

Prettier handles formatting (semicolons, quotes, line width) while ESLint handles code quality. The two must not conflict. VS Code settings ensure format-on-save works correctly.

**Referenced coding standards:**
- [coding-standards.md](../../research/coding-standards.md) — Formatting conventions.

## Affected Files

- `.prettierrc` (or `prettier.config.js`) — Create Prettier configuration
- `.prettierignore` — Ignore generated files, dist, coverage
- `.vscode/settings.json` — Create VS Code workspace settings (format on save, default formatter)
- `.vscode/extensions.json` — Recommend ESLint and Prettier extensions
- `package.json` — Add `prettier` as devDependency

## Acceptance Criteria

- [ ] `.prettierrc` exists with configured options (printWidth, singleQuote, trailingComma, etc.)
- [ ] `.prettierignore` ignores `dist/`, `coverage/`, `node_modules/`, generated files
- [ ] `.vscode/settings.json` configures `editor.formatOnSave: true` and `editor.defaultFormatter: "esbenp.prettier-vscode"`
- [ ] `pnpm prettier --check .` runs without error on existing files
- [ ] No conflicts between Prettier and ESLint rules

## Out of Scope

- Do NOT configure pre-commit hooks (optional, can be added later)

## Test Plan

```bash
pnpm prettier --check .
```

## Platform

Infrastructure
