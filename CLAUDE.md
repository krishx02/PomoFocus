# PomoFocus — Claude Code Instructions

## Project Context

Multi-platform Pomodoro productivity app. Targets: iOS, iOS home screen widget, Apple Watch (watchOS), macOS menu bar, Android, web, VS Code extension, Claude Code (MCP), physical BLE device. Cloud sync = paid subscription. Stack: Expo/React Native, SwiftUI/WatchKit, Nx/pnpm monorepo, Supabase (database + auth), Hono REST API on Cloudflare Workers.

**Current status:** Pre-code. No app code exists yet. Setting up dev workflow.

See @research/README.md for full stack decisions and research.

---

## Package Structure

IMPORTANT: Follow these import rules when writing app code.

- `packages/types/` — Auto-generated from Postgres schema via `supabase gen types`. **Never edit manually.**
- `packages/core/` — Pure domain logic (timer, goals, sessions, sync protocol). **No IO, no React, no Supabase imports.**
- `packages/analytics/` — Component metrics (completion rate, focus quality, consistency, streaks, trends) and insight computation. No composite Focus Score — individual metrics with trend arrows instead (ADR-014). Depends on `types/` and `core/` only. Pure functions, no IO.
- `packages/data-access/` — All server interaction via generated OpenAPI client (queries, auth token management, sync drivers). **All auth imports live here.** Sync outbox persistence and upload logic live here. Core never imports this. Clients never talk to Supabase directly — all requests go through the Hono API on Cloudflare Workers.
- `packages/state/` — Zustand stores + TanStack Query hooks. Depends on `core/`, `data-access/`, `types/`. **All React apps import from here.**
- `packages/ui/` — Shared React/RN components. Depends on `types/` only.
- `packages/ble-protocol/` — BLE GATT profile, shared BLE abstraction (`BleTransport` interface + sync orchestration), and Protobuf types. Transport adapters (react-native-ble-plx, Web Bluetooth) live here. Types auto-generated from Protobuf.
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

## Device Hardware

IMPORTANT: The physical device uses a Seeed XIAO ePaper EN04 board (nRF52840 Plus built in — NOT a separate pluggable XIAO, NOT ESP32). Firmware is Arduino/C++ in `firmware/device/`, built with PlatformIO (`platformio.ini` at `firmware/device/platformio.ini`). Code uses the Arduino framework (`setup()`, `loop()`) — portable to Arduino IDE as fallback. The timer state machine in firmware is a direct C++ port of `packages/core/timer/` — same states, same transitions. Display is 4.26" e-ink (800x480, 219 PPI, SSD1677, GDEQ0426T82) connected via EN04's 24-pin FPC connector, driven by the GxEPD2 library (`GxEPD2_426_GDEQ0426T82` class). Battery is AKZYTUE 903048 1200mAh LiPo (JST PH 2.0mm) — check polarity before connecting. BLE protocol types are defined in `packages/ble-protocol/proto/pomofocus.proto` and generated via Nanopb (`nanopb_generator`) for C, `protoc` for TS and Swift. Nanopb uses static buffers only — no dynamic allocation on the MCU. The device uses System ON sleep with BLE SoftDevice active (~5μA + ~22μA BLE advertising) — never System OFF (which kills BLE discoverability). The device syncs through the phone (BLE) — never directly to the cloud.

See [ADR-010](./research/decisions/010-physical-device-hardware-platform.md) for hardware platform. See [ADR-013](./research/decisions/013-ble-gatt-protocol-design.md) for the GATT protocol. See [ADR-015](./research/decisions/015-device-firmware-toolchain.md) for firmware toolchain (PlatformIO, Nanopb, sleep strategy). See [ADR-016](./research/decisions/016-ble-client-libraries-integration.md) for BLE client libraries.

## BLE

IMPORTANT: Use react-native-ble-plx for mobile BLE (Expo managed workflow). Web Bluetooth for web (Chrome/Edge only — progressive enhancement). CoreBluetooth for macOS (post-v1). BLE sync is app-open only for v1 — no background BLE. When user opens the app, scan for the device, connect, drain the outbox. The shared `BleTransport` interface and sync orchestration live in `packages/ble-protocol/`. Platform-specific transport adapters implement `BleTransport`. Never add BLE connection logic to `packages/core/` — BLE is IO. Pairing is OS-managed (no app-level auth).

See [ADR-016](./research/decisions/016-ble-client-libraries-integration.md) for full rationale.

## iOS Widget

IMPORTANT: The iOS widget is a native Swift WidgetKit extension, managed by the `@bacons/apple-targets` Expo Config Plugin. Widget Swift files live outside the `/ios` directory and survive `expo prebuild --clean`. Data flows from the Expo app to the widget via App Group shared `UserDefaults` — an Expo native module writes Tier 1 stats (ADR-014) to UserDefaults and calls `WidgetCenter.shared.reloadAllTimelines()`. The widget uses `AppIntentConfiguration` (iOS 17+) so users can choose which stat to display (goal progress, weekly dots, streak, completion rate). Supported sizes: Small, Medium, Lock Screen (Accessory). No Large widget — dashboard belongs in the app. No Live Activity for v1 — avoids inconsistency with BLE device. Cross-language type safety: define `WidgetKeys` constants in both `widget-keys.ts` and `WidgetKeys.swift` — `/align-repo` checks drift.

See [ADR-017](./research/decisions/017-ios-widget-architecture.md) for full rationale.

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

## API

IMPORTANT: All client-server communication goes through a Hono REST API on Cloudflare Workers (`apps/api/`). Clients never talk to Supabase directly — no Supabase URL, no anon key, no raw table structures are exposed. The API forwards the user's Supabase JWT to Supabase so RLS remains active as defense-in-depth. Route schemas are defined with `@hono/zod-openapi` (Zod validates requests AND generates OpenAPI 3.1 spec). TypeScript clients use `openapi-fetch` (generated from spec). Swift clients use Apple's `swift-openapi-generator` (generated from same spec). The `service_role` key is server-side only, used for admin operations.

See [ADR-007](./research/decisions/007-api-architecture.md) for full rationale.

## Sync

IMPORTANT: The sync architecture is a custom outbox pattern. Pure sync protocol (queue FSM, conflict rules, retry policy) lives in `packages/core/sync/` — no IO, no network calls, no platform imports. Sync drivers (API upload via generated OpenAPI client, queue persistence, network detection) live in `packages/data-access/sync/`. Swift platforms reimplement the same protocol using SwiftData. Never add network calls or persistence logic to `core/sync/` — it must remain a pure state machine, same pattern as the timer (ADR-004). All writes use client-generated UUIDs as idempotency keys — server uses `ON CONFLICT (id) DO NOTHING` to deduplicate retries. All sync traffic goes through the Hono API on CF Workers (ADR-007), not directly to Supabase.

See [ADR-006](./research/decisions/006-offline-first-sync-architecture.md) for full rationale.

## CI/CD

IMPORTANT: Follow these conventions for CI/CD workflows.

- CI validates all TypeScript via Nx affected: `lint`, `test`, `type-check`, `build` on `ubuntu-latest`.
- Mobile builds use **Expo EAS Build** — never Fastlane. No macOS GitHub Actions runners.
- Deploy workflow templates in `.github/workflows/` may be "dormant" (path filters don't match yet). **Do not delete dormant workflows** — they activate when their platform's code is added.
- Agent work (implementation) runs locally via Claude Code CLI. **Do not add Claude Code Action workflows** unless explicitly approved.
- Native Swift targets (macOS widget, iOS widget, watchOS) are built locally from Xcode — no CI.

See [ADR-009](./research/decisions/009-ci-cd-pipeline-design.md) for full rationale.

---

## Security & Privacy

IMPORTANT: Rely on platform-provided security — no application-level encryption. Supabase handles AES-256 at rest and TLS in transit. RLS on every table (ADR-005) + API gateway (ADR-007) provides access control. GDPR compliance is built in: `DELETE /v1/me` (cascade delete all user data) and `GET /v1/me/export` (JSON download). Store minimum OAuth data: provider `sub`, email, display name. No tracking, no ads, no third-party analytics — no cookie banner needed. BLE uses LE Secure Connections with Passkey Entry + Bonding. Token storage is platform-secure per app (HttpOnly cookie for web, `expo-secure-store` for mobile, Keychain for macOS, `SecretStorage` for VS Code).

See [ADR-012](./research/decisions/012-security-data-privacy.md) for full rationale.

---

## Analytics

IMPORTANT: No composite Focus Score. Use individual component metrics (completion rate, focus quality distribution, consistency, streaks) with trend arrows instead. Analytics formulas are pure functions in `packages/analytics/`, executed server-side by the Hono API on CF Workers. Clients call API endpoints and render pre-computed results — never compute analytics client-side. Three tiers: Tier 1 (glanceable — goal progress, weekly dots, streak) for all platforms including BLE device; Tier 2 (weekly insights) and Tier 3 (monthly trends) for app only. Apple Watch shows cached analytics from last API sync + local simple counters. No pre-aggregation at v1 — compute on demand.

See [ADR-014](./research/decisions/014-analytics-insights-architecture.md) for full rationale.

---

## Observability

IMPORTANT: Use platform built-in dashboards (Supabase, Cloudflare Workers, Vercel) for infrastructure monitoring. Add Sentry free tier for client-side error tracking when each platform first deploys to staging — not before. Sentry SDK init belongs in app entry points (`apps/` and `native/`), never in shared packages (`packages/`). Defer Langfuse and all other observability tools until a concrete pain point arises.

See [ADR-011](./research/decisions/011-monitoring-observability.md) for full rationale.

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
