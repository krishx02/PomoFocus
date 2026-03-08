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
| **Supabase** (Postgres + RLS + Realtime) | TypeScript SDK, self-hostable, row-level security, real-time subscriptions, generous free tier. Zero-cost MVP infrastructure. |

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
| **SwiftUI + WidgetKit + MenuBarExtra** | Only real option for a native macOS menu bar widget. Separate Xcode project in `native/mac-widget/`. |

---

## iOS Widget

> **Status:** Accepted
> **Research:** [research/04-stack-recommendations.md](./research/04-stack-recommendations.md)

| Choice | Why |
|--------|-----|
| **SwiftUI + WidgetKit** (iOS 17+) | Home screen + Smart Stack. Shares timer state via App Group with the Expo app's native module. |

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
| Data | `@pomofocus/data-access` | All Supabase IO. Core never knows about Supabase. |
| State | `@pomofocus/state` | Zustand stores + TanStack Query hooks. Wraps core + data-access for React apps. See [ADR-003](./research/decisions/003-client-state-management.md). |
| Presentation | `@pomofocus/ui` | Shared React/RN components. Props typed from types. |
| Infrastructure | `@pomofocus/ble-protocol` | BLE GATT profile from Protobuf. Only mobile + web. |

Apps: `web/` (Next.js), `mobile/` (Expo), `vscode/`, `mcp-server/` (placeholder). Native: `ios-widget/`, `mac-widget/`, `watchos/`. Firmware: `device/` (ESP32).

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

OAuth providers: Apple Sign-In (required), Google, email/password. Deferred sign-up via `signInAnonymously()` → `linkIdentity()`. Per-platform token distribution: browser OAuth (web/mobile), token sharing via Keychain/App Group (widgets/watch), stored tokens (VS Code/MCP), phone-as-proxy (BLE device). Supabase Auth is the sole long-term provider — no planned migration to Better Auth. Auth imports confined to `packages/data-access/`; `packages/core/` receives `userId: string`.

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

Architecture: pure `transition(state, event) → newState` function in `packages/core/timer/`. No intervals, no IO, no side effects. Each platform owns its own timer driver (setInterval for React apps, Foundation Timer for Swift, millis() for ESP32). States: idle → focusing → paused → short/long break → break_paused → reflection → completed/abandoned. Persistence via `startedAt` timestamps for rehydration after app kill.

---

### API Design

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 6 (session CRUD), 9 (social features API), 10 (analytics queries)
> **What I need to learn:** Whether we need a custom API layer at all vs using Supabase client SDK directly. If we do, REST vs tRPC vs GraphQL. How the Cloudflare Workers edge layer fits into the API architecture. Pagination patterns for feeds and analytics.
> **Key questions:**
> - Supabase client SDK directly vs a custom API layer — when is direct access fine and when do we need server-side logic?
> - If we need an API layer, does it live on Cloudflare Workers or Vercel serverless functions?
> - What API patterns do social features need (friend requests, presence, feed)?

---

### Offline-First Sync Architecture

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (device works offline), 12 (rabbit hole: "don't build a custom CRDT"), 6 (sessions recorded offline)
> **What I need to learn:** What "offline-first" actually means in implementation. How Supabase's real-time sync works and its limitations. Whether we need something like PowerSync or ElectricSQL for true local-first. Conflict resolution strategies when the same data is modified on multiple devices.
> **Key questions:**
> - Supabase real-time only vs PowerSync/ElectricSQL — what are the actual tradeoffs for our use case?
> - What happens when a user completes sessions offline on both their phone and the web — how do conflicts resolve?
> - How much local caching do we need? SQLite on device? AsyncStorage? Something else?

---

## Edge & Infrastructure

---

### Edge / Sync Layer

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (device sync), 9 (Library Mode presence), 12 (cloud sync)
> **What I need to learn:** What Cloudflare Workers and Durable Objects actually are — I understand them at a high level but not how they work in practice. Why an edge layer at all instead of just talking to Supabase directly. What specific problems the edge layer solves (presence? rate limiting? BLE relay? real-time sync?).
> **Key questions:**
> - What is a Durable Object and when would I use one vs a regular Worker?
> - What specific PomoFocus features require an edge layer that Supabase alone can't handle?
> - Is this needed for v1 or can we defer it until we need real-time presence (Library Mode)?

---

### Long-lived Processes

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (BLE gateway), 10 (analytics aggregation)
> **What I need to learn:** What "long-lived processes" means in the context of serverless. Why Cloudflare Workers (which have execution time limits) can't handle certain tasks. What Railway is and how it fits. Whether this is needed for v1 at all.
> **Key questions:**
> - What specific tasks can't run on Workers due to time/resource limits?
> - Is any long-lived process needed for v1, or is this entirely post-v1?
> - If needed, Railway vs Fly.io vs a simple always-on server — what's the simplest option?

---

### CI/CD Pipeline Design

> **Status:** Needs /tech-design
> **Product brief ref:** Section 12 (iOS + web + ESP32 device), research: [03-github-actions-ci-cd.md](./research/03-github-actions-ci-cd.md)
> **What I need to learn:** How to set up GitHub Actions for a monorepo with multiple platforms. What Fastlane is and whether we need it for iOS. How preview deployments work per PR. How Claude Code Action fits into CI. How to build and deploy firmware for ESP32.
> **Key questions:**
> - What GitHub Actions workflows do we need? One per platform or a matrix build?
> - Is Fastlane worth the setup cost for a solo developer, or can Expo EAS handle iOS builds?
> - How do we CI/CD firmware — can we compile and test ESP32 code in GitHub Actions?

---

### Security & Data Privacy

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 7 (paid subscription = user data), 9 (social features = shared data), 5 (BLE pairing)
> **What I need to learn:** What security measures a consumer app handling focus/productivity data actually needs. GDPR requirements for EU users. How BLE pairing security works (can someone sniff my session data?). OAuth provider deep dive — what data do we get and store from each provider.
> **Key questions:**
> - What data do we encrypt at rest vs in transit vs not at all?
> - What GDPR obligations apply — data export, deletion, consent?
> - How secure is BLE pairing, and what are the actual risks of someone intercepting timer/goal data?

---

### Monitoring & Observability

> **Status:** Needs /tech-design
> **Product brief ref:** All sections (cross-cutting concern)
> **What I need to learn:** What error tracking, performance monitoring, and logging look like for a multi-platform app. What tools exist (Sentry, LogRocket, Datadog, etc.) and what's appropriate for a solo developer. How to monitor Cloudflare Workers and Supabase health.
> **Key questions:**
> - Sentry vs LogRocket vs Datadog vs something simpler — what's right for a solo dev with users on iOS, web, and a BLE device?
> - What do we monitor from day one vs add later? Error rates, crash reports, API latency?
> - How does Langfuse (for agent observability) fit alongside app monitoring?

---

## Device & Hardware

---

### Device Hardware

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (device architecture: display + buttons + BLE), 12 (LILYGO T-Display S3, no e-ink for v1), 13 (BLE research thread)
> **What I need to learn:** Which specific ESP32 board to buy and why (LILYGO T-Display S3 is mentioned but I don't know its specs). What display options exist (OLED vs LCD vs TFT). What buttons/input mechanisms work. Battery vs USB power. What to actually order to start prototyping — I have no hardware background.
> **Key questions:**
> - LILYGO T-Display S3 — what exactly is it, what's included, and is it the right starting point?
> - What display size/type shows goals + timer readably? What resolution/viewing angle tradeoffs exist?
> - Battery-powered vs always-plugged-in — what's simpler for v1?

---

### BLE Libraries & Protocol

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (BLE sync between device and app), 12 (goals push to device, sessions push to app), 13 (BLE research thread)
> **What I need to learn:** How BLE actually works at a protocol level — services, characteristics, GATT profiles. How to design a sync protocol for goal/session data. How react-native-ble-plx and Web Bluetooth APIs work. Pairing and reconnection behavior.
> **Key questions:**
> - What does the GATT profile look like for PomoFocus? What services/characteristics do we define?
> - How does sync work — polling vs notifications vs a custom protocol? What happens when data is larger than one BLE packet?
> - react-native-ble-plx on iOS + Web Bluetooth on web — how different are the APIs? Can we share any code?

---

### Device Firmware Stack

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 5 (device architecture), 12 (timer runs independently, local storage, BLE stack)
> **What I need to learn:** What language to write ESP32 firmware in — Arduino/C++ vs MicroPython vs Rust. What an RTOS is and whether I need one. How to drive a display from firmware. How to implement BLE on the firmware side. Development workflow (flash, debug, iterate).
> **Key questions:**
> - Arduino/C++ vs MicroPython vs ESP-IDF (C) vs Rust — which has the best learning curve for someone with no embedded experience?
> - Do I need an RTOS (FreeRTOS) or can I get away with a simple loop for v1?
> - What does the development loop look like — how do I flash, test, and debug firmware?

---

## Platform-Specific

---

### iOS Widget Architecture

> **Status:** Needs /tech-design
> **Product brief ref:** Sections 4 (widget as craving intervention), 12 (cumulative progress surfaces), 12 (rabbit hole: widget design constraints)
> **What I need to learn:** How WidgetKit actually works — timeline providers, refresh policies, data sharing. How an Expo/React Native app shares data with a Swift widget via App Group. What data to show on the widget and what constraints exist (size classes, update frequency). Lock screen vs home screen widget differences.
> **Key questions:**
> - How does an Expo app share data with a WidgetKit widget? App Group + UserDefaults vs App Group + shared SQLite?
> - What are the actual widget refresh constraints? Can we show "live" session time or only periodic snapshots?
> - What widget sizes should we support, and what data fits in each?

---

## Features

---

### Analytics & Insights Architecture

> **Status:** Needs /tech-design
> **Product brief ref:** Section 10 (three tiers of analytics, Focus Score formula, all metrics defined)
> **What I need to learn:** How to compute Focus Score efficiently (composite of self-reported quality + completion rate + consistency + trend). Storage strategy — pre-aggregate vs query on demand. Cold start problem (what to show before enough data). How to structure queries for weekly insight cards and monthly deep views.
> **Key questions:**
> - Pre-compute aggregates (materialized views? cron job?) vs compute on read — which works at our scale?
> - What's the cold start strategy? How many sessions before Focus Score and insights are meaningful?
> - Where does analytics computation run — client-side, Supabase functions, or edge workers?

---

### Social Features Architecture

> **Status:** Needs /tech-design
> **Product brief ref:** Section 9 (friends, Library Mode, Quiet Feed, encouragement taps, invite links — all specified in detail)
> **What I need to learn:** How to model friendships in Postgres (symmetric mutual friendships, not follower/following). Presence system design for Library Mode (who's focusing right now). Quiet Feed implementation (one entry per day per friend). Privacy model — what's visible to friends vs public. Invite link flow (web URL → friend request).
> **Key questions:**
> - How do we model mutual friendships in Postgres with RLS? Symmetric join table?
> - Presence (Library Mode) — polling vs real-time? How do we know someone is "currently focusing" across devices?
> - Invite links — how does the flow work from a shared URL to a friend connection?

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
