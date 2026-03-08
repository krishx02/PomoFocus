# ADR-003: Client State Management

**Status:** Accepted
**Date:** 2026-03-06
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container) — state flows across multiple runtime units and platforms
**Platforms:** iOS app, Android, web, VS Code extension, iOS widget, Apple Watch, macOS menu bar, BLE device

## Context and Problem Statement

PomoFocus targets 9 platforms from a single monorepo. Application state (timer, goals, sessions, user data) must flow across React apps (Expo mobile, Next.js web, VS Code extension), native SwiftUI surfaces (iOS widget, watchOS, macOS menu bar), and a BLE device. The decision covers: which React state management library to use, how server state integrates, what data-fetching strategy to use, and where shared stores live in the package structure.

## Decision Drivers

- **Performance** — timer updates at ~1Hz, must not cause unnecessary re-renders across the component tree
- **Cross-platform consistency** — identical state behavior in Expo (iOS/Android) and Next.js (web), with SSR hydration support
- **Agent-friendliness** — agents write most code; libraries with large documentation corpus and community produce better agent output
- **Ecosystem maturity** — battle-tested libraries with active maintenance, not beta or niche
- **Server state integration** — clean pattern for Supabase queries, caching, optimistic updates, and polling
- **Offline support** — local persistence on mobile (MMKV) and web (localStorage) for offline-capable operation
- **Scalability** — avoid architecture that breaks at scale (e.g., per-user WebSocket connections)

## Considered Options

1. **Zustand + TanStack Query** — Zustand for local/UI state, TanStack Query for server state, polling-first
2. **Legend State (all-in-one)** — Signal-based state with built-in Supabase sync, persistence, and fine-grained reactivity
3. **Jotai + TanStack Query** — Atomic state model with TanStack Query for server state

## Decision Outcome

Chosen option: **"Zustand + TanStack Query"**, because it provides the best combination of ecosystem maturity (50K+ GitHub stars, massive documentation corpus), agent-friendliness, and clean separation of local vs server state. The polling-first data strategy eliminates WebSocket scaling concerns while meeting actual latency requirements.

### Key Architecture Principles

1. **`@pomofocus/core` owns domain truth** — timer logic, goal models, session recording are pure functions in `core/`. Zustand stores are thin React wrappers that call into `core/`, not replacements for it.
2. **Polling-first, no WebSockets by default** — all server data uses TanStack Query polling at 30-second intervals. Supabase Realtime is available but deferred until a feature demands sub-second updates. A Pomodoro app's data (sessions, goals, analytics, friend activity) does not require real-time push.
3. **Shared `packages/state/`** — Zustand stores and TanStack Query hooks live in a shared package consumed by all React apps. Platform-specific persistence adapters (MMKV, localStorage, VS Code globalState) are injected by each app at initialization.
4. **Native platforms use platform bridges** — iOS widget (App Group), watchOS (WatchConnectivity), BLE device (GATT characteristics). These are platform-mandated and independent of the React state library choice.

### Consequences

- **Good:** Maximum ecosystem support and documentation for agent-written code. Clean separation of local state (Zustand) and server state (TanStack Query). Polling-first eliminates WebSocket connection scaling concerns. Shared state package prevents store duplication across 3+ React apps.
- **Bad:** Two libraries to coordinate instead of one integrated solution. Manual glue code needed for offline sync/conflict resolution (deferred to Offline-First Sync Architecture /tech-design session). Zustand requires selector discipline for performant timer updates.
- **Neutral:** Adds a 7th package (`packages/state/`) to the monorepo structure established in ADR-001. The import direction (`types <- core <- data-access <- state`, apps consume all) remains consistent.

## Pros and Cons of the Options

### Zustand + TanStack Query

- Good, because Zustand has 50K+ GitHub stars — largest documentation corpus for agent code generation
- Good, because TanStack Query is the industry standard for server state (caching, deduplication, optimistic updates, SSR hydration)
- Good, because clean separation: Zustand handles local/UI state, TanStack Query handles server/async state
- Good, because Zustand's persist middleware + MMKV adapter provides ~30x faster mobile persistence than AsyncStorage
- Good, because TanStack Query supports both polling and subscription-based strategies — easy to add Realtime later if needed
- Good, because Next.js SSR hydration is well-documented via `dehydrate`/`HydrationBoundary`
- Bad, because two libraries means more integration surface area and glue code
- Bad, because no built-in sync/conflict resolution — must be designed separately
- Bad, because Zustand re-renders at store level by default — requires selectors for fine-grained updates (e.g., `useTimerStore(s => s.secondsRemaining)`)

### Legend State (All-in-One)

- Good, because fastest benchmarks (1.02 vs Zustand's 1.69 in Legend State's benchmark suite)
- Good, because fine-grained signal-based reactivity — only changed fields trigger re-renders
- Good, because built-in Supabase sync plugin handles CRUD, realtime, conflict resolution, retry, and differential sync
- Good, because local persistence (MMKV/AsyncStorage) is built in — one library replaces three
- Good, because 4KB bundle size
- Good, because Supabase officially promotes it for Expo offline-first apps
- Bad, because v3 (with improved sync) is still in beta — v2 is current stable
- Bad, because ~5K GitHub stars — significantly smaller documentation corpus for agents
- Bad, because signal/observable mental model differs from React's hook conventions — steeper learning curve
- Bad, because coupling to Legend State's sync opinions reduces flexibility for the Offline-First Sync Architecture decision

### Jotai + TanStack Query

- Good, because atomic state model — only components subscribed to specific atoms re-render
- Good, because same ecosystem as Zustand (pmndrs) — well-maintained, good TypeScript support
- Good, because good for complex state interdependencies
- Bad, because "atoms" abstraction is less intuitive than Zustand's plain objects — more concepts to learn
- Bad, because persistence story is less mature — no drop-in MMKV adapter
- Bad, because PomoFocus's state shape (~5 domains) doesn't need atomic granularity — over-engineering
- Bad, because same manual sync glue code needed as Option A without Zustand's simpler mental model

## Research Sources

- [State Management in 2025: What You Actually Need — developerway.com](https://www.developerway.com/posts/react-state-management-2025)
- [Top 5 React State Management Tools Developers Actually Use in 2026 — Syncfusion](https://www.syncfusion.com/blogs/post/react-state-management-libraries)
- [State Management Trends in React 2025 — Makers' Den](https://makersden.io/blog/react-state-management-in-2025)
- [Legend State — High performance state and local first sync](https://legendapp.com/open-source/state/)
- [Local-first Realtime Apps with Expo and Legend-State — Supabase Blog](https://supabase.com/blog/local-first-expo-legend-state)
- [zustand-mmkv-storage — Blazing Fast Persistence for Zustand in React Native](https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1)
- [How to Use Supabase with TanStack Query — MakerKit](https://makerkit.dev/blog/saas/supabase-react-query)
- [State Management Nx React Native/Expo Apps with TanStack Query and Redux — Nx Blog](https://nx.dev/blog/state-management-nx-react-native-expo-apps-with-tanstack-query-and-redux)
- [Zustand vs Jotai vs Valtio: Performance Guide 2025 — ReactLibraries](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025)
- [Jotai Comparison — Official](https://jotai.org/docs/basics/comparison)

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — this decision adds `packages/state/` as the 7th shared package
- [ADR-002: Auth Architecture](./002-auth-architecture.md) — auth state flows through `data-access/`, consumed by `state/` via TanStack Query hooks
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — TanStack Query polls session/goal data; social visibility via scoped functions in `data-access/`
- Database: Supabase (Postgres + RLS + Realtime) — accepted, see `research/04-stack-recommendations.md`
- Offline-First Sync Architecture — pending /tech-design. This ADR defers sync/conflict resolution to that session.
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — hand-rolled TypeScript reducer in `core/`. Zustand stores wrap `transition()` and own the timer interval.
