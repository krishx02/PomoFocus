# Technical Design Decisions

> **Purpose:** Single checklist of every technical decision needed before (and during) v1 development. Decided items are reference entries. Open items are queued for `/tech-design` sessions.
>
> **How to use:** Run `/tech-design [Decision Name]` on any open item. The skill will research options, challenge assumptions, and produce an Architecture Decision Record (ADR) linked back here.

---

# Decided

These are tool/framework choices that are understood and committed. No `/tech-design` needed — just reference entries.

---

## Database

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **Supabase** (Postgres + RLS) | TypeScript SDK, self-hostable, row-level security, generous free tier. Zero-cost MVP infrastructure. Clients access Supabase exclusively through the Hono REST API on CF Workers (ADR-007) — never directly via Supabase SDK. Realtime WebSockets deferred (ADR-003). |

---

## Auth

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **Supabase Auth** (sole provider, long-term) | Seamless RLS integration via `auth.uid()`. Zero cost at MVP scale (50k MAUs free). Built-in anonymous auth for deferred sign-up. See [ADR-002](./research/decisions/002-auth-architecture.md). |

---

## Web Hosting

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **Vercel** (Next.js) | First-class Next.js deployment. Preview deployments per PR. Generous free tier for personal projects. |

---

## Mobile Framework

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **Expo / React Native** | Code sharing with web + VS Code extension. Managed workflow. BLE via react-native-ble-plx. Maestro E2E testing. |

---

## macOS Widget *(post-v1)*

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **SwiftUI + WidgetKit + MenuBarExtra** | Only real option for a native macOS menu bar widget. Separate Xcode project in `native/apple/mac-widget/`. |

---

## iOS Widget

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md), [ADR-017](./research/decisions/017-ios-widget-architecture.md)

| Choice | Why |
|--------|-----|
| **SwiftUI + WidgetKit** (iOS 17+) via `@bacons/apple-targets` | Home screen + Lock Screen. App Group UserDefaults for data sharing. `AppIntentConfiguration` for user-customizable stats. See ADR-017. |

---

## Apple Watch *(post-v1)*

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **SwiftUI + WatchKit** (watchOS 10+) | Companion app + Complications. `WKExtendedRuntimeSession` for background timer. |

---

## VS Code Extension *(post-v1)*

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **VS Code Extension API** + shared `@pomofocus/core` | WebView renders same React UI as web. Shares timer logic via core package. |

---

## Claude Code Extension *(post-v1)*

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **MCP Server** | Official extension mechanism for Claude Code. Exposes timer control as tool calls. |

---

## Monorepo Tooling

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **Nx + pnpm** | Generators, affected detection, task caching, prior experience. Industry standard for TypeScript monorepos. |

---

## Testing Frameworks

> **Date:** 2026-03-06
> **Status:** Accepted
> **Research:** [research/08-testing-frameworks.md](./research/08-testing-frameworks.md)

| Platform | Tool | Why |
|----------|------|-----|
| Next.js / React web (E2E) | **Playwright** | State of JS 2025: overtook Cypress in adoption (45%) and retention (94%); cross-browser; Next.js docs lead with it |
| Expo / React Native (E2E) | **Maestro** | Officially recommended by Expo; minimal setup; works with managed workflow; cloud testing option |
| VS Code extension (integration) | **@vscode/test-electron** | Microsoft's official standard; full extension host API access |
| Swift/SwiftUI (unit/integration) | **Swift Testing** | Apple WWDC 2024 official direction; modern macros; async-native; open-source |
| Swift/SwiftUI (UI automation) | **XCTest / XCUITest** | Still required — Swift Testing doesn't support UI automation yet |
| All TypeScript (unit/integration) | **Vitest** | 4-20x faster than Jest; native ESM and TypeScript; aligns with Vite ecosystem |
| HTTP API integration | **Vitest + Supertest** | Supertest provides clean HTTP assertion API; works with any runner |
| Visual regression (web) | **Playwright screenshots** | Built-in `toHaveScreenshot()`; free; no SaaS dependency; escalate to Percy/Chromatic if team review dashboard needed |
| Visual regression (mobile) | **React Native Owl** (deferred) | Purpose-built for RN; set up when mobile UI stabilizes |
| Accessibility (web) | **axe-core + @axe-core/playwright** | Industry standard; zero false positives; WCAG 2.2; Playwright-native |
| Accessibility (mobile) | **axe DevTools Mobile** (deferred) | Deque's RN tooling via Appium; set up when mobile E2E infra exists |
| API contract testing | **Pact** (deferred) | ThoughtWorks ADOPT tier; consumer-driven; set up when Cloudflare Workers API layer exists |
| Schema drift detection | **Supabase type generation** | `npx supabase gen types typescript` in CI; catches DB schema drift from day one |
| Code coverage | **Vitest v8 + ratchet pattern** | 75% threshold (Google "commendable"); ratchet up quarterly; `@vitest/coverage-v8` |

All Apple targets (macOS, iOS widget, watchOS) use `xcodebuild test` as the test runner, which executes both Swift Testing and XCTest tests in the same run.

Items marked **(deferred)** are researched and decided but will be set up when their prerequisites exist. The `/pre-finalize` skill gracefully skips these until infrastructure is in place.

---

# Needs `/tech-design`

Each item below is a domain to explore and an architecture to design. Run `/tech-design [Decision Name]` to research options, make a decision, and produce an ADR. Organized by dependency — foundation first, then systems that build on it.

---

## Foundation

---

### Monorepo Package Structure

> **Date:** 2026-03-06
> **Status:** Accepted
> **ADR:** [research/decisions/001-monorepo-package-structure.md](./research/decisions/001-monorepo-package-structure.md)
> **Design doc:** [research/designs/monorepo-package-structure.md](./research/designs/monorepo-package-structure.md)

| Layer | Packages | Key Principle |
|-------|----------|---------------|
| Contracts | `@pomofocus/types` | Auto-generated from Postgres schema. Zero logic. |
| Domain | `@pomofocus/core` (timer + goals + sessions), `@pomofocus/analytics` | Pure functions. No IO, no React, no Supabase. |
| Data | `@pomofocus/data-access` | All server IO via generated OpenAPI client. Core never knows about the API. |
| State | `@pomofocus/state` | Zustand stores + TanStack Query hooks. Wraps core + data-access for React apps. See [ADR-003](./research/decisions/003-client-state-management.md). |
| Presentation | `@pomofocus/ui` | Shared React/RN components. Props typed from types. |
| Infrastructure | `@pomofocus/ble-protocol` | BLE GATT profile, shared BLE abstraction (`BleTransport` interface + sync orchestration), and Protobuf types. Transport adapters (react-native-ble-plx, Web Bluetooth) live here. |

Apps: `api/` (Hono on CF Workers), `web/` (Next.js), `mobile/` (Expo), `vscode-extension/`, `mcp-server/` (placeholder). iOS widget: `apps/mobile/targets/ios-widget/` (managed by `@bacons/apple-targets`). Native: `native/apple/mac-widget/`, `native/apple/watchos-app/`. Firmware: `firmware/device/` (nRF52840, Arduino/C++).

Cross-language type sync: Postgres schema → TS + Swift via `supabase gen types`. Protobuf → TS + Swift + C++ via `protoc`. Zero manual sync.

---

### Database Schema & Data Model

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/005-database-schema-data-model.md](./research/decisions/005-database-schema-data-model.md)
> **Design doc:** [research/designs/database-schema-data-model.md](./research/designs/database-schema-data-model.md)

| Choice | Why |
|--------|-----|
| **Normalized relational schema (12 tables, 3NF)** | Maps 1:1 to product brief concepts. All analytics queries are straightforward SQL. RLS on every table via `get_user_id()` helper. Privacy enforced at database level (friends never see raw session data). |

Tables: `profiles`, `user_preferences`, `long_term_goals`, `process_goals`, `sessions`, `breaks`, `devices`, `device_sync_log`, `friend_requests`, `friendships`, `encouragement_taps` + Supabase-managed `auth.users`. 9 Postgres enums. UUID v4 PKs, `timestamptz` always, hard deletes. Social visibility via scoped functions (`is_friend_focusing`, `did_friend_focus_today`) — not broad RLS. Dual-row friendship pattern for query/RLS simplicity. Types auto-generated via `supabase gen types`.

---

### Auth Architecture

> **Date:** 2026-03-06
> **Status:** Accepted
> **ADR:** [research/decisions/002-auth-architecture.md](./research/decisions/002-auth-architecture.md)
> **Design doc:** [research/designs/auth-architecture.md](./research/designs/auth-architecture.md)

| Choice | Why |
|--------|-----|
| **Supabase Auth** (sole provider, all platforms) | Seamless RLS integration via `auth.uid()`. Zero cost at MVP scale (50k MAUs free). Built-in anonymous auth for deferred sign-up. Apple Sign-In + Google + email/password supported. |

OAuth providers: Apple Sign-In (required), Google, email/password. Deferred sign-up via `signInAnonymously()` → `linkIdentity()`. Per-platform token distribution: browser OAuth (web/mobile), token sharing via Keychain/App Group (widgets/watch), stored tokens (VS Code/MCP), phone-as-proxy (BLE device). Better Auth was evaluated and rejected — no migration planned (ADR-002). Auth imports confined to `packages/data-access/`; `packages/core/` receives `userId: string`.

---

## Core App Systems

---

### Client State Management

> **Date:** 2026-03-06
> **Status:** Accepted
> **ADR:** [research/decisions/003-client-state-management.md](./research/decisions/003-client-state-management.md)
> **Design doc:** [research/designs/client-state-management.md](./research/designs/client-state-management.md)

| Layer | Tool | Key Principle |
|-------|------|---------------|
| Local/UI state | **Zustand** | Thin wrapper around `@pomofocus/core`. Selector-based access for performance. |
| Server state | **TanStack Query** | Wraps `@pomofocus/data-access` functions. 30s polling, no WebSockets by default. |
| Shared package | **`packages/state/`** (7th package) | Stores + query hooks shared across all React apps. Apps inject persistence adapter. |
| Persistence | **MMKV** (mobile), **localStorage** (web), **globalState** (VS Code) | Injected per-app via adapter pattern. |
| Data fetching | **Polling-first** (30s `refetchInterval`) | Supabase Realtime deferred — polling meets all v1 latency requirements. |

`@pomofocus/core` owns domain truth. Zustand stores are React rendering wrappers, not the source of truth. Native platforms (iOS widget, watchOS, BLE device) use platform bridges (App Group, WatchConnectivity, GATT), independent of the React state layer.

---

### Timer State Machine

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/004-timer-state-machine.md](./research/decisions/004-timer-state-machine.md)
> **Design doc:** [research/designs/timer-state-machine.md](./research/designs/timer-state-machine.md)

| Choice | Why |
|--------|-----|
| **Hand-rolled TypeScript state machine** (discriminated unions + pure reducer) | Zero dependencies, cross-platform portable (TS → Swift `enum` → C++ `enum class`), keeps `packages/core/` pure. XState documented as escape hatch if complexity exceeds ~10 states. |

Architecture: pure `transition(state, event) → newState` function in `packages/core/timer/`. No intervals, no IO, no side effects. Each platform owns its own timer driver (setInterval for React apps, Foundation Timer for Swift, millis() for nRF52840). States: idle → focusing → paused → short/long break → break_paused → reflection → completed/abandoned. Persistence via `startedAt` timestamps for rehydration after app kill.

---

### API Architecture

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/007-api-architecture.md](./research/decisions/007-api-architecture.md)
> **Design doc:** [research/designs/api-architecture.md](./research/designs/api-architecture.md)

| Layer | Choice | Key Principle |
|-------|--------|---------------|
| Runtime | **Cloudflare Workers** | Best cold starts (<10ms), cheapest ($5/month for 10M requests, zero egress), 300+ edge locations |
| Framework | **Hono** | Web Standards-based, runtime-portable, first-class OpenAPI support |
| API style | **REST + OpenAPI 3.1** | Language-agnostic (serves TS + Swift clients), generates SDKs |
| Schema validation | **Zod** via `@hono/zod-openapi` | Single source of truth: validates requests AND generates OpenAPI spec |
| TS client | **openapi-typescript + openapi-fetch** | Type-safe fetch client generated from OpenAPI spec |
| Swift client | **Apple swift-openapi-generator** | Async/await Swift client from same OpenAPI spec |
| Auth model | **JWT forwarding** | API validates user's Supabase JWT, forwards to Supabase — RLS applies as defense-in-depth |
| App location | **`apps/api/`** | Hono API lives alongside other apps; consumes `packages/core/` |

Clients never see Supabase URL, anon key, or raw table structures. `packages/data-access/` wraps the generated OpenAPI client (not the Supabase SDK). tRPC eliminated (Swift consumers can't use it). GraphQL eliminated (flat CRUD doesn't justify it). Auth flow decided in ADR-002 (Supabase Auth, deferred sign-up via `signInAnonymously()` → `linkIdentity()`). Remaining open: OpenAPI versioning strategy, local dev setup.

---

### Offline-First Sync Architecture

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/006-offline-first-sync-architecture.md](./research/decisions/006-offline-first-sync-architecture.md)
> **Design doc:** [research/designs/offline-first-sync-architecture.md](./research/designs/offline-first-sync-architecture.md)

| Choice | Why |
|--------|-----|
| **Custom outbox sync** (shared protocol, two implementations) | PomoFocus's data is append-heavy and single-writer — simpler than the CRDT problem that PowerSync/ElectricSQL solve. Pure sync FSM in `packages/core/sync/`, platform drivers in `data-access/` (TS) and `native/` (Swift). Mirrors the timer pattern (ADR-004). |

Architecture: outbox queue (client -> server) + polling pull (server -> client, 30s per ADR-003). All sync traffic routes through the Hono API on CF Workers (ADR-007), not directly to Supabase. Idempotent inserts via client-generated UUIDs + ON CONFLICT DO NOTHING. Optimistic version locking for updates. Watch syncs through phone via WatchConnectivity. BLE device syncs through phone. Free users: outbox exists locally but upload is disabled. Paid users: full sync enabled.

---

## Edge & Infrastructure

---

### Edge / Sync Layer

> **Date:** 2026-03-07
> **Status:** Resolved — fully covered by ADR-006 + ADR-007
> **Product brief ref:** Sections 5 (device sync), 9 (Library Mode presence), 12 (cloud sync)
> **Resolution:** The Hono API on CF Workers (ADR-007) serves as the edge layer. Custom outbox sync (ADR-006) handles offline-first data flow. Polling-first (ADR-003) handles server-to-client updates. Durable Objects are NOT used for v1 — polling at 5-10s intervals is sufficient for Library Mode presence (a 25-minute session tolerates 10s staleness). If sub-second presence is needed, Durable Objects + WebSockets can be added within the CF Workers ecosystem — no architectural change required, just a new Worker class. No separate ADR needed.

---

### Long-lived Processes

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/008-long-lived-processes.md](./research/decisions/008-long-lived-processes.md)
>
> | Choice | Why |
> |--------|-----|
> | **No always-on server for v1 — CF Workers + Cron Triggers only** | Every v1 use case is handled by Workers: BLE syncs through phone (ADR-006), analytics are per-user SQL queries (milliseconds), scheduled tasks use CF Cron Triggers. Railway/Fly.io deferred to post-v1 if batch cross-user analytics at scale requires it. |

---

### CI/CD Pipeline Design

> **Date:** 2026-03-07
> **Status:** Accepted
> **ADR:** [research/decisions/009-ci-cd-pipeline-design.md](./research/decisions/009-ci-cd-pipeline-design.md)
> **Design doc:** [research/designs/ci-cd-pipeline-design.md](./research/designs/ci-cd-pipeline-design.md)
>
> | Layer | Choice | Key Principle |
> |-------|--------|---------------|
> | Strategy | **Hybrid Incremental** | Shared `ci.yml` from day one; dormant deploy workflow templates activate as each platform becomes shippable |
> | TS CI | **Nx affected** (lint, test, type-check, build) | `ubuntu-latest`, `actions/cache` for `.nx/cache` |
> | Mobile builds | **Expo EAS Build** (not Fastlane) | Cloud builds, no macOS runner, free tier: 15 iOS + 15 Android/month |
> | Web deploys | **Vercel GitHub integration** | Zero config — connect repo, get preview deploys |
> | API deploys | **`cloudflare/wrangler-action@v3`** | Preview on PR, production on merge |
> | Firmware CI | **PlatformIO** on `ubuntu-latest` | `platformio run` + `platformio test` |
> | Agent CI | **None (local only)** | `/ship-issue` runs locally (Max subscription); Claude Code Action deferred |
> | Native Swift CI | **Deferred** | Build from Xcode locally; no macOS runners |
>
> Branch protection: single "CI Complete" required check. Secrets added incrementally per-platform (6 for v1). Cost: $0/month.

---

### Security & Data Privacy

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/012-security-data-privacy.md](./research/decisions/012-security-data-privacy.md)
> **Design doc:** [research/designs/security-data-privacy.md](./research/designs/security-data-privacy.md)

| Layer | Choice | Key Principle |
|-------|--------|---------------|
| Encryption (transit) | **TLS 1.2+** (Supabase, CF Workers, Vercel — automatic) | Platform-provided, zero configuration |
| Encryption (at rest) | **AES-256** (Supabase — automatic) | No application-level encryption needed for productivity data |
| Access control | **RLS + API gateway + JWT validation** | ADR-005 + ADR-007 defense-in-depth |
| GDPR | **Two endpoints** (`DELETE /v1/me`, `GET /v1/me/export`) + privacy policy + consent at sign-up | Right to erasure, data portability, data minimization from day one |
| OAuth data | **Minimum storage** — provider `sub`, email, display name only | Apple private relay supported. Apple name cached on first login. |
| BLE security | **LE Secure Connections + Passkey Entry + Bonding** | 6-digit passkey on e-ink, LTK bonded, AES-CCM 128-bit link encryption |
| Token storage | **Platform-secure per app** — HttpOnly cookie (web), expo-secure-store (mobile), Keychain (macOS), SecretStorage (VS Code) | No localStorage tokens |

Hard deletes (ADR-005) align with GDPR. No third-party security SDKs. $0/month. Application-level encryption and advanced BLE hardening explicitly deferred — data sensitivity does not justify the complexity.

---

### Monitoring & Observability

> **Date:** 2026-03-08
> **Status:** Accepted
> **ADR:** [research/decisions/011-monitoring-observability.md](./research/decisions/011-monitoring-observability.md)

| Layer | Tool | Key Principle |
|-------|------|---------------|
| Database / Auth / Storage | **Supabase dashboard** (built-in) | Metrics, logs, and reports out of the box. No additional setup. |
| API (Cloudflare Workers) | **CF Workers dashboard** (built-in) | Automatic tracing (open beta March 2026), request metrics, Workers Logs. |
| Web hosting | **Vercel dashboard** (built-in) | Function logs, deployment analytics, Web Vitals. |
| Client-side error tracking | **Sentry** (free tier, deferred) | 5K errors/month, source maps, session replay. Integrate at first staging deploy per platform. |
| LLM / MCP observability | **Langfuse** (deferred) | Add only when MCP server is built and token cost tracking is needed. |

Philosophy: lean on platform built-ins from day one. Add Sentry per-platform at first staging deploy. Defer everything else until a concrete pain point arises. $0/month budget.

---

## Device & Hardware

---

### Device Hardware Platform

> **Date:** 2026-03-08
> **Status:** Accepted
> **ADR:** [research/decisions/010-physical-device-hardware-platform.md](./research/decisions/010-physical-device-hardware-platform.md)
> **Design doc:** [research/designs/physical-device-hardware-platform.md](./research/designs/physical-device-hardware-platform.md)

| Component | Choice | Why |
|-----------|--------|-----|
| MCU + Board | **Seeed XIAO ePaper EN04** (nRF52840 Plus built in) | Best BLE power efficiency (~15mA active vs ~94-250mA ESP32). No WiFi needed — device syncs through phone. EN04 integrates MCU, battery charging, FPC display connector, 3 user buttons. |
| Display | **4.26" e-ink (B/W), 800x480, 219 PPI** | Calm technology: paper-like, readable in all lighting, zero power to hold image. Sharp text for goals and reflections. Readable from desk distance (~2 feet). Hybrid refresh: 1/min during focus, every 10s in last minute, full refresh at completion. |
| Input | **Rotary encoder + push button** | Teenage Engineering approach — one control, many functions. Rotate to navigate goals, click to start/pause, long-press to abandon. |
| Feedback | **Vibration motor + LED** | Calm technology: vibration respects social norms (no beeping in shared spaces). LED confirms state visually. |
| Battery | **AKZYTUE 903048 1200mAh LiPo** (JST PH 2.0mm) | ~8-10 weeks battery life. Monthly charging. Kindle-like experience. ⚠ Check polarity before connecting — no universal JST standard. |
| Connectivity | **BLE 5.0** (phone-first hub) | One connection at a time. Phone relays to cloud. Mac as fallback central. Passkey pairing via e-ink display. |
| Storage | **Internal flash (~2,500 sessions)** | Outbox sync pattern. ~10 months offline capacity. UUID-based idempotent inserts. |

Prototype BOM: ~$38 (EN04 + display + encoder + motor + LED + AKZYTUE battery). EN04 handles display SPI via FPC — 5 user GPIOs needed (encoder 3, vibration 1, LED 1). nRF52840 Plus has 20 GPIOs total (9 extra via SMD castellations). All parts ordered 2026-03-08.

---

### BLE GATT Protocol Design

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/013-ble-gatt-protocol-design.md](./research/decisions/013-ble-gatt-protocol-design.md)
> **Design doc:** [research/designs/ble-gatt-protocol-design.md](./research/designs/ble-gatt-protocol-design.md)

| Service | UUID Suffix | Purpose | Key Characteristics |
|---------|-------------|---------|---------------------|
| Timer Service | `0001` | Real-time timer state and commands | timer_state (read+notify), timer_command (write) |
| Goal Service | `0002` | Phone pushes goals, device reports selection | goal_list (write), selected_goal (read+notify) |
| Session Sync Service | `0003` | Bulk session transfer with chunking protocol | sync_status (read+notify), session_data (notify), sync_control (write) |
| Device Info Service | `0x180A` (SIG) | Battery, firmware version | Standard BLE SIG service |
| DFU Service | Nordic standard | OTA firmware updates | Nordic DFU library |

Architecture: Hybrid — structured GATT services for real-time control (timer, goals) + dedicated Session Sync Service with chunked reliable-transfer protocol for outbox drain. Adaptive MTU (16-240 bytes payload per chunk). Protobuf encoding (per ADR-010). 128-bit custom UUIDs with shared base. Open BLE advertising. Phone converts Protobuf → JSON for Hono API (ADR-007).

---

### BLE Client Libraries & Integration

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/016-ble-client-libraries-integration.md](./research/decisions/016-ble-client-libraries-integration.md)
> **Design doc:** [research/designs/ble-client-libraries-integration.md](./research/designs/ble-client-libraries-integration.md)
>
> | Platform | Library | Key Principle |
> |----------|---------|---------------|
> | iOS / Android (Expo) | **react-native-ble-plx** v3.x | Most full-featured RN BLE library. Expo config plugin — no ejecting. MTU negotiation, multi-device, guaranteed transactions. |
> | Web | **Web Bluetooth API** (browser native) | Progressive enhancement. Chrome/Edge/Opera only (~78% global). No Safari, no Firefox. |
> | macOS menu bar | **CoreBluetooth** (Apple framework) | Fallback BLE central. Post-v1. |
> | watchOS | None — WatchConnectivity relay | Data via phone. |
>
> Sync trigger: **app-open** (no background BLE for v1). User opens app → scan → connect → drain outbox. Background auto-sync deferred to v2. Shared TypeScript BLE abstraction (`BleTransport` interface + sync orchestration) in `packages/ble-protocol/` — extracted from working mobile code, not designed upfront. OS-managed pairing (no app-level auth). CoreBluetooth (Swift) needs parallel implementation — can't share TS abstraction.

---

### Device Firmware Toolchain

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/015-device-firmware-toolchain.md](./research/decisions/015-device-firmware-toolchain.md)
>
> | Sub-Decision | Choice | Why |
> |--------------|--------|-----|
> | Build system | **PlatformIO with Arduino framework** | Reproducible builds via `platformio.ini`, CLI builds for CI (`pio run`, `pio test`), runs in Cursor/VS Code. Code is standard Arduino — portable to Arduino IDE as fallback. |
> | Protobuf encoding | **Nanopb** | ~2-5KB flash vs ~150-200KB for full protoc C++. No dynamic memory allocation — all static buffers. Same `.proto` file, wire-compatible output. |
> | Sleep strategy | **System ON sleep with BLE SoftDevice active** | BLE advertising continues in sleep (~22μA) — phone auto-discovers device. GPIO interrupts wake on encoder click. No full reset on wake. Already modeled in ADR-010's power budget (8-10 weeks). |
>
> Hardware platform (EN04 board, 4.26" e-ink, GPIO allocation, prototyping phases) defined in [ADR-010](./research/decisions/010-physical-device-hardware-platform.md). BLE GATT protocol in [ADR-013](./research/decisions/013-ble-gatt-protocol-design.md).

---

## Platform-Specific

---

### iOS Widget Architecture

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/017-ios-widget-architecture.md](./research/decisions/017-ios-widget-architecture.md)
>
> | Sub-Decision | Choice | Why |
> |--------------|--------|-----|
> | Config Plugin | **`@bacons/apple-targets`** | Expo-endorsed, pure Swift widget outside `/ios`, survives `prebuild --clean`. Full WidgetKit API access including `AppIntentConfiguration`. |
> | Data sharing | **App Group + UserDefaults** | Apple's recommended mechanism for widget data. Widget stats (Tier 1 + selected Tier 2) are ~200 bytes — UserDefaults is more than sufficient. |
> | User customization | **`AppIntentConfiguration`** (iOS 17+) | Users pick which stat to display via Edit Widget sheet — Tier 1 and selected Tier 2 metrics (e.g., completion rate). Options: goal progress, weekly dots, streak, completion rate. |
> | Widget sizes | **Small + Medium + Lock Screen** | Small: single stat. Medium: up to 4 stats or weekly dots. Lock Screen: single number/progress ring. Large skipped — dashboard belongs in app. |
> | Live Activity | **Deferred** | No live timer countdown for v1. Avoids inconsistency with BLE device. Can be added later via ActivityKit (separate API). |
> | Cross-language safety | **Shared `WidgetKeys` constants** (TS + Swift) | `/align-repo` checks drift. Upgrade to JSON schema codegen if contract grows beyond ~10 keys. |
>
> Data flow: Expo app receives widget stats (Tier 1 + selected Tier 2) from API (ADR-007/ADR-014) → RN native module writes to App Group UserDefaults → calls `WidgetCenter.shared.reloadAllTimelines()` → Swift widget reads from UserDefaults, renders per user's `AppIntentConfiguration` selection. ~40-70 system-managed refreshes per day.

---

## Features

---

### Analytics & Insights Architecture

> **Status:** Accepted
> **ADR:** [research/decisions/014-analytics-insights-architecture.md](./research/decisions/014-analytics-insights-architecture.md)
> **Design doc:** [research/designs/analytics-insights-architecture.md](./research/designs/analytics-insights-architecture.md)
>
> | Choice | Why |
> |--------|-----|
> | **Hybrid — pure formulas in `packages/analytics/`, executed server-side in CF Worker API** | No composite Focus Score — individual component metrics (completion rate, focus quality, consistency, streaks) with trend arrows instead. Three tiers: Tier 1 glanceable (all platforms incl. BLE device), Tier 2 weekly insights (app only), Tier 3 monthly trends (app only). No pre-aggregation at v1 — per-user queries over ~365 rows are milliseconds (ADR-008). Grounded in Self-Determination Theory: composite scores with arbitrary weights undermine autonomy. |

---

### Social Features Architecture

> **Date:** 2026-03-09
> **Status:** Accepted
> **ADR:** [research/decisions/018-social-features-architecture.md](./research/decisions/018-social-features-architecture.md)
> **Design doc:** [research/designs/social-features-architecture.md](./research/designs/social-features-architecture.md)
>
> | Sub-Decision | Choice | Why |
> |--------------|--------|-----|
> | API pattern | **Resource-oriented REST endpoints** | Clean OpenAPI specs, each resource independently testable. Screen-scoped polling eliminates the DB load concern. |
> | Polling model | **Screen-scoped** (not global) | Only Library Mode polls, only while user is on that screen. All other social data fetched on navigate + pull-to-refresh. |
> | Library Mode polling | **Adaptive: 30s → 60s** | 30s for first 2 min on screen, then 60s. Halves request volume for sustained viewing. |
> | Presence mechanism | **Sessions table** (`ended_at IS NULL`) | No separate presence system. An active session IS the presence indicator. Client computes time remaining from `started_at + work_duration`. |
> | Privacy enforcement | **Direct JOINs in API** | Friendship JOINs in all social queries. DB functions (`is_friend_focusing`, `did_friend_focus_today`) repurposed as integration test helpers. |
> | Encouragement taps | **Toggle-style, max 3/day/pair** | Click to send, click again to un-send. Prevents spam. |
> | Invite links | **Stateless URL** (`pomofocus.app/invite/USERNAME`) | No tokens, no expiry, no DB storage. Username lookup on resolution. |
> | Friend limit | **100 max** per user | Enforced at API level on friend request acceptance. |
> | Platforms | **Mobile + Web only** for v1 | iOS widget, Watch, VS Code, MCP get no social surfaces. API is platform-agnostic for future extension. |
>
> 12 API endpoints total (7 reads, 5 mutations). Social data lives in TanStack Query (server state). Zustand only for UI state (e.g., "is Library Mode screen active"). Mutations invalidate relevant query keys.

---

### Notification Strategy

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 6 (timer end notification), 9 (encouragement tap), 10 (weekly insight card "pushed proactively")
> **What I need to learn:** Whether push notifications are needed for v1 or if in-app is sufficient. How APNs (iOS) and web push work. When to notify and when not to (the app is about focus — ironic to be a source of distraction). Notification permissions UX.
> **Key questions:**
> - What notifications are essential for v1? Timer end, encouragement taps, weekly insights — or just timer end?
> - APNs + web push vs local notifications only — what's the simplest path for v1?
> - How do we avoid becoming another notification source? What's the philosophy on interruption?

---

## Post-v1 (but may affect schema now)

---

### Billing & Subscription

> **Status:** Needs /tech-design
> **Product brief ref:** Section 7 (pricing model: free with cloud sync for v1, paid subscription later)
> **What I need to learn:** Payment processor options (Stripe, RevenueCat, Apple IAP). How subscription billing works across iOS and web. Tier structure and gating logic. What schema decisions now would make billing easier to add later (e.g., a `subscription_tier` column).
> **Key questions:**
> - Stripe vs RevenueCat vs Apple IAP only — what handles iOS + web billing with the least pain?
> - What schema columns/tables should we add now (even if unused) to avoid a painful migration when billing ships?
> - How does gating work — middleware? RLS policies? Feature flags?
