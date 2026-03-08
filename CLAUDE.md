# PomoFocus — Claude Code Instructions

## Project Context

Multi-platform Pomodoro productivity app. Targets: iOS, iOS home screen widget, Apple Watch (watchOS), macOS menu bar, Android, web, VS Code extension, Claude Code (MCP), physical BLE device. Cloud sync = paid subscription. Stack: Expo/React Native, SwiftUI/WatchKit, Nx/pnpm monorepo, Supabase (database + auth), Cloudflare Workers.

**Current status:** Pre-code. No app code exists yet. Setting up dev workflow.

See @research/README.md for full stack decisions and research.

---

## Package Structure

IMPORTANT: Follow these import rules when writing app code.

- `packages/types/` — Auto-generated from Postgres schema via `supabase gen types`. **Never edit manually.**
- `packages/core/` — Pure domain logic (timer, goals, sessions). **No IO, no React, no Supabase imports.**
- `packages/analytics/` — Focus Score and insights. Depends on `types/` and `core/` only.
- `packages/data-access/` — All Supabase interaction (queries, auth, sync). **All auth imports live here.** Core never imports this.
- `packages/state/` — Zustand stores + TanStack Query hooks. Depends on `core/`, `data-access/`, `types/`. **All React apps import from here.**
- `packages/ui/` — Shared React/RN components. Depends on `types/` only.
- `packages/ble-protocol/` — BLE GATT profile. Types auto-generated from Protobuf.
- Import direction: `types ← core ← data-access/analytics ← state`, apps consume all. **Never import downward.**
- Native Apple code lives in `native/`, firmware in `firmware/` — outside Nx's TS ecosystem.
- Cross-language types: `supabase gen types` (TS + Swift), `protoc` (TS + Swift + C++). Zero manual sync.

See [ADR-001](./research/decisions/001-monorepo-package-structure.md) for full rationale.

## Auth

IMPORTANT: Use Supabase Auth for all authentication. Never import auth logic into `packages/core/` — auth belongs in `packages/data-access/`. Core functions receive `userId: string` as a parameter, never a session or token.

See [ADR-002](./research/decisions/002-auth-architecture.md) for full rationale.

## State Management

IMPORTANT: Use Zustand for local/UI state and TanStack Query for server state. Never put state library imports in `packages/core/` — core is pure domain logic. Zustand stores are thin wrappers that delegate to `core/` functions. All server data uses TanStack Query polling (30s default) — do not add Supabase Realtime WebSocket subscriptions without explicit approval.

See [ADR-003](./research/decisions/003-client-state-management.md) for full rationale.

## Timer

IMPORTANT: The timer state machine is a pure function in `packages/core/timer/`: `transition(state, event) → newState`. Never add intervals, `setTimeout`, or any side effects to `core/` — timer drivers are platform-specific (Zustand store for React apps, Foundation `Timer` for Swift, `millis()` for firmware). Use TypeScript discriminated unions for timer state and exhaustive `switch` for transitions.

See [ADR-004](./research/decisions/004-timer-state-machine.md) for full rationale.

## Database

IMPORTANT: Follow these conventions when writing database code.

- Always use `timestamptz`, never `timestamp` without timezone.
- All primary keys are `uuid` with `gen_random_uuid()` default.
- Use Postgres `ENUM` types for fixed domain values — never store enum strings as plain `text`.
- Hard deletes only (no `deleted_at` columns) unless explicitly approved.
- RLS on every table. Use `get_user_id()` helper function for policy checks — never inline the `auth.uid()` → `profiles` lookup.
- Friends never see raw session data. Use `is_friend_focusing()` and `did_friend_focus_today()` scoped functions for social visibility.
- Schema is the source of truth for `packages/types/` — run `supabase gen types` after any schema change.
- Actual migrations via `supabase migration new` — never apply DDL directly.

See [ADR-005](./research/decisions/005-database-schema-data-model.md) for full rationale.

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
