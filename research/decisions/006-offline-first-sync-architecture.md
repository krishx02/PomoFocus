# ADR-006: Offline-First Sync Architecture

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 1 (System) — data flow between all runtime units and the backend
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context and Problem Statement

PomoFocus targets 9 platforms with wildly different connectivity profiles: always-online (web), intermittent (Apple Watch, mobile), and never-online (BLE device). A Pomodoro timer must never fail because of a network issue — users must be able to start, complete, and record sessions entirely offline, with data syncing to Supabase when connectivity is available. Cloud sync is a paid subscription feature, meaning the app must work fully offline for free users, with sync as an optional layer. The question is: what sits between each device's local state and the Supabase Postgres database (ADR-005), and how are conflicts resolved when the same user operates on multiple devices?

## Decision Drivers

- **Data integrity above all** — no session data can be lost, no ghost duplicates
- **Platform coverage** — one conceptual sync model across all 9 platforms, even though implementations differ (TypeScript vs Swift vs C++)
- **Simplicity and reliability** — solo founder must understand every line of sync code; debuggable without vendor support
- **Consistency with existing architecture** — must mirror the pure-function-in-core pattern from ADR-004 and respect ADR-003's polling-first strategy
- **Cost** — no per-month sync service costs at MVP scale

## Considered Options

1. **PowerSync (JS/TS) + Custom Swift sync** — managed sync engine for React Native + Web, custom SwiftData queue for Apple native platforms
2. **Custom outbox sync (shared protocol, two implementations)** — pure sync protocol in `packages/core/`, platform-specific drivers in `packages/data-access/` (TS) and `native/` (Swift)
3. **TanStack Query cache + retry queue (minimal approach)** — no local database, TanStack Query as cache, thin retry queue for failed writes

## Decision Outcome

Chosen option: **"Custom outbox sync (shared protocol, two implementations)"**, because PomoFocus's data model is append-heavy and single-writer — a much simpler problem than the collaborative/CRDT sync that engines like PowerSync and ElectricSQL are built to solve. The custom approach mirrors the timer pattern (ADR-004): pure sync logic in `packages/core/sync/`, platform-specific drivers in `packages/data-access/` (TypeScript) and `native/` (Swift). It covers all 9 platforms with one conceptual model, costs $0/month, and is fully debuggable by a solo founder.

### Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Sync model | Outbox queue (client → server) + polling pull (server → client) | Matches ADR-003's polling-first strategy; append-heavy data doesn't need real-time push |
| Conflict strategy | Idempotent inserts (UUID + ON CONFLICT DO NOTHING) for new records; optimistic version locking for updates | Client-generated UUIDs (ADR-005) make retries safe; version column prevents stale overwrites |
| Local storage (JS/TS) | Expo SQLite (mobile), IndexedDB (web), VS Code globalState (extension) | Platform-appropriate persistent storage for the outbox queue |
| Local storage (Swift) | SwiftData (watchOS, macOS menu bar, iOS widget) | Native persistence, shared via App Group where needed |
| Sync protocol location | Pure functions in `packages/core/sync/` | Same pattern as timer (ADR-004): `processQueue(queue, event) -> newQueue` |
| Sync drivers location | `packages/data-access/` (TypeScript), `native/` (Swift) | IO-heavy upload/download logic stays outside `core/` |
| Watch sync topology | Watch -> WatchConnectivity -> iPhone -> CF Workers API -> Supabase | Watch never talks to Supabase directly; phone acts as gateway. All traffic routes through the API (ADR-007). |
| BLE device sync | Device -> BLE GATT -> Phone app -> CF Workers API -> Supabase | Device has no network; phone relays data through the API |
| MCP server sync | MCP -> CF Workers API -> Supabase (always online) | MCP server makes HTTP calls to the API like any other client (ADR-007) |
| Queue persistence | Writes survive app restart; no cap on queue size | Pomodoro records are small; even a week offline = ~50 entries |
| Source of truth | Server (Supabase Postgres) | Clients are local caches with outbox queues; server state wins on conflict |

### Consequences

- **Good:** One conceptual sync model across all 9 platforms. Zero vendor dependency, $0/month. Mirrors the proven ADR-004 timer pattern (pure logic + platform drivers). Perfectly matched to the actual data model (append-heavy, single-writer). Sync protocol is testable as pure functions. Client-generated UUIDs make retries inherently safe.
- **Bad:** Two implementations (TypeScript + Swift) can diverge — bugs may appear in one but not the other. Solo founder owns all sync bugs with no vendor support. If the data model grows to include collaborative features (shared goals, real-time co-working), this architecture may not scale without significant rework.
- **Neutral:** Adds sync-related modules to `packages/core/` and `packages/data-access/` but does not create a new package. The outbox queue is a new concept for this codebase but is a well-understood pattern in the industry.

## Pros and Cons of the Options

### PowerSync (JS/TS) + Custom Swift Sync

- Good, because battle-tested Supabase integration — [official Supabase partner](https://supabase.com/partners/integrations/powersync)
- Good, because handles local SQLite, upload queue, and server-to-client streaming out of the box
- Good, because [self-hostable open edition](https://github.com/powersync-ja) available
- Bad, because no Swift SDK — still requires custom sync for watchOS, macOS, iOS widget (two sync implementations anyway)
- Bad, because [$49/month at production scale](https://www.powersync.com/pricing); free tier deactivates after 1 week of inactivity
- Bad, because solves a harder problem than needed — CRDT-level sync for append-only data is overkill
- Bad, because adds an intermediary service between app and Supabase — another failure point and operational dependency

### Custom Outbox Sync (Shared Protocol, Two Implementations)

- Good, because one conceptual model across all 9 platforms
- Good, because zero vendor dependency, $0/month
- Good, because perfectly matched to append-heavy, single-writer data model
- Good, because mirrors ADR-004's pure-function pattern — consistent architecture
- Good, because sync protocol is pure and testable without mocking
- Bad, because solo founder builds and maintains all sync logic
- Bad, because two implementations (TS + Swift) means bugs can diverge
- Bad, because if data model grows to collaborative editing, this approach won't scale

### TanStack Query Cache + Retry Queue (Minimal Approach)

- Good, because simplest possible approach — barely any new code
- Good, because TanStack Query already handles caching, deduplication, background refetch (ADR-003)
- Bad, because not truly offline-first — cold start without network shows nothing
- Bad, because cached data is ephemeral (cleared on app restart unless persistence is added)
- Bad, because only works for JS/TS platforms — Apple Watch, macOS menu bar, BLE device can't use TanStack Query
- Bad, because in-memory retry queue means force-quit while offline = lost data (violates data integrity requirement)

## Research Sources

- [Expo Local-First Architecture Guide](https://docs.expo.dev/guides/local-first/) — Expo's recommendations for local-first libraries
- [PowerSync + Supabase Integration](https://www.powersync.com/blog/bringing-offline-first-to-supabase) — how PowerSync works with Supabase
- [ElectricSQL 1.0 Release](https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released) — production-ready Postgres sync engine
- [ElectricSQL vs PowerSync Comparison](https://www.powersync.com/blog/electricsql-vs-powersync)
- [The Spectrum of Local First Libraries](https://tolin.ski/posts/local-first-options) — landscape overview
- [PowerSync Pricing](https://www.powersync.com/pricing) — free tier, Pro ($49/month), Team ($599/month)
- [Supabase Offline Discussion](https://github.com/orgs/supabase/discussions/357) — community discussion on native offline support
- [Offline-First React Native with WatermelonDB + Supabase](https://supabase.com/blog/react-native-offline-first-watermelon-db) — alternative approach
- [Building Offline-First React Native Apps (2026)](https://javascript.plainenglish.io/building-offline-first-react-native-apps-the-complete-guide-2026-68ff77c7bb06) — best practices guide
- [ElectricSync — Swift Client for ElectricSQL](https://github.com/paulharter/ElectricSync) — community Swift client

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — sync protocol lives in `packages/core/sync/`, sync drivers in `packages/data-access/`. No new package needed.
- [ADR-002: Auth Architecture](./002-auth-architecture.md) — sync uploads include auth token from `data-access/`; `core/sync/` receives `userId: string`, never a session or token.
- [ADR-003: Client State Management](./003-client-state-management.md) — polling-first (30s) strategy feeds the pull side of sync. TanStack Query caches server responses. Zustand stores consume outbox queue state for UI.
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — sync mirrors the timer pattern: pure state machine in `core/`, platform-specific drivers elsewhere. Timer completion events trigger outbox writes.
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — client-generated UUIDs enable idempotent inserts. `device_sync_log` table supports BLE incremental sync. All 12 tables participate in sync.
- [ADR-007: API Architecture](./007-api-architecture.md) — all sync traffic (outbox uploads, polling pulls) routes through the Hono REST API on CF Workers. Sync drivers in `data-access/` use the generated OpenAPI client, not the Supabase SDK directly.
