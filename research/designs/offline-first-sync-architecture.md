# Design: Offline-First Sync Architecture

**Date:** 2026-03-07
**Status:** Accepted
**Related ADR:** [ADR-006](../decisions/006-offline-first-sync-architecture.md)
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context & Scope

PomoFocus is a multi-platform Pomodoro app where the timer is the core feature. The timer must work offline, and completed sessions must eventually reach the server (Supabase Postgres) without data loss. The app targets 9 platforms with three distinct runtime environments: JavaScript/TypeScript (React Native, Next.js, VS Code), Swift (watchOS, macOS menu bar, iOS widget), and C++ (BLE device firmware). Cloud sync is a paid subscription feature.

The data model (ADR-005) is append-heavy and single-writer: sessions are created, not collaboratively edited. Goals and preferences are owned by one user. Social features use scoped server-side functions — friends never write to each other's data. This means the sync problem is simpler than collaborative document editing: it's a write queue with retry, not a CRDT merge.

## Goals & Non-Goals

**Goals:**
- Sessions completed offline are never lost — they reach the server when connectivity returns
- One conceptual sync model across all 9 platforms
- Pure sync protocol in `packages/core/sync/` (no IO, testable, portable to Swift)
- Idempotent writes — retries never create duplicates
- Works for free users (offline-only) and paid users (offline + sync)

**Non-Goals:**
- Real-time collaborative editing (shared goals, co-working sessions) — not in scope
- Sub-second sync latency — polling at 30s (ADR-003) is sufficient
- Supabase Realtime WebSocket subscriptions — deferred per ADR-003
- Conflict-free replicated data types (CRDTs) — data model doesn't require them
- Offline-first for read-heavy data (analytics, friend activity) — these are server-computed and cached via TanStack Query

## The Design

### Sync Model Overview

The sync architecture has two channels:

1. **Outbox (client -> server):** Local writes go to a persistent outbox queue. A background process uploads queued writes via the Hono REST API on CF Workers ([ADR-007](../decisions/007-api-architecture.md)) when connectivity is available. Each write is idempotent (UUID primary key + ON CONFLICT DO NOTHING).

2. **Pull (server -> client):** TanStack Query polls the CF Workers API at 30-second intervals (ADR-003). Fresh data replaces the local cache. Server is the source of truth.

```
+------------------+     outbox queue      +------------------+     +------------------+
|                  |  ---- upload --->     |   CF Workers     | --> |                  |
|   Device Local   |                       |   Hono API       |     |   Supabase       |
|   Storage        |  <--- poll (30s) ---  |   (ADR-007)      | <-- |   Postgres       |
|                  |                       +------------------+     |                  |
+------------------+                                                +------------------+
```

### Outbox Queue State Machine

The outbox is a pure state machine in `packages/core/sync/`:

```
States:  pending -> uploading -> confirmed
                  \-> failed -> pending (retry)

Events:
  ENQUEUE(record)     -> adds to queue as 'pending'
  UPLOAD_START(id)    -> transitions to 'uploading'
  UPLOAD_SUCCESS(id)  -> transitions to 'confirmed', removes from queue
  UPLOAD_FAILURE(id)  -> transitions to 'failed', increments retryCount
  RETRY(id)           -> transitions back to 'pending'
  NETWORK_AVAILABLE   -> triggers UPLOAD_START for all 'pending' items
```

This mirrors ADR-004's timer pattern: `processQueue(queue, event) -> newQueue` is a pure function. Platform drivers handle the actual network calls and queue persistence.

### Conflict Resolution

PomoFocus's data falls into two categories with different conflict strategies:

**Append-only data (sessions, breaks, encouragement_taps):**
- Client generates UUID before saving locally (ADR-005: `gen_random_uuid()`)
- Server uses `INSERT ... ON CONFLICT (id) DO NOTHING`
- Retries are inherently safe — same UUID = same record, ignored on duplicate
- Two sessions created on different devices offline = two different sessions (different UUIDs). Not a conflict.

**Updatable data (user_preferences, long_term_goals, process_goals):**
- Server adds a `version` column (integer, starts at 1)
- Client reads current version, makes local change, uploads with `WHERE version = N`
- If another device updated first (version is now N+1), the upload fails (0 rows affected)
- On conflict: client re-fetches server state, re-applies change, retries with new version
- For preferences specifically: last-write-wins is acceptable (user changed a setting on two devices — the last one they touched should win)

### Platform Sync Topology

All sync traffic routes through the Hono REST API on Cloudflare Workers ([ADR-007](../decisions/007-api-architecture.md)). No platform talks to Supabase directly.

```
                          +------------------+
                          |   CF Workers     |
                          |   Hono API       |
                          +--------+---------+
                                   |
                          +--------+---------+
                          |   Supabase       |
                          |   Postgres       |
                          +--------+---------+
                                   ↑
              +--------------------+--------------------+
              |                    |                    |
     +--------+--------+  +-------+--------+  +-------+--------+
     | React Native     |  | Next.js Web    |  | VS Code Ext    |
     | (iOS + Android)  |  |                |  |                |
     | Expo SQLite      |  | IndexedDB      |  | globalState    |
     +--------+---------+  +----------------+  +----------------+
              |
     +--------+--------+
     | WatchConnectivity|
     +--------+---------+
              |
     +--------+---------+
     | Apple Watch       |
     | SwiftData         |
     +-------------------+

     +-------------------+
     | macOS Menu Bar    |
     | SwiftData         |  --- CF Workers API (always online) --->
     +-------------------+

     +-------------------+
     | iOS Widget        |
     | App Group shared  |  --- reads from iPhone app's local storage --->
     +-------------------+

     +-------------------+
     | BLE Device        |
     | Local flash       |  --- BLE GATT ---> Phone app ---> CF Workers API
     +-------------------+

     +-------------------+
     | Claude Code MCP   |
     | (Node.js)         |  --- CF Workers API (always online) --->
     +-------------------+
```

**Platform-specific notes:**

- **Apple Watch:** Syncs through iPhone via WatchConnectivity. Watch has its own SwiftData outbox. When paired with iPhone, queued writes transfer to iPhone's outbox for upload. When iPhone is unavailable, watch queues locally until next pairing.
- **iOS Widget:** Read-only surface. Reads from iPhone app's local storage via App Group. No outbox needed.
- **BLE Device:** No network. Stores sessions in local flash. Phone app reads via BLE GATT characteristics and adds to its own outbox. Uses `device_sync_log` table (ADR-005) for incremental sync.
- **macOS Menu Bar:** SwiftUI app with API access via generated Swift client (Mac is typically online). Still has a local SwiftData outbox for offline resilience. Routes through CF Workers API per ADR-007.
- **MCP Server:** Node.js process with full network. API calls via generated TypeScript client. No local persistence needed — if Claude Code is running, network is available. Routes through CF Workers API per ADR-007.

### Package Structure

```
packages/
  core/
    sync/
      outbox.ts          # OutboxQueue type, processQueue() pure function
      conflict.ts        # Conflict detection rules (version check, dedup)
      types.ts           # OutboxEntry, SyncEvent, SyncState types
  data-access/
    sync/
      outbox-driver.ts   # Persists queue to Expo SQLite / IndexedDB
      uploader.ts        # Uploads queued writes via generated OpenAPI client (CF Workers API)
      network.ts         # Network connectivity detection
      pull.ts            # TanStack Query polling configuration

native/
  apple/
    Shared/
      Sync/
        OutboxQueue.swift    # Swift port of core/sync/outbox.ts
        SyncDriver.swift     # SwiftData persistence + URLSession upload
```

The sync protocol in `core/sync/` defines:
- The outbox queue data structure and state transitions (pure)
- Conflict detection rules (pure)
- Retry policy: exponential backoff with jitter, max 5 retries, then surface error to user (pure)

The sync drivers in `data-access/sync/` handle:
- Persisting the outbox queue to platform-specific storage
- Uploading queued writes via generated OpenAPI client (routes through CF Workers API per ADR-007)
- Detecting network state changes
- Triggering queue processing on connectivity events

### Data Flow: Complete Session Lifecycle

1. User starts timer on phone (offline)
2. Timer runs locally (ADR-004: pure state machine, platform driver)
3. User completes 25-minute Pomodoro
4. Timer driver calls `core/sync/outbox.processQueue(queue, ENQUEUE(sessionRecord))` -> new queue with pending entry
5. `data-access/sync/outbox-driver` persists the updated queue to Expo SQLite
6. `data-access/sync/network` detects connectivity restored
7. `data-access/sync/uploader` reads pending entries, calls CF Workers API via generated OpenAPI client
8. API forwards to Supabase with user's JWT; Supabase accepts (or ignores duplicate via ON CONFLICT)
9. `core/sync/outbox.processQueue(queue, UPLOAD_SUCCESS(id))` -> entry removed from queue
10. TanStack Query's next 30s poll fetches all sessions, including the newly synced one
11. Local cache is updated, UI reflects server state

### Free vs Paid Users

- **Free users:** Outbox queue still exists locally. Writes persist to local storage for local display. Upload step is skipped (no auth token / sync disabled). Pull polling is disabled. App works fully offline with local data only.
- **Paid users:** Full sync. Outbox uploads when online. Pull polling active. Multi-device sync works.

This means the sync infrastructure exists for all users — paid just enables the upload and pull channels.

## Alternatives Considered

**PowerSync:** The market leader for Supabase offline sync. Rejected because: (1) no Swift SDK — still requires custom sync for 3 Apple platforms, (2) $49/month at production scale, (3) solves CRDT-level conflicts that PomoFocus's append-heavy data doesn't have, (4) adds an intermediary service between app and Supabase. See [ADR-006](../decisions/006-offline-first-sync-architecture.md) for full comparison.

**ElectricSQL:** Production-ready at v1.0, focuses on read-path sync (Postgres -> client via "shapes"). Would handle the pull side well but doesn't address offline writes — still need a custom outbox. Community Swift client exists but is not official. Rejected because it solves half the problem while adding a dependency.

**TanStack Query cache + retry:** The minimal approach. Rejected because it's not truly offline-first (cold start with no network = blank screen), in-memory retry queue loses data on force-quit, and only works for JS/TS platforms.

## Cross-Cutting Concerns

- **Security:** Outbox entries include the user's auth token (managed by `data-access/`, never in `core/`). Supabase RLS (ADR-005) validates every write server-side. A malicious client cannot write data for another user. Idempotency keys (UUIDs) prevent replay attacks from creating extra records.

- **Cost:** $0/month additional infrastructure. All sync happens via the Hono REST API on CF Workers (ADR-007), which forwards to Supabase. No separate sync service to host or pay for.

- **Observability:** Outbox queue depth is exposed as a Zustand store value (via `packages/state/`). UI can show "3 sessions pending sync" indicator. Failed uploads surface as user-visible warnings after max retries. Server-side: Supabase logs all REST API calls.

- **Migration path:** If the data model grows to require collaborative features or real-time sync, PowerSync or ElectricSQL can be adopted as a replacement for the outbox driver in `data-access/sync/` without changing the pure sync protocol in `core/sync/`. The `core/sync/` interface (processQueue, conflict rules) remains stable — only the IO layer changes.

## Open Questions

1. **Exact retry policy parameters:** Exponential backoff base (1s? 2s?), max retries (5? 10?), jitter range. To be decided during implementation based on testing.
2. **Offline read cache warming:** When a paid user opens the app offline, should the last-known server state be persisted locally for display? Current design says TanStack Query cache is ephemeral — may need persistence middleware (TanStack Query has `persistQueryClient`).
3. **Watch-to-phone transfer reliability:** WatchConnectivity's `transferUserInfo` is queued and guaranteed delivery, but timing is unpredictable. Need to test whether this is reliable enough or if the watch needs its own direct Supabase upload path as fallback.
4. **Schema migration for `version` column:** ADR-005's current schema doesn't include a `version` column on updatable tables. A migration will be needed before implementing optimistic locking.
