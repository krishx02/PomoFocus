# Design: Client State Management Architecture

**Date:** 2026-03-06
**Status:** Accepted
**Related ADR:** [ADR-003](../decisions/003-client-state-management.md)
**Platforms:** iOS app, Android, web, VS Code extension, iOS widget, Apple Watch, macOS menu bar, BLE device

## Context & Scope

PomoFocus needs a state management architecture that serves 9 platforms from one monorepo. The React layer (Expo mobile, Next.js web, VS Code extension) shares state through a common package. Native platforms (iOS widget, watchOS, macOS widget) and the BLE device receive state through platform-specific bridges. The architecture must support offline operation, polling-based data fetching, and eventual sync — while keeping `@pomofocus/core` pure (no IO, no React, no state library imports).

## Goals & Non-Goals

**Goals:**
- Unified state layer for all React apps (mobile, web, VS Code) via shared `packages/state/`
- Clean separation: domain logic in `core/`, data fetching in `data-access/`, React state wiring in `state/`
- Polling-first server data strategy (30s default) with no WebSocket connections by default
- Platform-appropriate persistence: MMKV (mobile), localStorage (web), globalState (VS Code)
- SSR hydration for Next.js without flash-of-empty-content
- Selector-based Zustand access for performant timer rendering

**Non-Goals:**
- Designing the full offline sync/conflict resolution strategy (decided in [ADR-006: Offline-First Sync Architecture](../decisions/006-offline-first-sync-architecture.md) — custom outbox pattern)
- Choosing the timer state machine implementation (decided — see [ADR-004](../decisions/004-timer-state-machine.md): hand-rolled TypeScript reducer)
- Implementing Supabase Realtime WebSocket subscriptions (deferred; polling meets all v1 latency requirements)
- Designing native platform bridge implementations (iOS widget App Group, WatchConnectivity, BLE GATT — each is a separate concern)

## The Design

### State Categorization

All application state falls into one of three categories:

| Category | Examples | Tool | Persistence |
|----------|----------|------|-------------|
| **Domain state** | Timer phase, seconds remaining, current goal, session history | Zustand stores (wrapping `@pomofocus/core`) | MMKV / localStorage |
| **Server state** | User profile, goals list, session records, friend activity, analytics | TanStack Query (wrapping `@pomofocus/data-access`) | TanStack Query cache + polling |
| **UI state** | Modal open/closed, selected tab, form input | React local state (`useState`) or Zustand | None (ephemeral) |

### Package Structure

```
packages/state/                    ← NEW: 7th shared package
  src/
    stores/
      timer-store.ts               ← Zustand store, imports @pomofocus/core timer functions
      ui-store.ts                  ← Zustand store for shared UI state (active view, etc.)
    queries/
      use-sessions.ts              ← TanStack Query hooks wrapping @pomofocus/data-access
      use-goals.ts
      use-friends.ts
      use-analytics.ts
      query-client.ts              ← Shared QueryClient config (30s staleTime, 30s refetchInterval)
    persistence/
      types.ts                     ← PersistenceAdapter interface
      mmkv-adapter.ts              ← For Expo mobile
      local-storage-adapter.ts     ← For Next.js web
      vscode-adapter.ts            ← For VS Code extension (post-v1)
    index.ts                       ← Public API
```

### Import Direction

```
types ← core ← data-access ← state ← apps
                analytics ←↗
```

- `packages/state/` depends on: `core/`, `data-access/`, `types/`
- `packages/state/` depends on (npm): `zustand`, `@tanstack/react-query`
- Apps depend on: `state/` (and transitively, everything below it)
- `core/` has NO dependency on `state/` — state wraps core, never the other way

### Data Flow

```
                         ┌──────────────────────┐
                         │     Supabase DB       │
                         │  (source of truth)    │
                         └──────────┬────────────┘
                                    │
                         ┌──────────┴────────────┐
                         │   CF Workers API      │
                         │   (Hono, ADR-007)     │
                         └──────────┬────────────┘
                                    │
                          HTTP polling (30s)
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
           ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
           │  Next.js web  │ │ Expo mobile │ │  VS Code    │
           │               │ │             │ │  extension  │
           │  ┌──────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
           │  │ TanStack │ │ │ │TanStack │ │ │ │TanStack │ │
           │  │ Query    │ │ │ │Query    │ │ │ │Query    │ │
           │  └────┬─────┘ │ │ └────┬────┘ │ │ └────┬────┘ │
           │       │       │ │      │      │ │      │      │
           │  ┌────▼─────┐ │ │ ┌────▼────┐ │ │ ┌────▼────┐ │
           │  │ Zustand  │ │ │ │Zustand  │ │ │ │Zustand  │ │
           │  │ stores   │ │ │ │stores   │ │ │ │stores   │ │
           │  └────┬─────┘ │ │ └────┬────┘ │ │ └────┬────┘ │
           │       │       │ │      │      │ │      │      │
           │  localStorage │ │   MMKV     │ │  globalState │
           └───────────────┘ └────────┬───┘ └─────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
           ┌───────▼──────┐ ┌───────▼──────┐ ┌───────▼──────┐
           │  iOS Widget  │ │   watchOS    │ │  BLE Device  │
           │  (SwiftUI)   │ │  (SwiftUI)   │ │   (ESP32)    │
           │              │ │              │ │              │
           │  App Group   │ │ WatchConnect │ │ GATT chars   │
           │  UserDefaults│ │ ivity        │ │              │
           └──────────────┘ └──────────────┘ └──────────────┘
```

### Zustand Store Pattern

Stores are thin wrappers around `@pomofocus/core` functions:

```typescript
// packages/state/src/stores/timer-store.ts
import { createTimerState, tick, startTimer, pauseTimer } from '@pomofocus/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistenceAdapter } from '../persistence/types';

interface TimerStore {
  // State (mirrors core's TimerState)
  phase: 'idle' | 'focusing' | 'paused' | 'break' | 'reflection';
  secondsRemaining: number;
  // Actions (delegate to core)
  start: (durationMinutes: number) => void;
  pause: () => void;
  tick: () => void;
}

export const createTimerStore = (adapter: PersistenceAdapter) =>
  create<TimerStore>()(
    persist(
      (set) => ({
        ...createTimerState(),
        start: (duration) => set((s) => startTimer(s, duration)),
        pause: () => set((s) => pauseTimer(s)),
        tick: () => set((s) => tick(s)),
      }),
      { name: 'timer', storage: adapter }
    )
  );
```

Components use selectors to subscribe to specific fields:

```typescript
// Only re-renders when secondsRemaining changes
const seconds = useTimerStore((s) => s.secondsRemaining);
```

### TanStack Query Pattern

Query hooks wrap `@pomofocus/data-access` functions with polling:

```typescript
// packages/state/src/queries/use-sessions.ts
import { fetchSessions, createSession } from '@pomofocus/data-access';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useSessions(userId: string) {
  return useQuery({
    queryKey: ['sessions', userId],
    queryFn: () => fetchSessions(userId),
    staleTime: 30_000,        // 30s before considered stale
    refetchInterval: 30_000,  // Poll every 30s when window is focused
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.userId] });
    },
  });
}
```

### SSR Hydration (Next.js)

```typescript
// apps/web/app/providers.tsx
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { prefetchGoals } from '@pomofocus/state';

export default async function Providers({ children }) {
  const queryClient = new QueryClient();
  await prefetchGoals(queryClient, userId);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
```

### Native Platform Bridges (Overview)

These are NOT part of the React state layer but complete the full-platform picture:

| Platform | Bridge | Direction | Mechanism |
|----------|--------|-----------|-----------|
| iOS Widget | App Group | React Native writes → SwiftUI reads | `UserDefaults(suiteName:)` written by a native module in the Expo app; WidgetKit reads on timeline refresh |
| watchOS | WatchConnectivity | Bidirectional | `WCSession` transfers goals to watch, sessions from watch. Expo app uses a native module. |
| macOS Widget | App Group | Same as iOS Widget | `UserDefaults` shared between a helper app and the widget |
| BLE Device | GATT Characteristics | Bidirectional | `react-native-ble-plx` (mobile) / Web Bluetooth (web) read/write GATT characteristics. Device runs its own timer independently. |

Each bridge writes/reads the same data shapes defined in `@pomofocus/types`. The React state layer doesn't know about these bridges — the app layer coordinates writes to both Zustand/TanStack Query and the appropriate bridge.

## Alternatives Considered

### Legend State (All-in-One)

Rejected despite superior performance benchmarks because v3 (with Supabase sync) is still in beta, the community is ~10x smaller than Zustand's (affecting agent code quality), and it locks in a sync strategy that differs from the custom outbox pattern chosen in [ADR-006](../decisions/006-offline-first-sync-architecture.md).

### Jotai + TanStack Query

Rejected because PomoFocus's state shape (~5 domains) doesn't benefit from atomic granularity. Jotai's atom abstraction adds concepts without proportional benefit. Zustand's simpler "create store, use hook" model is more agent-friendly.

### Supabase Realtime WebSocket Subscriptions

Rejected as the default data-fetching strategy. Supabase free tier limits concurrent Realtime connections to 200. A Pomodoro app's data (sessions, goals, analytics) does not require sub-second push — 30-second polling meets all latency requirements. Realtime remains available and can be enabled per-feature if a future requirement demands it.

## Cross-Cutting Concerns

- **Security:** No state management-specific security concerns. Auth tokens are managed by `@pomofocus/data-access` (see ADR-002). Zustand stores never hold raw tokens — `core/` functions receive `userId: string`, not sessions.
- **Cost:** Polling-first strategy means zero WebSocket connections by default, staying well within Supabase's free tier. TanStack Query's 30s polling interval is ~2,880 requests/user/day for active use — negligible at Supabase's scale.
- **Observability:** TanStack Query DevTools (web) for debugging cache state. Zustand DevTools middleware for store inspection. Both are dev-only, zero production overhead.
- **Migration path:** [ADR-006](../decisions/006-offline-first-sync-architecture.md) chose custom outbox sync. If a future decision recommends a managed sync engine (PowerSync, ElectricSQL), TanStack Query hooks in `packages/state/queries/` are the replacement surface — `data-access/` and `core/` remain untouched.

## Open Questions

1. **Offline sync & conflict resolution** — Decided in [ADR-006: Offline-First Sync Architecture](../decisions/006-offline-first-sync-architecture.md). Custom outbox queue in `core/sync/` + `data-access/sync/`. Append-only data uses idempotent inserts (UUID + ON CONFLICT DO NOTHING). Updatable data uses optimistic version locking.
2. **Timer state machine design** — Decided in [ADR-004](../decisions/004-timer-state-machine.md). Pure `transition(state, event) → newState` function in `packages/core/timer/`. Zustand stores wrap `transition()` and own the timer interval. 9 states: idle, focusing, paused, short_break, long_break, break_paused, reflection, completed, abandoned.
3. **App Group native module** — How does the Expo app write to App Group UserDefaults? Deferred to iOS Widget Architecture /tech-design.
4. **Realtime upgrade criteria** — Under what specific conditions would polling be insufficient and Realtime be added? Answer: if user research shows that Library Mode presence with >30s latency degrades the experience.
