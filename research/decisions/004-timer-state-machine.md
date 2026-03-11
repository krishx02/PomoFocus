# ADR-004: Timer State Machine

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 3 (Component) — elevated to full depth due to 9-platform scope and central role in app
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context and Problem Statement

The Pomodoro timer is the core feature of PomoFocus. It cycles through phases (focus, break, reflection) with pause/resume capability, configurable durations, and session counting (short break vs long break logic). The timer must run on all 9 platforms — including platforms without a JavaScript runtime (iOS widget via WidgetKit, watchOS, macOS menu bar via SwiftUI, BLE device via nRF52840 firmware). The decision covers: how to implement the timer state machine in `packages/core/`, and whether to use a state machine library (XState) or a hand-rolled TypeScript approach.

## Decision Drivers

- **Cross-platform portability** — the state model must be implementable in TypeScript, Swift, and C++ for all 9 platforms
- **Purity** — `packages/core/` must contain no IO, no React, no intervals, no side effects (per ADR-001)
- **Learning curve** — solo developer with no prior state machine library experience
- **Agent-friendliness** — agents generate better code with simple, well-known TypeScript patterns than library-specific DSLs
- **Testability** — pure functions are trivially testable: `expect(transition(state, event)).toEqual(newState)`
- **Bundle size** — every KB counts for React Native; zero dependencies is ideal

## Considered Options

1. **XState v5** — full statechart library with visual editor, devtools, invoked services, guards, and delayed transitions
2. **Hand-rolled TypeScript state machine** — discriminated unions + pure reducer function, platform-specific timer drivers
3. **Start hand-rolled, migrate to XState later** — begin simple, add XState if complexity warrants

## Decision Outcome

Chosen option: **"Hand-rolled TypeScript state machine"**, because it is the only approach that works cleanly across all 9 platforms (TypeScript discriminated unions map to Swift `enum` and C++ `enum class`), keeps `packages/core/` pure with zero dependencies, and avoids a learning curve for a library whose advanced features (actors, parallel states, spawn) are not needed for Pomodoro timer complexity.

The architecture separates the **state machine** (pure function in `packages/core/`) from **timer drivers** (platform-specific, one per runtime). The state machine never owns intervals or side effects. Each platform's timer driver starts/stops its native timing mechanism based on state transitions.

XState is documented as an escape hatch: if the state machine grows beyond ~10 states or requires parallel regions, it can be added as an internal implementation detail in `packages/core/` without changing consumers.

### Consequences

- **Good:** Zero dependencies. Pure functions are trivially testable. TypeScript's exhaustive switch catches missing state/event combinations at compile time. The same state model translates directly to Swift and C++ for native platforms. Agents can generate and modify switch statements without learning a library API.
- **Bad:** No visual editor for the state machine (XState's Stately editor is genuinely useful for understanding complex flows). No built-in devtools for inspecting state transitions at runtime. If the state machine grows significantly, a hand-rolled switch statement becomes harder to maintain than an XState machine definition.
- **Neutral:** Timer interval lifecycle is the caller's responsibility, not `core/`'s. This is the correct separation for a 9-platform app but requires each platform to implement a thin timer driver (~20 lines).

## Pros and Cons of the Options

### XState v5

- Good, because prevents invalid states by design — transitions are explicitly declared, impossible transitions don't exist
- Good, because visual editor ([Stately](https://stately.ai/)) lets you see and edit the state machine graphically
- Good, because built-in delayed transitions (`after: { 1500000: 'break' }`) handle timer countdowns as a first-class concept
- Good, because invoked services auto-cleanup on state exit — eliminates interval leak bugs
- Good, because 28K+ GitHub stars, active development, large documentation corpus ([GitHub](https://github.com/statelyai/xstate))
- Good, because zero dependencies, framework-agnostic — works in `packages/core/`
- Good, because existing [Pomodoro implementations in XState](https://dev.to/andrecrimberg/pomodoro-state-machine-using-xstate-384p) to reference
- Bad, because ~40KB minified bundle size
- Bad, because learning curve: statecharts have formal terminology (actors, guards, invoke, spawn) unfamiliar to the developer
- Bad, because JavaScript-only runtime — cannot run on iOS widget (WidgetKit), watchOS, macOS (SwiftUI), or nRF52840 (C++) platforms
- Bad, because v4→v5 migration broke many community tutorials; some examples are outdated
- Bad, because invoked services assume a single JavaScript runtime — conflicts with 9-platform timer driver architecture

### Hand-Rolled TypeScript State Machine

- Good, because zero dependencies, zero bundle size overhead
- Good, because TypeScript discriminated unions enforce valid states at compile time; exhaustive switch catches missing cases
- Good, because maximally portable: discriminated unions map to Swift `enum` (iOS/watchOS/macOS) and C++ `enum class` (nRF52840 firmware)
- Good, because pure functions are trivially testable without mocking
- Good, because simplest mental model for a developer new to state machines
- Good, because agents generate and modify switch statements more reliably than library-specific DSLs
- Good, because `packages/core/` stays pure — no intervals, no cleanup, no side effects
- Bad, because no visual editor or state machine devtools
- Bad, because developer must manually ensure all state/event combinations are handled (TypeScript helps but doesn't fully prevent logic errors within cases)
- Bad, because [XState's creator warns](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) that hand-rolled machines often re-implement statechart features badly as complexity grows
- Bad, because delayed transitions (timer countdowns) must be managed by platform-specific timer drivers rather than declared in the state machine

### Start Hand-Rolled, Migrate to XState Later

- Good, because lowest entry barrier — learn state machines with plain TypeScript first
- Good, because `packages/core/` boundary (ADR-001) means migration affects only one package's internals
- Bad, because "migrate later" rarely happens — tech debt accumulates
- Bad, because two learning curves if migration occurs
- Bad, because features that XState handles well (entry/exit actions, cleanup) get re-implemented during the "hand-rolled" phase

## Research Sources

- [You don't need a library for state machines — David Khourshid (XState creator)](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h)
- [Pomodoro State Machine using XState — DEV Community](https://dev.to/andrecrimberg/pomodoro-state-machine-using-xstate-384p)
- [XState v5 official documentation](https://stately.ai/docs/xstate)
- [XState GitHub repository (28K+ stars)](https://github.com/statelyai/xstate)
- [Comparing state machines: XState vs. Robot — LogRocket Blog](https://blog.logrocket.com/comparing-state-machines-xstate-vs-robot/)
- [State Management Trends in React 2025 — Makers' Den](https://makersden.io/blog/react-state-management-in-2025)
- [Composable State Machines in TypeScript — Medium](https://medium.com/@MichaelVD/composable-state-machines-in-typescript-type-safe-predictable-and-testable-5e16574a6906)
- [React Native with XState v5 — DEV Community](https://dev.to/gtodorov/react-native-with-xstate-v5-4ekn)
- [@xstate/store documentation](https://stately.ai/docs/xstate-store)
- [Timed Finite State Machines with React and XState](https://altrim.io/posts/timed-finite-state-machines-with-react-and-xstate)

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — state machine lives in `packages/core/` (pure domain logic, no IO)
- [ADR-003: Client State Management](./003-client-state-management.md) — Zustand stores in `packages/state/` wrap `core/` functions; timer driver lives in the Zustand store layer
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — timer config reads from `user_preferences` table; `ReflectionData` maps to `sessions.focus_quality` + `sessions.distraction_type`; abandonment reason collected optionally by app layer; `reflection_enabled` preference added to `user_preferences`; `totalSessions` removed (cycles are open-ended)
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — custom outbox sync mirrors the timer pattern: pure FSM in `core/sync/`, platform drivers elsewhere. Timer completion events trigger outbox writes. State persistence/rehydration uses timestamps to recover elapsed time.
- [ADR-013: BLE GATT Protocol Design](./013-ble-gatt-protocol-design.md) — Timer states exposed via Timer Service characteristics match the `transition(state, event) → newState` model. Device runs its own timer independently; BLE device syncs sessions through phone app via outbox queue (ADR-006).
- [ADR-019: Notification Strategy](./019-notification-strategy.md) — timer end fires local notification; silent delivery suppresses encouragement taps during active `focusing` state
