# ADR-005: Database Schema & Data Model

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 1 (System)
**Platforms:** All (schema is platform-agnostic; all platforms access via Hono REST API on CF Workers, which forwards to Supabase — see [ADR-007](./007-api-architecture.md))

## Context and Problem Statement

PomoFocus needs a Postgres schema to store user goals (three-layer hierarchy), focus sessions with reflection data, social connections, BLE device registrations, and computed analytics inputs. The schema must support Supabase RLS via `auth.uid()`, deferred sign-up (anonymous → authenticated), BLE device incremental sync, and all analytics queries from the product brief (component metrics, weekly insights, monthly trends — see [ADR-014](./014-analytics-insights-architecture.md)). The schema is a one-way door — every package (`types/`, `core/`, `data-access/`, `state/`) depends on it, and changes post-launch require migrations.

## Decision Drivers

- **RLS compatibility** — every table needs a clean path to `auth.uid()` for Row Level Security
- **Analytics queryability** — 8 derived metrics (S10) must be computable from the schema without additional data stores
- **Privacy by design** — friends must never see raw session data, goal content, or numbers (S9)
- **Deferred sign-up support** — anonymous users create data before authenticating, with zero migration on identity promotion
- **BLE sync support** — incremental sync of goals (down) and sessions (up) between app and device
- **Simplicity** — solo developer; schema should be straightforward to understand and extend
- **Supabase-native** — leverage Postgres features (enums, timestamptz, gen_random_uuid, RLS) rather than fighting them

## Considered Options

1. **Normalized relational schema (12 tables, 3NF)** — one table per domain concept, Postgres enums, RLS on every table, helper functions for social visibility
2. **Fewer tables with jsonb fields** — combine goals into one table with `parent_id`, embed reflection data as jsonb, reduce to ~8 tables
3. **Document-oriented / single-table per domain** — store all user data as jsonb documents, fewer tables but complex queries

## Decision Outcome

Chosen option: **"Normalized relational schema (12 tables, 3NF)"**, because it maps 1:1 to product brief concepts, makes all analytics queries straightforward SQL, enables fine-grained RLS without complex json path checks, and leverages Postgres's strengths (typed columns, enums, foreign keys, indexes). Each table has a clear purpose and no speculative structure.

### Key Schema Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| ID strategy | UUID v4 (`gen_random_uuid`) | Required for offline BLE sync (collision-free across devices) |
| Timestamps | Always `timestamptz` | Multi-timezone users; sessions created in EST must display correctly in PST |
| Deletes | Hard deletes | Simpler for v1; no undo flow in product brief; add soft deletes per-table later if needed |
| Reflection data | Columns on `sessions` table | 1:1 with session, always queried together; avoids join on every analytics query |
| Timer preferences | Normalized columns | DB-level defaults and validation; easier for agents to work with than jsonb |
| Friendship model | Dual-row pattern (A,B) + (B,A) | Simplifies queries and RLS to `WHERE user_id = X`; unfriend wraps in transaction |
| `user_id` denormalization | On `process_goals` and `breaks` | Direct RLS path to `auth.uid()` without joins |
| Social visibility | Scoped helper functions, NOT broad RLS | `is_friend_focusing()` and `did_friend_focus_today()` — friends never see raw session data |
| RLS helper | `get_user_id()` function | Clean abstraction — one function for all RLS policies instead of inlining the `auth.uid()` → `profiles` subquery everywhere |

### Consequences

- **Good:** All 8 analytics metrics (S10) computable from straightforward SQL. RLS on every table with consistent `get_user_id()` pattern. Privacy enforced at database level — no app-layer leaks possible. Deferred sign-up works with zero migration (Supabase preserves user ID on identity promotion). BLE incremental sync supported via `device_sync_log`. Types auto-generated from schema via `supabase gen types`.
- **Bad:** 12 tables + 9 enums is moderate upfront complexity. `get_user_id()` function call on every RLS check adds a small lookup cost (mitigated by Postgres STABLE caching, invisible at v1 scale). Dual-row friendships require transactional unfriend logic to prevent one-sided friendships.
- **Neutral:** Duration is computed (`ended_at - started_at`) rather than stored, trading a tiny compute cost for zero redundancy. `user_preferences` is a separate table (not columns on profiles) — clean separation but one extra join when preferences are needed alongside profile data.

## Pros and Cons of the Options

### Normalized relational schema (12 tables)

- Good, because each table maps to exactly one product concept — easy to understand and extend
- Good, because Postgres enums provide type safety at the database level
- Good, because foreign keys + cascading deletes maintain referential integrity automatically
- Good, because analytics queries are simple aggregations over typed columns
- Good, because RLS policies are straightforward equality checks
- Good, because `supabase gen types` produces clean TypeScript interfaces from the schema
- Bad, because 12 tables is more upfront setup than a minimal schema
- Bad, because schema changes require migrations (one-way door)
- Bad, because denormalized `user_id` on two tables violates pure 3NF

### Fewer tables with jsonb fields (~8 tables)

- Good, because fewer tables means less boilerplate and fewer migrations
- Good, because jsonb is flexible — add new fields without migrations
- Good, because combining long_term_goals and process_goals into one table with `parent_id` reduces joins
- Bad, because jsonb queries are slower and can't be indexed as precisely
- Bad, because no DB-level type validation on jsonb fields — bugs appear at runtime, not schema time
- Bad, because `supabase gen types` produces `Json` type for jsonb columns — loses type specificity
- Bad, because RLS on jsonb paths is complex and error-prone

### Document-oriented / single-table per domain

- Good, because maximum flexibility — schema changes are trivial
- Good, because could use Supabase Realtime on fewer tables
- Bad, because throws away Postgres's biggest strengths (typed columns, FK constraints, indexes)
- Bad, because analytics queries become json extraction nightmares
- Bad, because no referential integrity — orphaned data is invisible
- Bad, because RLS on json documents requires deep path checks

## Research Sources

- [SchemaAgent: Multi-Agent Framework for Schema Generation (arxiv 2503.23886)](https://arxiv.org/abs/2503.23886) — informed the three-level modeling methodology
- [Supabase Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS Best Practices (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Mermaid ER Diagram Syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)
- [Supabase CLI Type Generation](https://supabase.com/docs/reference/cli/supabase-gen-types)

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — schema drives `packages/types/` via `supabase gen types`
- [ADR-002: Auth Architecture](./002-auth-architecture.md) — RLS uses `auth.uid()` via `get_user_id()` helper; deferred sign-up preserves user ID
- [ADR-003: Client State Management](./003-client-state-management.md) — TanStack Query polls schema data at 30s intervals; social visibility functions called from `data-access/`
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — timer config reads from `user_preferences`; `ReflectionData` type maps to `sessions.focus_quality` + `sessions.distraction_type`; abandonment reason collected optionally by app layer after timer reaches `abandoned` state; `reflection_enabled` preference controls whether reflection state is entered
- [ADR-007: API Architecture](./007-api-architecture.md) — all client access routes through the Hono REST API on CF Workers, which forwards user JWTs to Supabase. RLS policies and `get_user_id()` work unchanged.
