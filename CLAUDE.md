# PomoFocus — Claude Code Instructions

## Project Context

Multi-platform Pomodoro productivity app. Targets: iOS, macOS menu bar, Android, web, VS Code extension, Claude Code (MCP), physical BLE device. Cloud sync = paid subscription. Stack: Expo/React Native, SwiftUI, Turborepo/pnpm monorepo, Supabase, Cloudflare Workers, Better Auth.

**Current status:** Pre-code. No app code exists yet. Setting up dev workflow.

See @research/README.md for full stack decisions and research.

---

## Clarification Rules

IMPORTANT: Before implementing any task, ask "What should NOT change?" and confirm the scope explicitly.

YOU MUST ask one clarifying question before proceeding if ANY of the following are true:
- The request uses "everywhere", "all", "refactor", "clean up", or "update" without specifying exact files
- More than 3 files would be touched
- The request does not name a specific file, function, or component
- The request contradicts or is silent about what existing behavior to preserve
- Scope is vague enough that two developers would implement it differently

NEVER infer scope from a vague request. If you are unsure which files are in scope, ask.

When asking for clarification, ask EXACTLY ONE targeted question — not a list. Pick the most important unknown. Format: "Before I proceed — [question]?"

---

## Destructive Operations

YOU MUST confirm with the user before running any of the following:
- `git reset --hard` or `git reset` with unstaged changes
- `rm -rf` on any directory
- `git push --force` or `git push --force-with-lease`
- Dropping or truncating database tables
- Overwriting uncommitted changes

Do NOT use `--no-verify` to skip hooks unless the user explicitly requests it.

---

## Code Quality

- No app code yet. When writing app code: tests first, always.
- Follow existing patterns — read the file before editing.
- Do not add docstrings, comments, or type annotations to code you didn't change.
- Do not add error handling for scenarios that cannot happen.
- Do not design for hypothetical future requirements.

---

## Agent Workflow

- GitHub Issues are the unit of work. Each issue = one small, verifiable task.
- Task size: 1–3 sentences, clear completion criterion, < 10 files touched.
- Agent-ready issues must include: verifiable goal, exact file paths, success test command.
- Use `/clarify` skill for any ambiguous request before writing code.

---

## Context Compaction

When you compact, focus on: current task description, files changed, test results, and any open blockers.
