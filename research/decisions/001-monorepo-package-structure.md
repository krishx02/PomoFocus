# ADR-001: Monorepo Package Structure

**Status:** Accepted
**Date:** 2026-03-06
**Decision-makers:** Project lead
**Zoom level:** Level 3 (Component) — elevated to full depth due to 9-platform scope
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context and Problem Statement

PomoFocus targets 9 platforms from a single Nx + pnpm monorepo. Code sharing is critical — timer logic, goal models, session recording, and data access must not be duplicated across platforms. The question is how to organize shared packages: what are the boundaries, how many packages, and how do cross-language types (TypeScript, Swift, C++) stay in sync without manual maintenance.

## Decision Drivers

- **Clean separation of concerns** — each package has one job, matching the Nike-style capability + layer pattern the developer is familiar with
- **Zero manual cross-language type sync** — types shared between TS, Swift, and C++ must be auto-generated from a single source of truth
- **Solo developer maintainability** — not so many packages that managing `package.json` files becomes overhead
- **Nx module boundary enforcement** — dependency direction must be enforced via tags, not convention
- **Platform-appropriate code sharing** — business logic shares everywhere, UI shares within React ecosystem, native code stays separate

## Considered Options

1. **Fat Core (3 packages)** — one `core/` with all business logic, plus `ui/` and `api-client/`
2. **Domain-Split (8 packages)** — separate packages per domain: timer, goals, sessions, analytics, types, api-client, ui, ble-protocol
3. **Layered Hybrid (7 packages)** — tightly coupled domains bundled in `core/`, independent concerns separated: types, core, analytics, data-access, state, ui, ble-protocol

## Decision Outcome

Chosen option: **"Layered Hybrid (7 packages)"**, because it splits at natural architectural seams (domain vs data-access vs state vs presentation vs infrastructure) while keeping tightly-coupled domains (timer + goals + sessions) together to avoid circular dependency pain. The naming follows Nike-style layer conventions (contracts/types, domain/core, data-access, state, presentation/ui). Originally 6 packages; `packages/state/` (Zustand + TanStack Query) added as the 7th by [ADR-003](./003-client-state-management.md).

### Consequences

- **Good:** Clean dependency direction enforced by Nx tags. Each package has a clear purpose. Apps wire packages together without packages knowing about each other. Type generation eliminates manual cross-language sync.
- **Bad:** `core/` bundles three domains (timer, goals, sessions) — may need splitting if it grows beyond ~3-5k lines. Seven packages is moderate overhead for a solo dev pre-code.
- **Neutral:** The structure accommodates all 9 platforms but most app shells will be empty until post-v1.

## Pros and Cons of the Options

### Fat Core (3 packages)

- Good, because simplest to manage — 3 shared packages, everything else is an app
- Good, because no cross-package dependency chasing within business logic
- Bad, because `core` becomes a grab-bag — VS Code extension imports analytics code it doesn't need
- Bad, because changes to timer force unnecessary rebuilds of all consumers
- Bad, because harder for Nx affected detection to narrow scope

### Domain-Split (8 packages)

- Good, because each package has exactly one job — clear ownership
- Good, because Nx affected detection is maximally precise
- Good, because aligns with product brief's natural domain boundaries
- Bad, because 8 shared packages is maintenance overhead for a solo dev
- Bad, because timer/sessions/goals have real coupling — splitting them risks circular imports
- Bad, because some packages (goals/, sessions/) may be too thin to justify existence

### Layered Hybrid (7 packages)

- Good, because splits at natural seams — domain logic vs data access vs presentation vs infrastructure
- Good, because keeps tightly-coupled logic together (timer + goals + sessions in core/)
- Good, because analytics is separated as a read-only consumer — clear boundary
- Good, because ble-protocol is isolated — only mobile and web need it
- Good, because follows the Nike-style layer pattern (contracts, domain, data-access, presentation)
- Bad, because `core/` still bundles 3 domains — could grow to 3-5k lines
- Bad, because less precise Nx affected detection than Domain-Split

## Research Sources

- [Nx Blog: Step-by-Step Guide to Creating an Expo Monorepo with Nx](https://nx.dev/blog/step-by-step-guide-to-creating-an-expo-monorepo-with-nx)
- [Nx Blog: Taming Code Organization with Module Boundaries](https://nx.dev/blog/mastering-the-project-boundaries-in-nx)
- [Nx Blog: Share Code Between React Web & React Native Mobile](https://blog.nrwl.io/share-code-between-react-web-react-native-mobile-with-nx-fe5e22b5a755)
- [Expo Documentation: Work with Monorepos](https://docs.expo.dev/guides/monorepos/)
- [byCedric/expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example)
- [bret.io: I Love Monorepos — Except When They Are Annoying](https://bret.io/blog/2025/i-love-monorepos/)
- [Supabase CLI: Generate Types](https://supabase.com/docs/reference/cli/supabase-gen-types)
- [Apple/swift-protobuf](https://github.com/apple/swift-protobuf)
- [stephenh/ts-proto](https://github.com/stephenh/ts-proto)

## Related Decisions

- Database: Supabase (Postgres + RLS + Realtime) — accepted, see `research/04-stack-recommendations.md`
- Monorepo tooling: Nx + pnpm — accepted, see `research/04-stack-recommendations.md`
- Testing frameworks — accepted, see `research/08-testing-frameworks.md`
- [ADR-003: Client State Management](./003-client-state-management.md) — adds `packages/state/` as the 7th shared package
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — schema drives `packages/types/` via `supabase gen types`
- [ADR-007: API Architecture](./007-api-architecture.md) — adds `apps/api/` (Hono on CF Workers). `packages/data-access/` changes from "wraps Supabase SDK" to "wraps generated OpenAPI client."
