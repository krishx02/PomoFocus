# ADR-018: Social Features Architecture

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container)
**Platforms:** iOS app, Android app (Expo/React Native), web (Next.js) — all other platforms excluded from v1 social features

## Context and Problem Statement

PomoFocus's database schema (ADR-005) defines tables for friendships, friend requests, and encouragement taps, plus scoped visibility functions for Library Mode and Quiet Feed. The schema is settled — what's needed is the application architecture: API endpoint design, client-side data flow, polling strategy, invite link mechanics, and privacy enforcement approach. Social features must work within existing constraints: polling-first (ADR-003), all traffic through Hono API (ADR-007), no new infrastructure, and batch-friendly queries to minimize database load.

## Decision Drivers

- **Efficiency** — minimize database hits; one API call should return all data for a given social view, not N+1 per-friend queries
- **Privacy** — friends must never see raw session data, goal content, or reflection details (ADR-005); enforcement must be reliable
- **Simplicity** — no new infrastructure (no Redis, no Durable Objects, no WebSockets); stay within CF Workers + Supabase
- **Screen-scoped data** — social data is only needed when the user is actively viewing a social screen, not globally

## Considered Options

1. **Single composite endpoint** (`GET /v1/social`) — one Postgres function returns all social state (Library Mode + Quiet Feed + requests + taps) in one response
2. **Resource-oriented REST endpoints** — separate endpoints per social resource, each with its own query, screen-scoped polling
3. **Hybrid** — composite read endpoint + individual mutation endpoints

## Decision Outcome

Chosen option: **"Resource-oriented REST endpoints with screen-scoped polling"** (Option 2), because social features have fundamentally different refresh needs (Library Mode polls, Quiet Feed doesn't), and screen-scoped polling eliminates the global background polling concern entirely. With only Library Mode polling at 30-60s while actively viewed, database load is negligible. Clean REST endpoints align with ADR-007's OpenAPI-first approach and make each resource independently testable.

### API Endpoints

| Method | Endpoint | Purpose | Polling |
|--------|----------|---------|---------|
| `GET` | `/v1/friends` | Friend list with display info | None — pull-to-refresh |
| `GET` | `/v1/friends/focusing` | Library Mode: who's in an active session | Adaptive: 30s → 60s after 2 min on screen |
| `GET` | `/v1/feed/today` | Quiet Feed: who completed a session today | None — pull-to-refresh, `staleTime: 5min` |
| `GET` | `/v1/friend-requests` | Pending incoming friend requests | On app open, then pull-to-refresh |
| `POST` | `/v1/friend-requests` | Send friend request (by username) | N/A |
| `POST` | `/v1/friend-requests/:id/accept` | Accept a friend request | N/A |
| `DELETE` | `/v1/friend-requests/:id` | Decline a friend request | N/A |
| `DELETE` | `/v1/friends/:id` | Unfriend | N/A |
| `GET` | `/v1/taps` | Received encouragement taps (last 24h) | On app open, then pull-to-refresh |
| `POST` | `/v1/taps` | Send encouragement tap | N/A |
| `DELETE` | `/v1/taps/:id` | Remove (un-tap) encouragement | N/A |
| `GET` | `/v1/invite/:username` | Resolve invite link to profile | N/A |

### Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Polling model | **Screen-scoped** (not global) | Only Library Mode polls, only while user is on that screen. All other social data fetched on navigate + pull-to-refresh. Eliminates background DB load concern. |
| Library Mode polling | **Adaptive: 30s → 60s** | 30s for first 2 minutes on screen, then 60s. A 25-minute session tolerates 60s staleness easily. Halves request volume for sustained viewing. |
| Presence mechanism | **Sessions table** (`ended_at IS NULL`) | No separate presence system. An active session IS the presence indicator. Client computes time remaining from `started_at + work_duration`. |
| Time remaining | **Client-computed** | Server returns `started_at` and `work_duration`. Client does `remaining = work_duration - (now - started_at)`. Updates locally every 60s. No server call per tick. Pauses ignored for v1 (simple approach). |
| Session expiry | **2x work_duration safety net** | If app crashes, `ended_at` stays NULL. Queries add `started_at > NOW() - INTERVAL '2 hours'` to filter stale sessions. Application code in `core/` expires sessions after 2x configured duration. |
| Privacy enforcement | **Direct JOINs in API** | API queries include friendship JOINs. DB functions (`is_friend_focusing`, `did_friend_focus_today`) repurposed as integration test helpers to verify friendship checks. |
| Encouragement taps | **Toggle-style, max 3/day/pair** | Click to send, click again to un-send. Max 3 state changes per sender per recipient per day. Prevents spam while allowing authentic encouragement. |
| Invite links | **Stateless URL** (`pomofocus.app/invite/USERNAME`) | No tokens, no expiry, no DB storage for the link. Resolving = username lookup. Deep link to app or web profile page. |
| Quiet Feed | **Fetch-once + pull-to-refresh** | Data changes at most every 25 minutes (session length). No polling needed. 5-minute staleTime in TanStack Query. |
| Friend limit | **100 max** | PomoFocus is not a social network. 100 friends is generous for a productivity app. Enforced at API level on friend request acceptance. |

### Consequences

- **Good:** No global background polling for social data — minimal DB load. Clean REST endpoints with clear OpenAPI specs. Sessions table doubles as presence — no new tables or infrastructure. Client-side countdown eliminates per-tick server calls. Adaptive polling reduces sustained load by 50%. Integration tests using DB functions catch privacy bugs automatically.
- **Bad:** Privacy enforcement relies on developer discipline in API code (friendship JOINs). 3-4 parallel requests on social screen cold load (acceptable — TanStack Query fires concurrently). Pauses not reflected in Library Mode time remaining for v1 (shows approximate time). DB functions (`is_friend_focusing`, `did_friend_focus_today`) exist but aren't called in production — could confuse future developers.
- **Neutral:** Social features limited to mobile + web for v1. iOS widget, Apple Watch, VS Code, MCP get no social surfaces. API endpoints are platform-agnostic, so extending later is trivial. Invite link format (`/invite/USERNAME`) is somewhat locked once users share links.

## Pros and Cons of the Options

### Single composite endpoint

- Good, because one HTTP round trip and one DB call per poll cycle
- Good, because Postgres function runs all queries in a single connection
- Good, because client needs only one TanStack Query hook
- Bad, because non-standard REST — returns heterogeneous data types in one response
- Bad, because can't cache or poll individual resources at different rates
- Bad, because one large Postgres function to maintain
- Bad, because OpenAPI spec is less clean (mixed response types)

### Resource-oriented REST endpoints (chosen)

- Good, because clean REST design — each resource has its own endpoint and OpenAPI schema
- Good, because different resources can have different polling intervals (Library Mode: 30-60s, Quiet Feed: none)
- Good, because easy to test, debug, and document individually
- Good, because screen-scoped polling means only active viewers generate load
- Good, because aligns with ADR-007's Hono + `@hono/zod-openapi` approach
- Bad, because 3-4 parallel requests on social screen cold load
- Bad, because each request is a separate CF Worker invocation → separate Supabase connection

### Hybrid (composite read + resource mutations)

- Good, because one read request per poll (efficient)
- Good, because clean mutation endpoints (standard REST for writes)
- Good, because TanStack Query invalidation is simple (one query key)
- Bad, because composite read is non-standard REST
- Bad, because all social data refreshes together even when only one piece changed
- Bad, because unnecessary complexity when screen-scoped polling eliminates the load concern

## Research Sources

- [User Friends System & Database Design (CoderBased)](https://www.coderbased.com/p/user-friends-system-and-database) — dual-row friendship pattern, query performance trade-offs
- [Composite API patterns (Stoplight)](https://stoplight.io/api-types/composite-api) — composite vs. batch API design
- [Cloudflare Workers KV documentation](https://developers.cloudflare.com/kv/) — evaluated for caching social data, deferred
- [System Design Primer — Social Graph (donnemartin)](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/social_graph/README.md) — friendship graph storage patterns
- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization) — indexing and query performance for social queries
- [API Polling Best Practices (Merge)](https://www.merge.dev/blog/api-polling-best-practices) — polling interval strategies

## Related Decisions

- [ADR-003: Client State Management](./003-client-state-management.md) — social data uses TanStack Query with screen-scoped polling, not the global 30s polling used for user's own data
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — defines social tables (friendships, friend_requests, encouragement_taps), dual-row pattern, and scoped visibility functions. DB functions repurposed as test helpers.
- [ADR-007: API Architecture](./007-api-architecture.md) — all social endpoints are Hono routes on CF Workers with Zod validation and OpenAPI spec generation
- [ADR-012: Security & Data Privacy](./012-security-data-privacy.md) — friendship JOINs enforce social privacy at API level; DB functions serve as test verification layer
- [ADR-014: Analytics & Insights Architecture](./014-analytics-insights-architecture.md) — Tier 1 stats (glanceable) are personal, not social. Social features are a separate surface.
