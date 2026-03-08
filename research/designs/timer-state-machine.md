# Design: Timer State Machine

**Date:** 2026-03-07
**Status:** Accepted
**Related ADR:** [ADR-004: Timer State Machine](../decisions/004-timer-state-machine.md)
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context & Scope

The Pomodoro timer is the central feature of PomoFocus. It manages the cycle: focus session → break → (optional reflection) → next session, with configurable durations and session counting. The timer must run on 9 platforms spanning 3 languages (TypeScript, Swift, C++), so the state model must be language-agnostic and the implementation must be pure (no IO, no intervals, no side effects).

This design defines: (1) the state model — which states exist and which transitions are valid, (2) the architecture — how the pure state machine in `packages/core/` connects to platform-specific timer drivers, and (3) the persistence/rehydration strategy for app restarts.

## Goals & Non-Goals

**Goals:**
- Define the complete set of timer states and valid transitions
- Keep the state machine as a pure function: `(state, event) → newState`
- Make the state model translatable to Swift `enum` and C++ `enum class` without modification
- Support persistence and rehydration (app killed and relaunched mid-session)
- Support configurable durations (focus, short break, long break, sessions before long break)

**Non-Goals:**
- Timer interval management (owned by platform-specific timer drivers, not `core/`)
- Sound/haptic feedback on transitions (side effects handled by consumers)
- BLE device sync conflict resolution (BLE device syncs sessions through phone app via outbox queue — see [ADR-006](../decisions/006-offline-first-sync-architecture.md); BLE Protocol ADR still pending)
- Analytics recording of completed sessions (handled by consumers calling `data-access/`)
- UI rendering of timer state (handled by `packages/state/` Zustand stores and `packages/ui/`)

## The Design

### State Model

```
                          ┌─────────────────────────────────────────────┐
                          │                                             │
    ┌──────┐  START   ┌───┴────┐  PAUSE   ┌────────┐  RESUME  ┌───────┴┐
    │ idle │─────────→│focusing│─────────→│ paused │─────────→│focusing│
    └──────┘          └───┬────┘          └───┬────┘          └────────┘
                          │                   │
                    TIMER_DONE             ABANDON
                          │                   │
                          ▼                   ▼
                    ┌───────────┐        ┌──────────┐
                    │short_break│        │abandoned  │
                    │ or        │        │(terminal) │
                    │long_break │        └──────────┘
                    └─────┬─────┘
                          │
                    TIMER_DONE
                          │
                          ▼
                    ┌───────────┐  SUBMIT    ┌──────────┐
                    │reflection │───────────→│completed │
                    └─────┬─────┘            │(terminal)│
                          │                  └──────────┘
                       SKIP
                          │
                          ▼
                    ┌──────────┐
                    │completed │
                    │(terminal)│
                    └──────────┘
```

### States

| State | Description | Data |
|-------|-------------|------|
| `idle` | No active session. Waiting for user to start. | `config` (durations, session count target) |
| `focusing` | Focus timer counting down. | `timeRemaining`, `startedAt`, `sessionNumber`, `config` |
| `paused` | Focus timer paused. | `timeRemaining`, `pausedAt`, `sessionNumber`, `config` |
| `short_break` | Short break timer counting down. | `timeRemaining`, `startedAt`, `sessionNumber`, `config` |
| `long_break` | Long break timer counting down (every Nth session). | `timeRemaining`, `startedAt`, `sessionNumber`, `config` |
| `break_paused` | Break timer paused. | `timeRemaining`, `pausedAt`, `breakType`, `sessionNumber`, `config` |
| `reflection` | Post-session reflection prompt. No timer. | `sessionNumber`, `config` |
| `completed` | Session cycle finished. Terminal state. | `sessionNumber`, `reflectionData?` |
| `abandoned` | User abandoned the session. Terminal state. | `sessionNumber`, `abandonedAt` |

### Events

| Event | Valid From | Transitions To |
|-------|-----------|---------------|
| `START` | `idle` | `focusing` |
| `PAUSE` | `focusing`, `short_break`, `long_break` | `paused`, `break_paused` |
| `RESUME` | `paused`, `break_paused` | `focusing`, `short_break` or `long_break` |
| `TICK` | `focusing`, `short_break`, `long_break` | same state (decremented `timeRemaining`) |
| `TIMER_DONE` | `focusing` | `short_break` or `long_break` (guard: session count) |
| `TIMER_DONE` | `short_break`, `long_break` | `reflection` (if enabled) or `focusing` (next session) or `completed` (all sessions done) |
| `SKIP` | `reflection` | `completed` or `focusing` (next session) |
| `SUBMIT` | `reflection` | `completed` or `focusing` (next session) |
| `ABANDON` | `focusing`, `paused`, `short_break`, `long_break`, `break_paused` | `abandoned` |
| `RESET` | any terminal state (`completed`, `abandoned`) | `idle` |

### Guards

| Guard | Checks | Used By |
|-------|--------|---------|
| `isLongBreak` | `sessionNumber % config.sessionsBeforeLongBreak === 0` | `TIMER_DONE` from `focusing` |
| `isReflectionEnabled` | `config.reflectionEnabled` | `TIMER_DONE` from break states |

> **Note (resolved via ADR-005):** `totalSessions` and `isAllSessionsDone` guard removed. Session cycles are open-ended — the user decides when to stop ("Start another?" / "Done for now"). The `completed` terminal state is only reached via user choice, not an auto-complete count. `reflectionEnabled` is stored in `user_preferences.reflection_enabled` (default `true`).

### TypeScript Implementation Shape

```typescript
// Discriminated union — each state carries only its relevant data
type TimerState =
  | { status: 'idle'; config: TimerConfig }
  | { status: 'focusing'; timeRemaining: number; startedAt: number; sessionNumber: number; config: TimerConfig }
  | { status: 'paused'; timeRemaining: number; pausedAt: number; sessionNumber: number; config: TimerConfig }
  | { status: 'short_break'; timeRemaining: number; startedAt: number; sessionNumber: number; config: TimerConfig }
  | { status: 'long_break'; timeRemaining: number; startedAt: number; sessionNumber: number; config: TimerConfig }
  | { status: 'break_paused'; timeRemaining: number; pausedAt: number; breakType: 'short' | 'long'; sessionNumber: number; config: TimerConfig }
  | { status: 'reflection'; sessionNumber: number; config: TimerConfig }
  | { status: 'completed'; sessionNumber: number; reflectionData?: ReflectionData }
  | { status: 'abandoned'; sessionNumber: number; abandonedAt: number }

type TimerEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK' }
  | { type: 'TIMER_DONE' }
  | { type: 'SKIP' }
  | { type: 'SUBMIT'; data: ReflectionData }
  | { type: 'ABANDON' }
  | { type: 'RESET' }

// Pure function — no side effects, no intervals
function transition(state: TimerState, event: TimerEvent): TimerState {
  switch (state.status) {
    case 'idle':
      // only START is valid
    case 'focusing':
      // PAUSE, TICK, TIMER_DONE, ABANDON
    // ... exhaustive switch
  }
}
```

### Architecture: State Machine + Timer Drivers

```
┌─────────────────────────────────────────────────────┐
│  packages/core/timer/                               │
│                                                     │
│  transition(state, event) → newState    (pure)      │
│  tick(state) → newState                 (pure)      │
│  createInitialState(config) → state     (pure)      │
│  isRunning(state) → boolean             (pure)      │
│  getTimeRemaining(state) → number       (pure)      │
│                                                     │
│  No intervals. No IO. No React. No Supabase.        │
└──────────────────────┬──────────────────────────────┘
                       │ imported by
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────────┐
│packages/state│ │native/   │ │firmware/device/│
│              │ │          │ │                │
│Zustand store │ │Swift enum│ │C++ enum class  │
│+ setInterval │ │+ Timer   │ │+ millis() loop │
│              │ │          │ │                │
│React apps:   │ │iOS widget│ │ESP32 BLE device│
│web, mobile,  │ │watchOS   │ │                │
│VS Code       │ │macOS bar │ │                │
└──────────────┘ └──────────┘ └────────────────┘
```

**Timer driver responsibilities** (per platform):
1. Call `transition(state, 'START')` when user taps start
2. If new state is a "running" state (`focusing`, `short_break`, `long_break`), start the platform's timing mechanism
3. Every ~1 second, call `transition(state, { type: 'TICK' })` to decrement `timeRemaining`
4. When `timeRemaining` reaches 0, call `transition(state, { type: 'TIMER_DONE' })`
5. On any state change away from a "running" state, stop the timing mechanism
6. Trigger platform-specific side effects (sound, haptic, notification) based on state transitions

### Persistence & Rehydration

When the app is killed and relaunched mid-session:

1. **On state change:** Persist the current `TimerState` to storage (MMKV on mobile, localStorage on web — per ADR-003's persistence adapters)
2. **On relaunch:** Load persisted state. If the state is a "running" state (`focusing`, `short_break`, `long_break`):
   - Compute elapsed time: `now - state.startedAt`
   - Subtract from `timeRemaining`
   - If `timeRemaining <= 0`, call `transition(state, { type: 'TIMER_DONE' })` to advance to the next phase
   - If `timeRemaining > 0`, restart the timer driver with the adjusted `timeRemaining`
3. **If paused:** No time adjustment needed — just restore the state as-is

The `startedAt` timestamp (milliseconds since epoch) is the key field that makes rehydration work. It's always set when entering a "running" state.

## Alternatives Considered

**XState v5** was rejected because: (1) its runtime model assumes a single JavaScript environment, but 5 of 9 platforms run Swift or C++; (2) invoked services and actors add complexity not needed for the Pomodoro timer's ~9 states; (3) ~40KB bundle size vs 0KB; (4) the learning curve is steep for someone without state machine library experience; (5) XState's auto-cleanup of invoked services — its strongest advantage — is irrelevant when `core/` is pure and doesn't own intervals.

**Start hand-rolled, migrate to XState later** was rejected because: (1) the `packages/core/` boundary already isolates the implementation, so adding XState later is possible regardless; (2) planning a migration introduces "two learning curves" overhead; (3) the migration trigger (complexity beyond ~10 states) is unlikely for a Pomodoro timer.

## Cross-Cutting Concerns

- **Security:** No security implications. Timer state is local, contains no PII, and doesn't involve network calls or auth.
- **Cost:** Zero — the state machine is client-side pure logic. No servers, no API calls.
- **Observability:** Timer state transitions should be loggable for debugging. In development, the Zustand devtools (already chosen in ADR-003) will show state changes. In production, completed/abandoned session events flow to analytics via `data-access/`.
- **Migration path:** If XState is needed later, the migration affects only `packages/core/timer/` internals. The `transition()` function signature stays the same — consumers in `packages/state/` and native platforms don't change.

## Open Questions

1. **~~Reflection flow details~~** — **Resolved by ADR-005.** Reflection collects `focus_quality` (locked_in / decent / struggled) and conditionally `distraction_type` (if struggled). Skippable — controlled by `user_preferences.reflection_enabled`. Abandonment reason ("Had to stop" / "Gave up") collected optionally by app layer after timer reaches `abandoned` state. `ReflectionData = { focusQuality?: FocusQuality; distractionType?: DistractionType }`.
2. **Background timer accuracy:** On iOS, `setInterval` accuracy degrades when the app is backgrounded. Should the React Native timer driver use a native module for accurate background timing, or is timestamp-based rehydration sufficient? (Deferred to implementation — test actual behavior first.)
3. **BLE device timer sync:** When the device and phone both have timer state, which is authoritative? What happens on reconnection? (Sync architecture decided in [ADR-006](../decisions/006-offline-first-sync-architecture.md) — device syncs sessions through phone via outbox queue. Timer conflict resolution deferred to BLE Protocol ADR.)
