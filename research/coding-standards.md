# PomoFocus Coding Standards & Guardrails

> **Purpose:** Prevent structural mistakes before they happen. Every rule is specific, enforceable, and backed by an ADR or expert source. This is NOT a style guide (Prettier/ESLint handle formatting). This is a behavioral guardrails document — rules about architecture, patterns, and decisions.
>
> **Audience:** AI agents and human developers writing code in the PomoFocus monorepo.
>
> **Companion:** See [coding-standards-eslint-nx.md](./coding-standards-eslint-nx.md) for the exact ESLint, Nx, and tsconfig configuration that enforces automatable rules.

---

## 1. Universal Rules

Apply to ALL TypeScript code in the repo — every package, every app.

---

### U-001: No `any` type

**Scope:** All `.ts` and `.tsx` files
**Rule:** Never use the `any` type — use `unknown`, generics, or proper type narrowing instead.
**Why:** `any` silently disables type checking and propagates through assignments, making bugs invisible at compile time.

```typescript
// Bad
function parseResponse(data: any) {
  return data.sessions.map((s: any) => s.id);
}

// Good
function parseResponse(data: unknown): string[] {
  const parsed = SessionResponseSchema.parse(data);
  return parsed.sessions.map((s) => s.id);
}
```

**Enforced by:** `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return` (all in `strict-type-checked` config)

---

### U-002: Named exports only

**Scope:** All `.ts` and `.tsx` files
**Rule:** Use named exports — never default exports — except where frameworks require them (`page.tsx`, `layout.tsx`, `route.ts` in Next.js App Router).
**Why:** Default exports make refactoring fragile (importers can name them anything), break tree-shaking analysis, and make search/grep unreliable.

```typescript
// Bad
export default function TimerDisplay() { /* ... */ }

// Good
export function TimerDisplay() { /* ... */ }
```

**Enforced by:** `eslint-plugin-import/no-default-export` with file pattern exceptions for Next.js conventions

---

### U-003: `import type` for type-only imports

**Scope:** All `.ts` and `.tsx` files
**Rule:** Use `import type` for imports that are only used in type positions — never import a type with a runtime import statement.
**Why:** Prevents unused runtime imports from bloating bundles and ensures clean tree-shaking.

```typescript
// Bad
import { TimerState, transition } from '@pomofocus/core/timer';
// (TimerState used only as a type annotation)

// Good
import type { TimerState } from '@pomofocus/core/timer';
import { transition } from '@pomofocus/core/timer';
```

**Enforced by:** `@typescript-eslint/consistent-type-imports` with `fixStyle: 'inline-type-imports'`

---

### U-004: `type` over `interface`

**Scope:** All `.ts` and `.tsx` files
**Rule:** Use `type` for type definitions by default — use `interface` only when you need declaration merging or `extends` for class implementation.
**Why:** `interface` allows accidental declaration merging (two interfaces with the same name silently merge), which creates subtle bugs. `type` is closed by default.

```typescript
// Bad
interface TimerConfig {
  workDuration: number;
  breakDuration: number;
}

// Good
type TimerConfig = {
  workDuration: number;
  breakDuration: number;
};
```

**Enforced by:** `@typescript-eslint/consistent-type-definitions` set to `type`

---

### U-005: Explicit return types on exported functions

**Scope:** All `.ts` and `.tsx` files (exported functions only)
**Rule:** Every exported function must have an explicit return type annotation.
**Why:** Implicit return types leak implementation details into the public API and produce confusing errors at call sites instead of at the definition.

```typescript
// Bad
export function getStreakDays(sessions: Session[]) {
  // return type is inferred — changes if implementation changes
  return sessions.filter(s => s.completed).length;
}

// Good
export function getStreakDays(sessions: Session[]): number {
  return sessions.filter(s => s.completed).length;
}
```

**Enforced by:** `@typescript-eslint/explicit-function-return-type` with `allowExpressions: true`

---

### U-006: No floating promises

**Scope:** All `.ts` and `.tsx` files
**Rule:** Every promise must be awaited, returned, or explicitly voided — never left floating.
**Why:** Floating promises swallow errors silently, creating bugs that are nearly impossible to debug in production.

```typescript
// Bad
function saveSession(session: Session): void {
  uploadSession(session); // promise floats — errors silently swallowed
}

// Good
async function saveSession(session: Session): Promise<void> {
  await uploadSession(session);
}

// Also good (explicit void for fire-and-forget)
function triggerBackgroundSync(): void {
  void syncQueue.flush();
}
```

**Enforced by:** `@typescript-eslint/no-floating-promises`

---

### U-007: No misused promises

**Scope:** All `.ts` and `.tsx` files
**Rule:** Never pass an async function where a sync callback is expected (e.g., array methods, event handlers without error boundaries).
**Why:** Async callbacks in sync contexts silently create unhandled promises, breaking error propagation.

```typescript
// Bad
const ids = sessions.forEach(async (s) => {
  await saveToOutbox(s);
});

// Good
for (const s of sessions) {
  await saveToOutbox(s);
}
// Or use Promise.all for parallelism
await Promise.all(sessions.map((s) => saveToOutbox(s)));
```

**Enforced by:** `@typescript-eslint/no-misused-promises`

---

### U-008: Exhaustive switch on discriminated unions

**Scope:** All `.ts` and `.tsx` files
**Rule:** Every `switch` statement on a discriminated union must handle all variants — use `default: never` or let the ESLint rule catch missing cases.
**Why:** Missing a variant in a switch is the #1 source of bugs when new states are added to the timer, sync, or any FSM. The compiler should catch this at build time. ([ADR-004](./decisions/004-timer-state-machine.md))

```typescript
// Bad
function getLabel(state: TimerState): string {
  switch (state.status) {
    case 'idle': return 'Start';
    case 'focusing': return 'Focus';
    // 'break', 'reflection', 'paused', 'completed', 'abandoned' missing!
  }
}

// Good
function getLabel(state: TimerState): string {
  switch (state.status) {
    case 'idle': return 'Start';
    case 'focusing': return 'Focus';
    case 'break': return 'Break';
    case 'reflection': return 'Reflect';
    case 'paused': return 'Paused';
    case 'completed': return 'Done';
    case 'abandoned': return 'Stopped';
    default: {
      const _exhaustive: never = state.status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

**Enforced by:** `@typescript-eslint/switch-exhaustiveness-check`

---

### U-009: No `as` type assertions

**Scope:** All `.ts` and `.tsx` files
**Rule:** Never use `as` type assertions to bypass the type system — use type guards, Zod parsing, or proper narrowing instead. Exception: `as const` is allowed and encouraged.
**Why:** `as` tells the compiler "trust me" — it doesn't perform any runtime check, so it hides bugs that surface as crashes in production.

```typescript
// Bad
const session = response.data as Session;
const config = JSON.parse(raw) as TimerConfig;

// Good
const session = SessionSchema.parse(response.data);
// Or with a type guard
function isSession(data: unknown): data is Session {
  return typeof data === 'object' && data !== null && 'id' in data;
}
```

**Enforced by:** `@typescript-eslint/consistent-type-assertions` with `assertionStyle: 'never'` (allowing `as const`)

---

### U-010: No TypeScript `enum` keyword

**Scope:** All `.ts` and `.tsx` files
**Rule:** Never use the `enum` keyword — use `as const` objects with derived union types instead. (Postgres ENUM types in the database are fine — this rule is about TypeScript.)
**Why:** TS enums generate runtime JavaScript objects, have surprising numeric auto-increment behavior, don't tree-shake well, and can't be used with `satisfies`. `as const` objects are plain JS that TypeScript understands perfectly.

```typescript
// Bad
enum TimerStatus {
  Idle,
  Focusing,
  Break,
}

// Good
const TIMER_STATUS = {
  idle: 'idle',
  focusing: 'focusing',
  break: 'break',
} as const;

type TimerStatus = (typeof TIMER_STATUS)[keyof typeof TIMER_STATUS];
// => 'idle' | 'focusing' | 'break'
```

**Enforced by:** `no-restricted-syntax` targeting `TSEnumDeclaration`

---

### U-011: `satisfies` for config objects

**Scope:** All `.ts` and `.tsx` files
**Rule:** Use `satisfies` (not `:` annotation) when defining config objects that should be checked against a type while preserving their literal types.
**Why:** `:` annotation widens literal types to their base type, losing autocomplete and narrowing. `satisfies` checks the type without widening.

```typescript
// Bad — widens to Record<string, number>, loses literal keys
const DURATIONS: Record<string, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

// Good — checked against type but preserves literal keys
const DURATIONS = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
} as const satisfies Record<string, number>;
// DURATIONS.work is typed as 1500, not number
```

**Enforced by:** Code review

---

### U-012: `as const` for literal objects and arrays

**Scope:** All `.ts` and `.tsx` files
**Rule:** Use `as const` on constant objects and arrays that represent fixed data (config values, lookup tables, enum-like collections).
**Why:** Without `as const`, TypeScript widens `'idle'` to `string` and `25` to `number`, losing the precision needed for discriminated unions and exhaustive checks.

```typescript
// Bad
const EVENTS = ['START', 'PAUSE', 'RESUME', 'STOP'];
// type: string[]

// Good
const EVENTS = ['START', 'PAUSE', 'RESUME', 'STOP'] as const;
// type: readonly ['START', 'PAUSE', 'RESUME', 'STOP']
type TimerEvent = (typeof EVENTS)[number];
// => 'START' | 'PAUSE' | 'RESUME' | 'STOP'
```

**Enforced by:** Code review

---

### U-013: `noUncheckedIndexedAccess` enabled

**Scope:** `tsconfig.base.json`
**Rule:** The `noUncheckedIndexedAccess` compiler option must be enabled in the root tsconfig.
**Why:** Without it, `array[0]` is typed as `T` instead of `T | undefined`, which hides out-of-bounds access bugs — the most common source of runtime `undefined` errors.

```typescript
// With noUncheckedIndexedAccess: false (BAD — default)
const first = sessions[0]; // type: Session (lie!)
first.id; // compiles, crashes at runtime if array is empty

// With noUncheckedIndexedAccess: true (GOOD)
const first = sessions[0]; // type: Session | undefined
first?.id; // forces you to handle undefined
```

**Enforced by:** `tsconfig.base.json` → `compilerOptions.noUncheckedIndexedAccess: true`

---

### U-014: No deep barrel re-exports

**Scope:** All `index.ts` files
**Rule:** Barrel files (`index.ts`) may re-export from immediate children only — never re-export from nested subdirectories or other packages.
**Why:** Deep barrel re-exports create circular dependency risks, slow down TypeScript compilation, and make Nx's affected detection unreliable.

```typescript
// Bad — packages/core/src/index.ts
export * from './timer';
export * from './timer/utils';       // nested re-export
export * from './sync/protocol';     // nested re-export
export * from '@pomofocus/types';    // cross-package re-export

// Good — packages/core/src/index.ts
export { transition, createInitialState } from './timer';
export { processQueue } from './sync';
// Consumers import from subpaths for deeper access:
// import { formatTime } from '@pomofocus/core/timer/utils';
```

**Enforced by:** Code review + Nx module boundaries

---

## 2. Package-Level Rules

Rules specific to each package in the monorepo. These enforce the import direction and responsibility boundaries defined in [ADR-001](./decisions/001-monorepo-package-structure.md).

**Import direction (one-way, never reversed):**
```
types ← core ← analytics
                data-access ← state
                                ↑
ui ────────────────────────────/
ble-protocol ─────────────────/
Apps consume all packages.
```

---

### 2a. `packages/types/` — Auto-Generated Types

---

#### PKG-T01: Never edit auto-generated files

**Scope:** `packages/types/src/database.ts`, `packages/types/src/generated/**`, `packages/ble-protocol/src/generated/**`
**Rule:** Never manually edit files generated by `supabase gen types` or `protoc` — your changes will be destroyed on the next generation run.
**Why:** Generated files are downstream projections of the Postgres schema and Protobuf definitions. Manual edits create drift that's silently overwritten. ([ADR-005](./decisions/005-database-schema-data-model.md))

```typescript
// Bad — editing packages/types/src/database.ts
export type Session = {
  id: string;
  user_id: string;
  custom_field: string; // manually added — will vanish on next gen
};

// Good — extend in a separate file
// packages/types/src/session-helpers.ts
import type { Database } from './database';
type Session = Database['public']['Tables']['sessions']['Row'];
type SessionWithDuration = Session & { durationMinutes: number };
```

**Enforced by:** `// AUTO-GENERATED — DO NOT EDIT` header comment + CI hash check (future `supabase.yml`)

---

#### PKG-T02: Regenerate types after every schema change

**Scope:** `packages/types/`, CI pipeline
**Rule:** After every database migration, run `supabase gen types` to regenerate TypeScript types and `supabase gen types --lang swift` for Swift types.
**Why:** Stale types silently drift from the schema, causing runtime errors that the type system should have caught. ([ADR-005](./decisions/005-database-schema-data-model.md))

```bash
# Bad — run migration, forget to regenerate
supabase migration new add_reflection_columns
# ... write SQL ... done. Ship it. (types are now stale)

# Good — always regenerate after migration
supabase migration new add_reflection_columns
# ... write SQL ...
supabase gen types --lang typescript --project-id $PROJECT_ID > packages/types/src/database.ts
supabase gen types --lang swift --project-id $PROJECT_ID > native/apple/shared/DatabaseTypes.swift
```

**Enforced by:** CI type-drift detection in `supabase.yml` workflow ([ADR-009](./decisions/009-ci-cd-pipeline-design.md))

---

#### PKG-T03: Protobuf types from `.proto`, never hand-written

**Scope:** `packages/ble-protocol/src/generated/`, `native/apple/shared/`, `firmware/device/src/generated/`
**Rule:** All BLE message types are generated from `packages/ble-protocol/proto/pomofocus.proto` via `protoc` (TS, Swift) and `nanopb_generator` (C) — never write Protobuf message types by hand.
**Why:** Hand-written types across 3 languages (TS, Swift, C) will drift, causing silent serialization failures over BLE. ([ADR-013](./decisions/013-ble-gatt-protocol-design.md))

```typescript
// Bad — hand-written in packages/ble-protocol/src/types.ts
type TimerStateMessage = {
  status: number;
  remainingSeconds: number;
};

// Good — import from generated
import type { TimerStateMessage } from './generated/pomofocus_pb';
```

**Enforced by:** CI protobuf generation check

---

### 2b. `packages/core/` — Pure Domain Logic

The most critical package. Contains timer FSM, sync protocol, goal logic, and session management. Must be portable across 9 platforms (web, mobile, macOS, watchOS, VS Code, MCP, firmware port, tests, server).

---

#### PKG-C01: No IO imports in core

**Scope:** `packages/core/**`
**Rule:** Never import or use IO primitives — no `fetch`, `fs`, `net`, `http`, `XMLHttpRequest`, `navigator`, `window`, `document`, `process`, or any Node.js/browser API.
**Why:** Core must run identically in Node, Bun, React Native, CF Workers, and as a reference for the C++ firmware port. Any IO import breaks cross-platform portability. ([ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-004](./decisions/004-timer-state-machine.md))

```typescript
// Bad — packages/core/src/sync/protocol.ts
import { fetch } from 'node-fetch';

export async function uploadSession(session: Session): Promise<void> {
  await fetch('/api/sessions', { body: JSON.stringify(session) });
}

// Good — packages/core/src/sync/protocol.ts
export function processQueue(queue: SyncQueue, event: SyncEvent): SyncQueue {
  // Pure state machine — no IO, returns new state
  switch (event.type) {
    case 'UPLOAD_SUCCESS': return { ...queue, items: queue.items.slice(1) };
    case 'UPLOAD_FAILURE': return { ...queue, retryAt: event.retryAt };
    // ...
  }
}
```

**Enforced by:** Nx `bannedExternalImports` + `no-restricted-globals` ESLint override for `packages/core/**`

---

#### PKG-C02: No React imports in core

**Scope:** `packages/core/**`
**Rule:** Never import `react`, `react-native`, `react-dom`, or any React-related package in core.
**Why:** Core is consumed by non-React platforms (MCP server, firmware reference, CF Workers). React imports break those consumers and violate the package layer boundary. ([ADR-001](./decisions/001-monorepo-package-structure.md))

```typescript
// Bad — packages/core/src/timer/useTimer.ts
import { useState, useEffect } from 'react';
export function useTimer() { /* ... */ }

// Good — this hook belongs in packages/state/
// packages/state/src/timer/useTimer.ts
import { useState, useEffect } from 'react';
import { transition } from '@pomofocus/core/timer';
export function useTimer() { /* ... */ }
```

**Enforced by:** Nx `bannedExternalImports` on `type:domain` tag

---

#### PKG-C03: No Supabase imports in core

**Scope:** `packages/core/**`
**Rule:** Never import `@supabase/supabase-js`, `@supabase/auth-helpers`, or any Supabase package in core.
**Why:** Core is a pure domain logic layer. Supabase is an infrastructure detail that belongs in `data-access/`. Coupling core to Supabase would make every platform depend on the Supabase SDK. ([ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-002](./decisions/002-auth-architecture.md))

```typescript
// Bad — packages/core/src/sessions/save.ts
import { createClient } from '@supabase/supabase-js';
export async function saveSession(session: Session) {
  const supabase = createClient(URL, KEY);
  await supabase.from('sessions').insert(session);
}

// Good — packages/core/src/sessions/validate.ts
export function validateSession(session: Session): ValidationResult {
  if (session.workDuration < 60) return { valid: false, error: 'Too short' };
  return { valid: true };
}
// IO happens in data-access/, not here
```

**Enforced by:** Nx `bannedExternalImports` on `type:domain` tag

---

#### PKG-C04: No timers or clocks in core

**Scope:** `packages/core/**`
**Rule:** Never use `setTimeout`, `setInterval`, `Date.now()`, `new Date()`, `performance.now()`, or `requestAnimationFrame` in core. Receive the current time as a parameter.
**Why:** The timer FSM must be a pure function — same input always produces same output. Side-effectful time access makes tests non-deterministic and breaks the firmware port (which uses `millis()`). ([ADR-004](./decisions/004-timer-state-machine.md))

```typescript
// Bad — packages/core/src/timer/machine.ts
export function getRemainingTime(state: FocusingState): number {
  return state.endTime - Date.now(); // side effect!
}

// Good — packages/core/src/timer/machine.ts
export function getRemainingTime(state: FocusingState, now: number): number {
  return state.endTime - now; // pure — time injected as parameter
}
```

**Enforced by:** `no-restricted-globals` ESLint override for `packages/core/**` banning `setTimeout`, `setInterval`, `Date`, `performance`

---

#### PKG-C05: No auth tokens in core

**Scope:** `packages/core/**`
**Rule:** Core functions receive `userId: string` as a parameter — never a session object, JWT token, or auth context.
**Why:** Auth is an infrastructure concern. Core must not know whether auth comes from Supabase, a test harness, or a mock. Leaking auth into core couples it to a specific auth provider. ([ADR-002](./decisions/002-auth-architecture.md))

```typescript
// Bad — packages/core/src/goals/create.ts
import { Session } from '@supabase/supabase-js';

export function createGoal(session: Session, goal: GoalInput) {
  return { ...goal, userId: session.user.id };
}

// Good — packages/core/src/goals/create.ts
export function createGoal(userId: string, goal: GoalInput): Goal {
  return { ...goal, userId };
}
```

**Enforced by:** Nx `bannedExternalImports` (blocks Supabase imports) + type system (no auth types in core's dependency graph)

---

#### PKG-C06: FSMs follow `transition(state, event) → newState`

**Scope:** `packages/core/src/timer/`, `packages/core/src/sync/`
**Rule:** All finite state machines in core must be implemented as pure `transition` functions that take the current state and an event, and return a new state — no mutations, no side effects.
**Why:** This pattern is testable (just assert input → output), portable (works in any language/runtime), and matches the firmware C++ port. ([ADR-004](./decisions/004-timer-state-machine.md), [ADR-006](./decisions/006-offline-first-sync-architecture.md))

```typescript
// Bad — mutating state in place
export function handleEvent(state: TimerState, event: TimerEvent): void {
  if (event.type === 'START') {
    state.status = 'focusing'; // mutation!
    state.startedAt = event.now;
  }
}

// Good — return new state
export function transition(state: TimerState, event: TimerEvent): TimerState {
  switch (state.status) {
    case 'idle':
      if (event.type === 'START') {
        return { status: 'focusing', startedAt: event.now, duration: state.duration };
      }
      return state;
    // ... exhaustive switch
  }
}
```

**Enforced by:** Code review + 100% test coverage (TST-001)

---

#### PKG-C07: No downward imports in core

**Scope:** `packages/core/**`
**Rule:** Core may only import from `@pomofocus/types`. Never import from `data-access`, `analytics`, `state`, `ui`, or `ble-protocol`.
**Why:** Core is the foundation layer — if it depends on layers above it, the entire dependency graph becomes circular, breaking Nx affected detection and making the package unportable. ([ADR-001](./decisions/001-monorepo-package-structure.md))

```typescript
// Bad — packages/core/src/timer/machine.ts
import { useTimerStore } from '@pomofocus/state/timer'; // downward!
import { uploadSession } from '@pomofocus/data-access/sync'; // downward!

// Good — packages/core/src/timer/machine.ts
import type { Session } from '@pomofocus/types';
// core only imports from types
```

**Enforced by:** Nx `@nx/enforce-module-boundaries` depConstraints

---

#### PKG-C08: 100% test coverage for core

**Scope:** `packages/core/**`
**Rule:** Every function in `packages/core/` must have test coverage. CI enforces 100% line and branch coverage.
**Why:** Core contains the timer FSM, sync protocol, and goal logic — bugs here propagate to all 9 platforms. The pure function pattern makes 100% coverage achievable and fast. ([ADR-004](./decisions/004-timer-state-machine.md))

```typescript
// packages/core/src/timer/__tests__/machine.test.ts
import { describe, it, expect } from 'vitest';
import { transition, createInitialState } from '../machine';

describe('timer transition', () => {
  it('idle + START → focusing', () => {
    const state = createInitialState({ workDuration: 1500 });
    const next = transition(state, { type: 'START', now: 1000 });
    expect(next.status).toBe('focusing');
  });

  // Test EVERY state × event combination
});
```

**Enforced by:** Vitest coverage threshold in `vitest.config.ts`: `{ branches: 100, lines: 100, functions: 100 }`

---

### 2c. `packages/analytics/` — Pure Computation

---

#### PKG-A01: No IO imports in analytics

**Scope:** `packages/analytics/**`
**Rule:** No IO imports — same restrictions as core. Analytics functions are pure: input data in, computed metrics out.
**Why:** Analytics are executed server-side by the Hono API. Keeping them pure means the same functions work in tests, in the API, and potentially in a future batch worker. ([ADR-014](./decisions/014-analytics-insights-architecture.md))

```typescript
// Bad — packages/analytics/src/streaks.ts
import { createClient } from '@supabase/supabase-js';
export async function getStreak(userId: string) {
  const { data } = await createClient(URL, KEY)
    .from('sessions').select().eq('user_id', userId);
  // ...
}

// Good — packages/analytics/src/streaks.ts
import type { Session } from '@pomofocus/types';
export function computeStreak(sessions: Session[], timezone: string): number {
  // Pure function — receives data, returns number
}
```

**Enforced by:** Nx `bannedExternalImports` on `type:domain` tag (analytics shares the tag with core)

---

#### PKG-A02: No composite Focus Score

**Scope:** `packages/analytics/**`
**Rule:** Never create a single composite "Focus Score" number. Use individual component metrics (completion rate, focus quality distribution, consistency, streaks) with trend arrows.
**Why:** A composite score obscures what's actually changing, is gameable, and makes the product feel like a grading system rather than a reflection tool. This is a core product decision. ([ADR-014](./decisions/014-analytics-insights-architecture.md))

```typescript
// Bad
export function computeFocusScore(sessions: Session[]): number {
  return (completionRate * 0.4) + (consistency * 0.3) + (quality * 0.3);
}

// Good
export function computeCompletionRate(sessions: Session[]): MetricWithTrend {
  return { value: completed / total, trend: compareToPrevious(/*...*/) };
}
export function computeConsistency(sessions: Session[]): MetricWithTrend { /* ... */ }
export function computeStreak(sessions: Session[]): MetricWithTrend { /* ... */ }
```

**Enforced by:** Code review

---

#### PKG-A03: Analytics depends on types and core only

**Scope:** `packages/analytics/**`
**Rule:** Analytics may import from `@pomofocus/types` and `@pomofocus/core` only. Never from `data-access`, `state`, `ui`, or `ble-protocol`.
**Why:** Analytics is a computation layer, not a data-fetching layer. Data is fetched by the API route handler and passed to analytics functions as arguments. ([ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-014](./decisions/014-analytics-insights-architecture.md))

**Enforced by:** Nx depConstraints (`type:domain` → `type:domain`, `type:types`)

---

#### PKG-A04: All analytics functions are pure

**Scope:** `packages/analytics/**`
**Rule:** Every exported function must be a pure function: given the same input, always return the same output, with no side effects.
**Why:** Purity enables server-side execution in CF Workers (stateless), deterministic testing, and formula changes via API redeploy without client updates. ([ADR-014](./decisions/014-analytics-insights-architecture.md))

**Enforced by:** Code review + unit tests

---

### 2d. `packages/data-access/` — Server Interaction

---

#### PKG-D01: All auth imports confined to data-access

**Scope:** `packages/data-access/**` (exclusively)
**Rule:** `@supabase/supabase-js` auth methods and token management live in `data-access/` only — no other package imports Supabase Auth.
**Why:** Centralizing auth in one package means switching auth providers requires changes in one place, not across the entire codebase. ([ADR-002](./decisions/002-auth-architecture.md))

```typescript
// Bad — packages/state/src/auth.ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(URL, KEY);
export const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google' });

// Good — packages/data-access/src/auth.ts
import { createClient } from '@supabase/supabase-js';
export function signInWithGoogle(): Promise<AuthResponse> {
  return supabase.auth.signInWithOAuth({ provider: 'google' });
}
// packages/state/ imports from data-access:
// import { signInWithGoogle } from '@pomofocus/data-access/auth';
```

**Enforced by:** Nx depConstraints — only `data-access` project has Supabase auth in allowed imports

---

#### PKG-D02: Generated OpenAPI client, not raw Supabase SDK

**Scope:** `packages/data-access/**`
**Rule:** All data operations (CRUD on sessions, goals, profiles, etc.) must use the generated OpenAPI client (`openapi-fetch`) pointed at the Hono API — never the Supabase SDK's `.from('table')` methods.
**Why:** The Hono API is the single gateway to Supabase. Using the SDK directly exposes table structures, bypasses API validation, and breaks the security model. ([ADR-007](./decisions/007-api-architecture.md))

```typescript
// Bad — packages/data-access/src/sessions.ts
import { supabase } from './client';
export const getSessions = () => supabase.from('sessions').select('*');

// Good — packages/data-access/src/sessions.ts
import { client } from './api-client'; // generated from OpenAPI spec
export const getSessions = () => client.GET('/v1/sessions');
```

**Enforced by:** Nx `bannedExternalImports` — ban `@supabase/supabase-js` in `data-access` for data (auth imports are allowed via a separate entrypoint)

---

#### PKG-D03: Sync drivers in data-access, not core

**Scope:** `packages/data-access/src/sync/`, `packages/core/src/sync/`
**Rule:** Network calls, queue persistence (SQLite, IndexedDB, globalState), and network detection live in `data-access/sync/`. Core's `sync/` contains only the pure queue FSM.
**Why:** Core must stay pure. The sync protocol is the state machine; the sync driver is the IO adapter. Same pattern as the timer. ([ADR-006](./decisions/006-offline-first-sync-architecture.md))

```typescript
// Bad — packages/core/src/sync/driver.ts
import * as SQLite from 'expo-sqlite';
export async function persistQueue(queue: SyncQueue) {
  const db = SQLite.openDatabaseSync('pomofocus');
  await db.runAsync('INSERT INTO outbox ...', queue.items);
}

// Good — packages/data-access/src/sync/driver-mobile.ts
import * as SQLite from 'expo-sqlite';
import { processQueue } from '@pomofocus/core/sync';
// data-access owns the IO, core owns the logic
```

**Enforced by:** Nx depConstraints + PKG-C01 (no IO in core)

---

#### PKG-D04: No React imports in data-access

**Scope:** `packages/data-access/**`
**Rule:** Never import `react`, `react-native`, or React hooks in data-access. This package provides framework-agnostic functions consumed by `state/` (which wraps them in React hooks).
**Why:** data-access is consumed by the MCP server and API tests, neither of which use React. ([ADR-001](./decisions/001-monorepo-package-structure.md))

**Enforced by:** Nx `bannedExternalImports` on `type:infra` tag

---

### 2e. `packages/state/` — React State Layer

---

#### PKG-S01: Server data in TanStack Query, not Zustand

**Scope:** `packages/state/**`
**Rule:** All data from the server (sessions, goals, friends, analytics) must be managed by TanStack Query. Never duplicate server state in a Zustand store.
**Why:** Two sources of truth for the same data causes stale reads, cache inconsistency, and "update the list, but the detail page still shows old data" bugs. ([ADR-003](./decisions/003-client-state-management.md))

```typescript
// Bad — duplicating server data in Zustand
const useSessionStore = create<{ sessions: Session[] }>((set) => ({
  sessions: [],
  fetchSessions: async () => {
    const data = await getSessions();
    set({ sessions: data }); // now you have two caches!
  },
}));

// Good — TanStack Query owns server state
const sessionQueries = {
  all: () => queryOptions({
    queryKey: ['sessions'],
    queryFn: getSessions,
    staleTime: 30_000,
  }),
};
// Zustand only for local/UI state (timer running, modal open, etc.)
```

**Enforced by:** Code review

---

#### PKG-S02: Zustand stores are thin wrappers

**Scope:** `packages/state/**`
**Rule:** Zustand stores must delegate business logic to `@pomofocus/core` functions — the store only manages state updates, not computation.
**Why:** Business logic in stores is untestable without React rendering context. Pure functions in core can be tested with simple `expect(fn(input)).toEqual(output)`. ([ADR-003](./decisions/003-client-state-management.md))

```typescript
// Bad — business logic in the store
const useTimerStore = create((set) => ({
  state: initialState,
  tick: () => set((s) => {
    const remaining = s.state.endTime - Date.now();
    if (remaining <= 0) {
      return { state: { ...s.state, status: 'completed' } };
    }
    return { state: { ...s.state, remaining } };
  }),
}));

// Good — store delegates to core
import { transition } from '@pomofocus/core/timer';

const useTimerStore = create((set) => ({
  state: initialState,
  dispatch: (event: TimerEvent) => set((s) => ({
    state: transition(s.state, event),
  })),
}));
```

**Enforced by:** Code review

---

#### PKG-S03: Always use selectors

**Scope:** `packages/state/**`
**Rule:** Always use a selector function when reading from a Zustand store. For multi-value selections, use `useShallow` to prevent unnecessary re-renders.
**Why:** Without selectors, every component re-renders on every store change, even unrelated fields. This is the #1 Zustand performance mistake.

```typescript
// Bad — subscribes to entire store, re-renders on ANY change
const { timerState, modalOpen } = useTimerStore();

// Good — subscribes to single value
const timerState = useTimerStore((s) => s.timerState);

// Good — multi-value with useShallow
import { useShallow } from 'zustand/react/shallow';
const { timerState, dispatch } = useTimerStore(
  useShallow((s) => ({ timerState: s.timerState, dispatch: s.dispatch }))
);
```

**Enforced by:** Code review

---

#### PKG-S04: Explicit `staleTime` on every query

**Scope:** `packages/state/**`
**Rule:** Every `queryOptions()` call must set an explicit `staleTime` — never rely on the 0ms default.
**Why:** The default `staleTime: 0` means every component mount triggers a refetch. For a 30s polling app, this creates a waterfall of redundant network requests. ([ADR-003](./decisions/003-client-state-management.md))

```typescript
// Bad — default staleTime: 0 causes refetch on every mount
const sessionQueries = {
  all: () => queryOptions({
    queryKey: ['sessions'],
    queryFn: getSessions,
    // staleTime omitted! defaults to 0
  }),
};

// Good — explicit staleTime matches polling interval
const sessionQueries = {
  all: () => queryOptions({
    queryKey: ['sessions'],
    queryFn: getSessions,
    staleTime: 30_000, // matches our 30s polling interval
  }),
};
```

**Enforced by:** Code review

---

#### PKG-S05: `queryOptions()` factory per feature

**Scope:** `packages/state/**`
**Rule:** Define query configurations using TanStack Query v5's `queryOptions()` helper, organized into one factory object per feature (sessions, goals, friends, etc.).
**Why:** `queryOptions()` creates type-safe, reusable query definitions that ensure query key consistency across components — eliminating key typo bugs and cache misses.

```typescript
// Bad — inline query config, key typos cause cache misses
useQuery({ queryKey: ['sesions'], queryFn: getSessions }); // typo!
useQuery({ queryKey: ['sessions'], queryFn: getSessions });

// Good — centralized factory
// packages/state/src/sessions/queries.ts
export const sessionQueries = {
  all: () => queryOptions({
    queryKey: ['sessions'] as const,
    queryFn: getSessions,
    staleTime: 30_000,
  }),
  detail: (id: string) => queryOptions({
    queryKey: ['sessions', id] as const,
    queryFn: () => getSession(id),
    staleTime: 30_000,
  }),
};

// Usage
const { data } = useQuery(sessionQueries.all());
```

**Enforced by:** Code review

---

#### PKG-S06: Zustand middleware order

**Scope:** `packages/state/**`
**Rule:** When composing Zustand middleware, apply in this order (outermost to innermost): `devtools(persist(immer(storeFn)))`.
**Why:** Incorrect middleware order causes devtools to show middleware internals instead of meaningful state diffs, or persistence to serialize middleware wrappers instead of raw state.

```typescript
// Bad — wrong order
const useStore = create(persist(devtools(immer(storeFn))));

// Good — correct order
const useStore = create(
  devtools(
    persist(
      immer(storeFn),
      { name: 'timer-store' }
    ),
    { name: 'TimerStore' }
  )
);
```

**Enforced by:** Code review

---

#### PKG-S07: Prefer query invalidation over cache mutation

**Scope:** `packages/state/**`
**Rule:** After a mutation (create, update, delete), invalidate the relevant query keys to trigger a refetch — don't manually update the TanStack Query cache.
**Why:** Manual cache updates are error-prone (you must replicate server-side transformations), create divergence between cache and server, and are unnecessary with 30s polling. Invalidation is simpler and guaranteed correct.

```typescript
// Bad — manual cache update
const mutation = useMutation({
  mutationFn: createSession,
  onSuccess: (newSession) => {
    queryClient.setQueryData(['sessions'], (old) => [...old, newSession]);
    // if server adds computed fields, cache is now wrong
  },
});

// Good — invalidate and let the next poll/refetch get correct data
const mutation = useMutation({
  mutationFn: createSession,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  },
});
```

**Enforced by:** Code review

---

#### PKG-S08: No `useEffect` for state derivation

**Scope:** `packages/state/**`, all React components
**Rule:** Never use `useEffect` to compute derived state from props or other state. Derive it directly during render.
**Why:** `useEffect` for derivation causes unnecessary re-renders (render → effect → setState → re-render), flashes of stale values, and is a common source of infinite loops.

```typescript
// Bad — useEffect for derivation
function SessionList({ sessions }: { sessions: Session[] }) {
  const [completed, setCompleted] = useState<Session[]>([]);
  useEffect(() => {
    setCompleted(sessions.filter(s => s.completedAt !== null));
  }, [sessions]);
  return <List data={completed} />;
}

// Good — derive during render
function SessionList({ sessions }: { sessions: Session[] }) {
  const completed = sessions.filter(s => s.completedAt !== null);
  return <List data={completed} />;
}
```

**Enforced by:** Code review + `react-hooks/exhaustive-deps` (catches some cases)

---

### 2f. `packages/ui/` — Shared Components

---

#### PKG-U01: UI depends on types only

**Scope:** `packages/ui/**`
**Rule:** UI components may only import from `@pomofocus/types`. Never import from `core`, `data-access`, `state`, or `ble-protocol`.
**Why:** UI components are pure presentation. They receive data via props, not by fetching it themselves. This keeps them reusable across the web app, mobile app, and VS Code webview. ([ADR-001](./decisions/001-monorepo-package-structure.md))

```typescript
// Bad — packages/ui/src/SessionCard.tsx
import { useQuery } from '@tanstack/react-query';
import { sessionQueries } from '@pomofocus/state/sessions';

export function SessionCard({ id }: { id: string }) {
  const { data } = useQuery(sessionQueries.detail(id));
  // ...
}

// Good — packages/ui/src/SessionCard.tsx
import type { Session } from '@pomofocus/types';

export function SessionCard({ session }: { session: Session }) {
  // Pure presentation — data passed as props
}
```

**Enforced by:** Nx depConstraints (`type:ui` → `type:types` only)

---

#### PKG-U02: No state management in UI

**Scope:** `packages/ui/**`
**Rule:** Never import Zustand, TanStack Query, or any state management library in UI components.
**Why:** UI components must be stateless presentations that work in Storybook, tests, and any app shell. State wiring belongs in app-level components or `packages/state/`. ([ADR-001](./decisions/001-monorepo-package-structure.md))

**Enforced by:** Nx `bannedExternalImports` on `type:ui` tag (ban `zustand`, `@tanstack/*`)

---

#### PKG-U03: FlashList over FlatList

**Scope:** `packages/ui/**`, `apps/mobile/**`
**Rule:** Use `@shopify/flash-list` instead of React Native's `FlatList` for all scrollable lists.
**Why:** FlashList uses recycling (like UITableView/RecyclerView) and is 5-10x faster for large lists. FlatList re-mounts cells on scroll, causing jank on mobile.

```typescript
// Bad
import { FlatList } from 'react-native';
<FlatList data={sessions} renderItem={renderItem} />

// Good
import { FlashList } from '@shopify/flash-list';
<FlashList data={sessions} renderItem={renderItem} estimatedItemSize={72} />
```

**Enforced by:** `no-restricted-imports` ESLint rule banning `FlatList` from `react-native`

---

### 2g. `packages/ble-protocol/` — BLE Infrastructure

---

#### PKG-B01: BLE protocol depends on types only

**Scope:** `packages/ble-protocol/**`
**Rule:** The BLE protocol package may only import from `@pomofocus/types`. The `BleTransport` interface, chunked sync state machine, and Protobuf codecs are self-contained.
**Why:** BLE protocol is consumed by mobile (react-native-ble-plx adapter), web (Web Bluetooth adapter), and macOS (CoreBluetooth adapter). It cannot depend on any platform-specific package. ([ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-016](./decisions/016-ble-client-libraries-integration.md))

**Enforced by:** Nx depConstraints (`type:infra` → `type:types` only)

---

#### PKG-B02: Protobuf types auto-generated

**Scope:** `packages/ble-protocol/src/generated/**`
**Rule:** All Protobuf message types are generated from `packages/ble-protocol/proto/pomofocus.proto` — never hand-written.
**Why:** Same reason as PKG-T03. BLE messages must be wire-compatible across TS (phone), Swift (macOS), and C (firmware). Hand-written types will drift. ([ADR-013](./decisions/013-ble-gatt-protocol-design.md))

**Enforced by:** CI protobuf generation check

---

#### PKG-B03: Transport adapters implement BleTransport

**Scope:** `packages/ble-protocol/src/adapters/`
**Rule:** Every platform-specific BLE adapter must implement the `BleTransport` interface (6 operations: scan, connect, disconnect, read, write, subscribe).
**Why:** The shared sync orchestration logic works against the interface, not the adapter. This is what makes BLE sync testable and portable. ([ADR-016](./decisions/016-ble-client-libraries-integration.md))

```typescript
// packages/ble-protocol/src/transport.ts
export type BleTransport = {
  scan(filter: ScanFilter): AsyncIterable<BleDevice>;
  connect(deviceId: string): Promise<BleConnection>;
  disconnect(connection: BleConnection): Promise<void>;
  read(connection: BleConnection, charId: string): Promise<Uint8Array>;
  write(connection: BleConnection, charId: string, data: Uint8Array): Promise<void>;
  subscribe(connection: BleConnection, charId: string): AsyncIterable<Uint8Array>;
};
```

**Enforced by:** TypeScript type system (adapters must satisfy the interface)

---

## 3. App-Level Rules

Apply to all apps: `apps/web/`, `apps/mobile/`, `apps/api/`, `apps/vscode-extension/`, `apps/mcp-server/`.

---

### APP-001: No direct Supabase SDK for data operations

**Scope:** `apps/web/**`, `apps/mobile/**`, `apps/vscode-extension/**`
**Rule:** Client apps must never import `@supabase/supabase-js` for data operations (queries, inserts, updates, deletes). All data goes through the Hono API via the generated OpenAPI client.
**Why:** Direct Supabase access exposes table structures, bypasses API-level validation and rate limiting, and requires shipping the Supabase anon key to clients. ([ADR-007](./decisions/007-api-architecture.md))

```typescript
// Bad — apps/web/src/app/sessions/page.tsx
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const { data } = await supabase.from('sessions').select('*');

// Good — apps/web/src/app/sessions/page.tsx
import { useQuery } from '@tanstack/react-query';
import { sessionQueries } from '@pomofocus/state/sessions';
const { data } = useQuery(sessionQueries.all());
// Under the hood: state → data-access → OpenAPI client → Hono API → Supabase
```

**Enforced by:** Nx `bannedExternalImports` on `scope:web`, `scope:mobile`, `scope:vscode` tags. Exception: `data-access` package may import Supabase for auth only.

---

### APP-002: No Supabase credentials in client bundles

**Scope:** `apps/web/**`, `apps/mobile/**`, `apps/vscode-extension/**`
**Rule:** Never put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in client-side environment variables. The only Supabase credentials in client apps are for the Auth SDK (managed by `data-access/`).
**Why:** Exposing table structures via the client enables enumeration attacks. The API gateway pattern (ADR-007) specifically exists to hide Supabase from clients. ([ADR-007](./decisions/007-api-architecture.md), [ADR-012](./decisions/012-security-data-privacy.md))

**Enforced by:** Code review + `.env` audit in CI

---

### APP-003: Sentry init in app entry points only

**Scope:** `apps/**` (entry point files only)
**Rule:** Sentry SDK initialization belongs in app entry points (`apps/web/src/app/layout.tsx`, `apps/mobile/App.tsx`, etc.) — never in shared packages (`packages/**`).
**Why:** Shared packages don't know which app is consuming them. Multiple Sentry inits cause duplicate error reports and DSN conflicts. ([ADR-011](./decisions/011-monitoring-observability.md))

```typescript
// Bad — packages/core/src/index.ts
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: '...' });

// Good — apps/web/src/instrumentation.ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

**Enforced by:** Nx `bannedExternalImports` — ban `@sentry/*` in all `type:domain`, `type:types`, `type:ui`, `type:infra` packages

---

### APP-004: Platform-secure token storage

**Scope:** All apps
**Rule:** Auth tokens must be stored using the platform's secure storage mechanism — never in localStorage, cookies without HttpOnly, or plain files.
**Why:** Tokens in insecure storage are extractable via XSS (web) or filesystem access (mobile). ([ADR-012](./decisions/012-security-data-privacy.md))

| Platform | Mechanism |
|----------|-----------|
| Web | HttpOnly cookie (set by API, not client JS) |
| Mobile (Expo) | `expo-secure-store` |
| macOS | Keychain (`Security.framework`) |
| VS Code | `SecretStorage` API |

**Enforced by:** Code review

---

### APP-005: No Supabase Realtime without approval

**Scope:** All apps
**Rule:** Never add Supabase Realtime WebSocket subscriptions (`.channel()`, `.on('postgres_changes', ...)`) without explicit written approval.
**Why:** PomoFocus uses polling-first architecture (30s via TanStack Query). Realtime adds WebSocket complexity, connection management, and mobile battery drain — all solved problems with polling. ([ADR-003](./decisions/003-client-state-management.md))

```typescript
// Bad
const channel = supabase.channel('sessions')
  .on('postgres_changes', { event: 'INSERT', schema: 'public' }, handleInsert)
  .subscribe();

// Good — use TanStack Query polling
const { data } = useQuery(sessionQueries.all());
// refetchInterval is configured in the queryOptions factory
```

**Enforced by:** Nx `bannedExternalImports` — ban `@supabase/realtime-js` in all apps and packages

---

### APP-006: Auth flow: clients call Supabase Auth directly

**Scope:** All client apps
**Rule:** Login, signup, and OAuth flows use the Supabase Auth SDK directly (via `data-access/auth`). The Hono API does NOT proxy auth flows — it only validates JWTs on data requests.
**Why:** Proxying auth adds latency, duplicates Supabase's battle-tested auth UI, and creates a single point of failure for login. ([ADR-002](./decisions/002-auth-architecture.md), [ADR-007](./decisions/007-api-architecture.md))

```typescript
// Bad — apps/api/src/routes/auth.ts
app.post('/v1/auth/login', async (c) => {
  const { email, password } = c.req.valid('json');
  const { data } = await supabase.auth.signInWithPassword({ email, password });
  return c.json(data);
});

// Good — auth happens client-side via data-access
// packages/data-access/src/auth.ts
export function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}
// API only validates JWT on data routes:
// apps/api/src/middleware/auth.ts
const user = await supabase.auth.getUser(jwt);
```

**Enforced by:** Code review

---

## 4. Native Platform Rules

---

### 4a. Swift — iOS Widget, macOS Widget, watchOS

---

#### NAT-S01: Swift API Design Guidelines naming

**Scope:** All `.swift` files
**Rule:** Follow Apple's Swift API Design Guidelines: clarity over brevity, argument labels read as grammar, factory methods use `make` prefix, protocols use `-able`/`-ible` or nouns.
**Why:** Swift naming is part of the platform contract. Inconsistent naming makes code feel foreign to iOS/macOS developers and breaks Xcode autocomplete expectations.

```swift
// Bad
func calc(_ s: [Session], _ t: String) -> Int { /* ... */ }
func getGoalProgress(goalId: String) -> Double { /* ... */ }

// Good
func computeStreak(from sessions: [Session], in timezone: String) -> Int { /* ... */ }
func goalProgress(for goalId: String) -> Double { /* ... */ }
```

**Enforced by:** SwiftLint

---

#### NAT-S02: Swift Testing framework, not XCTest

**Scope:** All Swift test files
**Rule:** Use the Swift Testing framework (`@Test`, structs, `#expect`, `#require`) for new tests — not `XCTestCase` subclasses.
**Why:** Swift Testing is Apple's modern testing framework (WWDC 2024). It supports parameterized tests, parallel execution, and integrates with Swift concurrency. XCTest is legacy. ([research/08-testing-frameworks.md](./08-testing-frameworks.md))

```swift
// Bad
class TimerTests: XCTestCase {
    func testStartTransition() {
        XCTAssertEqual(result.status, .focusing)
    }
}

// Good
@Test("Start transition moves to focusing")
func startTransition() {
    let result = TimerFSM.transition(state: .idle, event: .start(now: Date()))
    #expect(result.status == .focusing)
}
```

**Enforced by:** Code review

---

#### NAT-S03: Widget views must be cheap

**Scope:** `apps/mobile/targets/ios-widget/**`, `native/apple/**/Widget*.swift`
**Rule:** Widget view bodies must only read from `TimelineProvider` entries (which read from App Group `UserDefaults`) — never make network calls, read databases, or perform expensive computation in the view.
**Why:** WidgetKit has strict memory (30MB) and time (5s) limits. Heavy work in the view causes widgets to display "Unable to Load." ([ADR-017](./decisions/017-ios-widget-architecture.md))

```swift
// Bad — network call in widget view
struct GoalWidgetView: View {
    var body: some View {
        // This will timeout and show "Unable to Load"
        let goal = try await fetchGoalFromAPI()
        Text("\(goal.progress)%")
    }
}

// Good — read from pre-computed UserDefaults
struct GoalWidgetView: View {
    let entry: GoalEntry // provided by TimelineProvider
    var body: some View {
        Text("\(entry.progressPercent)%")
    }
}
```

**Enforced by:** Code review

---

#### NAT-S04: WidgetKeys constants match TS and Swift

**Scope:** `packages/state/src/widget-keys.ts`, `apps/mobile/targets/ios-widget/WidgetKeys.swift`
**Rule:** The `WidgetKeys` constants (UserDefaults key names) must be defined identically in both TypeScript and Swift files. Any key added, renamed, or removed in one file must be mirrored in the other.
**Why:** TypeScript writes to UserDefaults and Swift reads from it. A key mismatch means the widget silently shows stale or zero data. ([ADR-017](./decisions/017-ios-widget-architecture.md))

```typescript
// packages/state/src/widget-keys.ts
export const WidgetKeys = {
  goalProgress: 'pomofocus.widget.goalProgress',
  weeklyDots: 'pomofocus.widget.weeklyDots',
  streak: 'pomofocus.widget.streak',
  completionRate: 'pomofocus.widget.completionRate',
} as const;
```

```swift
// apps/mobile/targets/ios-widget/WidgetKeys.swift
enum WidgetKeys {
    static let goalProgress = "pomofocus.widget.goalProgress"
    static let weeklyDots = "pomofocus.widget.weeklyDots"
    static let streak = "pomofocus.widget.streak"
    static let completionRate = "pomofocus.widget.completionRate"
}
```

**Enforced by:** `/align-repo` skill (checks for drift between the two files)

---

#### NAT-S05: AppIntentConfiguration for widgets

**Scope:** `apps/mobile/targets/ios-widget/**`
**Rule:** Use `AppIntentConfiguration` (iOS 17+) for widget configuration — never the legacy `IntentConfiguration` or `StaticConfiguration`.
**Why:** `AppIntentConfiguration` enables users to choose which stat to display per widget instance (goal progress, streak, etc.) using the modern App Intents framework. Legacy APIs are deprecated. ([ADR-017](./decisions/017-ios-widget-architecture.md))

**Enforced by:** Code review + minimum deployment target iOS 17

---

### 4b. Firmware — C++/Arduino on nRF52840

---

#### NAT-F01: Zero dynamic allocation

**Scope:** `firmware/device/**`
**Rule:** Never use `malloc`, `calloc`, `realloc`, `free`, `new`, `delete`, `String`, `std::string`, `std::vector`, or any other dynamic allocation. Use fixed-size arrays, static buffers, and stack allocation only.
**Why:** The nRF52840 has 256KB RAM shared with the BLE SoftDevice. Dynamic allocation causes heap fragmentation that eventually crashes the device with no debugger attached — impossible to diagnose in the field. ([ADR-015](./decisions/015-device-firmware-toolchain.md))

```cpp
// Bad
String sessionJson = "{\"id\":\"" + String(sessionId) + "\"}";
std::vector<uint8_t> buffer;
auto* data = new SessionData();

// Good
static uint8_t buffer[256]; // fixed-size, allocated at compile time
static char sessionId[37];  // UUID is 36 chars + null
constexpr size_t MAX_SESSIONS = 2500;
static SessionData sessions[MAX_SESSIONS];
```

**Enforced by:** Compiler warnings (`-Wno-psabi`) + code review + `nm` binary analysis (check for malloc/free symbols)

---

#### NAT-F02: Nanopb `.options` with size limits

**Scope:** `firmware/device/`, `packages/ble-protocol/proto/*.options`
**Rule:** Every Protobuf field that contains variable-length data (strings, bytes, repeated) must have a `max_size` or `max_count` specified in the Nanopb `.options` file.
**Why:** Without size limits, Nanopb falls back to dynamic allocation (which we ban via NAT-F01). The `.options` file tells Nanopb to generate static buffers. ([ADR-015](./decisions/015-device-firmware-toolchain.md))

```protobuf
// packages/ble-protocol/proto/pomofocus.proto
message SessionData {
  string id = 1;
  string intention = 2;
}
```

```
# packages/ble-protocol/proto/pomofocus.options
SessionData.id max_size:37
SessionData.intention max_size:201
```

**Enforced by:** Code review + Nanopb compilation failure (if max_size missing with `PB_NO_ERRMSG` defined)

---

#### NAT-F03: `constexpr` for constants

**Scope:** `firmware/device/**`
**Rule:** Use `constexpr` for all compile-time constants. Never use `#define` for values that have a type.
**Why:** `#define` has no type checking, no scope, and can cause subtle macro expansion bugs. `constexpr` is type-safe, scoped, and debuggable.

```cpp
// Bad
#define WORK_DURATION_MS 1500000
#define MAX_SESSIONS 2500
#define DEVICE_NAME "PomoFocus"

// Good
constexpr uint32_t WORK_DURATION_MS = 1500000;
constexpr size_t MAX_SESSIONS = 2500;
constexpr char DEVICE_NAME[] = "PomoFocus";
```

**Enforced by:** Code review

---

#### NAT-F04: Timer FSM mirrors TypeScript FSM

**Scope:** `firmware/device/src/timer/`
**Rule:** The firmware timer FSM must be a direct port of `packages/core/src/timer/machine.ts` — same states, same events, same transition table. Any change to the TS FSM must be mirrored in C++.
**Why:** The device must behave identically to the phone app. Divergent FSMs mean the timer shows different states on device vs. phone after BLE sync. ([ADR-004](./decisions/004-timer-state-machine.md), [ADR-015](./decisions/015-device-firmware-toolchain.md))

```cpp
// firmware/device/src/timer/machine.cpp
TimerState transition(TimerState state, TimerEvent event) {
    switch (state.status) {
        case TimerStatus::Idle:
            if (event.type == EventType::Start) {
                return { TimerStatus::Focusing, event.now, state.duration };
            }
            return state;
        // ... same exhaustive switch as TypeScript version
    }
}
```

**Enforced by:** Code review + parallel test suites (same test cases in Vitest and PlatformIO test)

---

#### NAT-F05: System ON sleep only

**Scope:** `firmware/device/**`
**Rule:** Use System ON sleep mode with `sd_app_evt_wait()` — never System OFF (`sd_power_system_off()`).
**Why:** System OFF saves ~3μA but kills BLE discoverability. The phone can't find the device to sync. System ON keeps BLE advertising active (~22μA) while the MCU idles (~5μA). Combined ~27μA gives ~8 week battery life on 1200mAh. ([ADR-015](./decisions/015-device-firmware-toolchain.md))

```cpp
// Bad
void enterSleep() {
    sd_power_system_off(); // kills BLE, phone can't find us!
}

// Good
void loop() {
    // When idle, let SoftDevice handle BLE while MCU sleeps
    sd_app_evt_wait(); // wakes on BLE event or GPIO interrupt
}
```

**Enforced by:** Code review

---

#### NAT-F06: PlatformIO standard layout

**Scope:** `firmware/device/`
**Rule:** Follow PlatformIO's standard directory layout: `src/` for application code, `include/` for headers, `lib/` for project-local libraries, `test/` for unit tests.
**Why:** PlatformIO's build system expects this layout. Non-standard paths cause compilation failures or files being silently excluded from builds. ([ADR-015](./decisions/015-device-firmware-toolchain.md))

```
firmware/device/
├── platformio.ini
├── src/
│   ├── main.cpp
│   ├── timer/machine.cpp
│   ├── display/renderer.cpp
│   └── ble/service.cpp
├── include/
│   ├── timer/machine.h
│   └── config.h
├── lib/
│   └── (project-local libs)
└── test/
    └── test_timer/test_main.cpp
```

**Enforced by:** PlatformIO build system (`pio run`)

---

#### NAT-F07: NOTIFY for frequent, INDICATE for critical

**Scope:** `firmware/device/src/ble/`
**Rule:** Use BLE NOTIFY for frequently-updated characteristics (timer state, battery level). Use INDICATE only for critical operations that require acknowledgment (session sync completion, firmware update).
**Why:** NOTIFY is fire-and-forget (fast, low overhead). INDICATE requires ACK from the central (adds latency). Using INDICATE for timer ticks would bottleneck the BLE link at ~10 updates/second. ([ADR-013](./decisions/013-ble-gatt-protocol-design.md))

**Enforced by:** Code review

---

## 5. Testing Rules

---

### TST-001: Tests first

**Scope:** All new code
**Rule:** Write the test before or alongside the implementation — never ship code without a corresponding test file. For `packages/core/`, this is non-negotiable (100% coverage).
**Why:** Without tests, agents cannot self-correct. Every agent workflow breaks down on codebases without tests. Tests are the agent's feedback loop.

**Enforced by:** CI coverage thresholds + code review

---

### TST-002: Test queries by user visibility

**Scope:** All React component tests
**Rule:** Query elements in this priority order: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`. Use `getByTestId` only as a last resort.
**Why:** Tests that query by role or text mirror how users interact with the UI. Tests that query by `data-testid` are coupled to implementation and don't catch accessibility regressions.

```typescript
// Bad — coupled to implementation
const button = screen.getByTestId('start-button');

// Good — mirrors user interaction
const button = screen.getByRole('button', { name: /start/i });
```

**Enforced by:** `testing-library/prefer-role-queries`, `testing-library/prefer-screen-queries`

---

### TST-003: Integration tests for React components

**Scope:** All React component tests
**Rule:** Prefer fewer, longer integration tests that test a user flow (render → interact → assert) over many isolated unit tests for individual components.
**Why:** Unit tests for components often test implementation details (does this hook get called?). Integration tests catch the bugs users actually hit (does clicking Start begin the timer?).

```typescript
// Bad — unit test for internal hook
it('calls useTimerStore on mount', () => {
  const spy = vi.spyOn(useTimerStore, 'getState');
  render(<TimerPage />);
  expect(spy).toHaveBeenCalled();
});

// Good — integration test for user flow
it('starts a focus session when user clicks Start', async () => {
  render(<TimerPage />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  expect(screen.getByText(/focusing/i)).toBeInTheDocument();
  expect(screen.getByText(/25:00/)).toBeInTheDocument();
});
```

**Enforced by:** Code review

---

### TST-004: Pure functions tested with input → output

**Scope:** `packages/core/**`, `packages/analytics/**`
**Rule:** Test pure functions by asserting `expect(fn(input)).toEqual(expectedOutput)` — no mocks, no setup, no teardown.
**Why:** Pure functions in core and analytics are the easiest code to test. Mocking is never needed because they have no side effects. If you find yourself mocking inside core, the function isn't pure and violates PKG-C01/PKG-A01.

```typescript
// Bad — mocking in a core test (means the function isn't pure)
vi.mock('@supabase/supabase-js');
const result = await fetchAndComputeStreak(userId);

// Good — pure input/output
const sessions = [
  { completedAt: '2026-03-08T10:00:00Z', /* ... */ },
  { completedAt: '2026-03-09T10:00:00Z', /* ... */ },
];
expect(computeStreak(sessions, 'America/New_York')).toBe(2);
```

**Enforced by:** Code review (if you see `vi.mock` in `packages/core/` tests, the architecture is wrong)

---

### TST-005: Every test must be able to fail

**Scope:** All tests
**Rule:** After writing a test, temporarily break the code under test and verify the test fails. A test that always passes is useless.
**Why:** Common mistake: testing a mock instead of the real code, or writing an assertion that's always true. Verifying failure catches these immediately.

**Enforced by:** Code review discipline

---

### TST-006: Co-locate test files

**Scope:** All TypeScript tests
**Rule:** Test files live next to their source file with a `.test.ts` suffix: `machine.ts` → `machine.test.ts`. No separate `__tests__/` directories, no `test/` root folder for unit tests.
**Why:** Co-location makes it obvious when a file is untested (no `.test.ts` sibling). It also simplifies imports — tests import with relative `./` paths.

```
# Bad
packages/core/src/timer/machine.ts
packages/core/test/timer/machine.test.ts  # far away, easy to forget

# Good
packages/core/src/timer/machine.ts
packages/core/src/timer/machine.test.ts   # right next to the source
```

**Enforced by:** Vitest `include` pattern: `**/*.test.ts`

---

## 6. Database & Migration Rules

All rules apply to Supabase Postgres schema and migrations. Conventions from [ADR-005](./decisions/005-database-schema-data-model.md).

---

### DB-001: Always `timestamptz`

**Scope:** All SQL migrations
**Rule:** Use `timestamptz` for every timestamp column — never bare `timestamp` or `timestamp without time zone`.
**Why:** `timestamp` silently drops timezone information. When users in different timezones create sessions, you get ambiguous timestamps that make analytics, streak calculations, and sync all produce wrong results. ([ADR-005](./decisions/005-database-schema-data-model.md))

```sql
-- Bad
CREATE TABLE sessions (
  created_at timestamp DEFAULT now()  -- timezone-naive!
);

-- Good
CREATE TABLE sessions (
  created_at timestamptz DEFAULT now()
);
```

**Enforced by:** Migration review + custom lint script (`grep -r 'timestamp ' --include='*.sql'` should only match `timestamptz`)

---

### DB-002: UUID primary keys with default

**Scope:** All SQL migrations
**Rule:** All primary keys are `uuid` type with `gen_random_uuid()` as the default — never serial/bigserial, never application-generated IDs without a server default.
**Why:** UUIDs enable client-generated IDs for offline-first sync (ADR-006). The server default ensures IDs exist even if the client doesn't send one. Serial IDs are sequential and leak information about table size. ([ADR-005](./decisions/005-database-schema-data-model.md), [ADR-006](./decisions/006-offline-first-sync-architecture.md))

```sql
-- Bad
CREATE TABLE sessions (
  id serial PRIMARY KEY
);

-- Good
CREATE TABLE sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY
);
```

**Enforced by:** Migration review

---

### DB-003: Postgres ENUM types for fixed values

**Scope:** All SQL migrations
**Rule:** Use Postgres `CREATE TYPE ... AS ENUM` for fixed domain values (timer_status, goal_category, distraction_type). Never store enum values as plain `text`.
**Why:** `text` columns accept any string — a typo like `'focussing'` instead of `'focusing'` silently corrupts data. ENUM types enforce valid values at the database level. ([ADR-005](./decisions/005-database-schema-data-model.md))

```sql
-- Bad
CREATE TABLE sessions (
  status text NOT NULL  -- accepts 'anything'!
);

-- Good
CREATE TYPE timer_status AS ENUM ('idle', 'focusing', 'break', 'paused', 'completed', 'abandoned');
CREATE TABLE sessions (
  status timer_status NOT NULL
);
```

**Enforced by:** Migration review

---

### DB-004: Hard deletes only

**Scope:** All SQL migrations
**Rule:** Use hard `DELETE` — never add a `deleted_at` column or implement soft deletes unless explicitly approved.
**Why:** Soft deletes leak "deleted" data in queries (every query needs `WHERE deleted_at IS NULL`), break RLS assumptions, complicate GDPR compliance (`DELETE /v1/me` must actually delete), and add complexity for zero benefit in a Pomodoro app. ([ADR-005](./decisions/005-database-schema-data-model.md), [ADR-012](./decisions/012-security-data-privacy.md))

```sql
-- Bad
ALTER TABLE sessions ADD COLUMN deleted_at timestamptz;

-- Good
-- Just use DELETE FROM sessions WHERE id = $1;
-- GDPR: DELETE cascades via ON DELETE CASCADE on foreign keys
```

**Enforced by:** Migration review

---

### DB-005: RLS on every table

**Scope:** All SQL migrations
**Rule:** Every table must have Row Level Security enabled and at least one policy using the `get_user_id()` helper function — never inline `auth.uid()` lookups.
**Why:** A table without RLS is readable/writable by any authenticated user. One missing policy = full data breach for that table. The `get_user_id()` helper decouples RLS from `auth.uid()` internals. ([ADR-005](./decisions/005-database-schema-data-model.md), [ADR-012](./decisions/012-security-data-privacy.md))

```sql
-- Bad — no RLS, or inlined auth lookup
CREATE TABLE sessions ( /* ... */ );
-- Table is now wide open!

-- Also bad — inlined auth lookup
CREATE POLICY "own_sessions" ON sessions
  USING (user_id = (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- Good
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions" ON sessions
  TO authenticated
  USING (user_id = get_user_id());
```

**Enforced by:** Migration review + CI check (every `CREATE TABLE` must have matching `ENABLE ROW LEVEL SECURITY`)

---

### DB-006: RLS policy best practices

**Scope:** All SQL migrations
**Rule:** RLS policies must (a) include `TO authenticated` to block anon access, and (b) wrap `auth.uid()` (or `get_user_id()`) in a `(SELECT ...)` subquery for performance.
**Why:** (a) Without `TO authenticated`, the `anon` role bypasses your policy. (b) Without `(SELECT ...)`, Postgres evaluates `auth.uid()` per-row instead of once per query, causing 10-100x slowdown on large tables.

```sql
-- Bad — missing TO authenticated, no subquery wrapper
CREATE POLICY "own_sessions" ON sessions
  USING (user_id = get_user_id());

-- Good
CREATE POLICY "own_sessions" ON sessions
  TO authenticated
  USING (user_id = (SELECT get_user_id()));
```

**Enforced by:** Migration review

---

### DB-007: One migration per change

**Scope:** All database changes
**Rule:** Every schema change gets its own migration file via `supabase migration new <name>`. Never apply DDL directly via the SQL editor.
**Why:** Direct DDL changes don't create migration files, so they can't be reproduced in CI, other developers' environments, or staging. Migrations are the source of truth for schema history. ([ADR-005](./decisions/005-database-schema-data-model.md))

```bash
# Bad
# Open Supabase dashboard → SQL editor → run ALTER TABLE

# Good
supabase migration new add_reflection_columns
# Edit supabase/migrations/<timestamp>_add_reflection_columns.sql
# Commit the migration file
```

**Enforced by:** CI migration validation in `supabase.yml` workflow

---

### DB-008: Regenerate types after every schema change

**Scope:** `packages/types/`, `native/apple/shared/`
**Rule:** After committing any migration, regenerate TypeScript and Swift types. This is the same as PKG-T02 but emphasized here because it's the most commonly forgotten step.
**Why:** Stale types cause runtime errors that should be compile-time errors.

**Enforced by:** CI type-drift detection

---

### DB-009: Index RLS policy columns

**Scope:** All SQL migrations
**Rule:** Every column referenced in an RLS policy condition must have an index. Use BRIN indexes for `created_at` columns (10x smaller than B-tree for append-only timestamp data).
**Why:** RLS policies run as implicit `WHERE` clauses. Without indexes, every query on a large table does a full table scan through the policy check.

```sql
-- Bad — RLS on user_id but no index
CREATE POLICY "own_sessions" ON sessions
  TO authenticated
  USING (user_id = (SELECT get_user_id()));
-- Full table scan on every query!

-- Good
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions USING BRIN(created_at);
```

**Enforced by:** Migration review

---

### DB-010: Never use `user_metadata` in RLS

**Scope:** All SQL migrations
**Rule:** Never reference `auth.jwt() -> 'user_metadata'` in RLS policies.
**Why:** `user_metadata` is writable by the user via the Supabase Auth API. An attacker can modify their own metadata to bypass RLS policies that trust it.

```sql
-- Bad — user can set their own role in metadata
CREATE POLICY "admin_only" ON admin_settings
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Good — use a separate, server-controlled column
CREATE POLICY "admin_only" ON admin_settings
  USING (user_id IN (SELECT id FROM admins));
```

**Enforced by:** Migration review

---

### DB-011: Client-side filters with RLS

**Scope:** `packages/data-access/**`, `apps/api/**`
**Rule:** Always add explicit `.eq()` / `WHERE` filters in queries even though RLS exists. Never rely on RLS as the sole filter.
**Why:** RLS is defense-in-depth, not a query optimizer. Without client-side filters, Postgres fetches all rows then filters by RLS — O(n) scan instead of O(1) index lookup. ([ADR-005](./decisions/005-database-schema-data-model.md))

```typescript
// Bad — relies on RLS to filter (full table scan through policy)
const { data } = await supabase.from('sessions').select('*');

// Good — explicit filter + RLS as safety net
const { data } = await supabase
  .from('sessions')
  .select('*')
  .eq('user_id', userId);
```

**Enforced by:** Code review

---

## 7. API Rules

Rules for the Hono REST API on Cloudflare Workers (`apps/api/`). Conventions from [ADR-007](./decisions/007-api-architecture.md).

---

### API-001: Every route uses `createRoute` + Zod

**Scope:** `apps/api/**`
**Rule:** Every API route must be defined using `@hono/zod-openapi`'s `createRoute` with Zod schemas for request params, body, and response. No untyped route handlers.
**Why:** `createRoute` validates requests at runtime AND generates the OpenAPI spec that the TS and Swift clients are generated from. An untyped route breaks the entire client generation pipeline. ([ADR-007](./decisions/007-api-architecture.md))

```typescript
// Bad — untyped handler
app.get('/v1/sessions', async (c) => {
  const sessions = await db.from('sessions').select();
  return c.json(sessions);
});

// Good — typed with createRoute
const getSessionsRoute = createRoute({
  method: 'get',
  path: '/v1/sessions',
  responses: {
    200: { content: { 'application/json': { schema: SessionListSchema } } },
  },
});

app.openapi(getSessionsRoute, async (c) => {
  const sessions = await db.from('sessions').select();
  return c.json(sessions, 200);
});
```

**Enforced by:** TypeScript type system (Hono's type inference errors on schema mismatch) + code review

---

### API-002: Global `defaultHook` for validation errors

**Scope:** `apps/api/src/app.ts`
**Rule:** Configure a global `defaultHook` on the OpenAPI Hono app that returns a consistent 422 JSON response for validation failures.
**Why:** Without a defaultHook, Zod validation errors return raw error objects that vary between routes — clients can't reliably parse error responses.

```typescript
// Good — apps/api/src/app.ts
const app = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: 'Validation failed', details: result.error.flatten() },
        422
      );
    }
  },
});
```

**Enforced by:** Code review

---

### API-003: Global `onError` for structured errors

**Scope:** `apps/api/src/app.ts`
**Rule:** Configure a global `app.onError` handler that catches all unhandled errors and returns a structured JSON response — never let CF Workers return raw error text.
**Why:** Raw error messages expose internal implementation details (file paths, query text, stack traces) to clients.

```typescript
// Good — apps/api/src/app.ts
app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: 'Internal server error', requestId: c.get('requestId') },
    500
  );
});
```

**Enforced by:** Code review + integration test (verify 500 response shape)

---

### API-004: No expensive work in global scope

**Scope:** `apps/api/src/**`
**Rule:** Never perform expensive operations (database connections, file reads, heavy computation) at the module's top level. CF Workers have a 1-second startup limit for the global scope.
**Why:** CF Workers execute the global scope on cold start. Expensive work there causes cold start timeouts, returning 503 to the user.

```typescript
// Bad — top-level DB connection (runs on every cold start)
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
export default { fetch: app.fetch };

// Good — create client per-request using env bindings
app.use('*', async (c, next) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  c.set('supabase', supabase);
  await next();
});
```

**Enforced by:** Code review + CF Workers deployment (will error on timeout)

---

### API-005: Forward user JWT, service_role for admin only

**Scope:** `apps/api/src/middleware/`, `apps/api/src/routes/`
**Rule:** For user-scoped operations, create the Supabase client with the user's JWT (so RLS applies). Use `service_role` key only for admin operations (`DELETE /v1/me`, aggregations across users).
**Why:** If all requests use `service_role`, RLS is bypassed — a single API bug exposes all users' data. User JWT ensures RLS is active as defense-in-depth. ([ADR-007](./decisions/007-api-architecture.md), [ADR-012](./decisions/012-security-data-privacy.md))

```typescript
// Bad — service_role for everything (bypasses RLS)
const supabase = createClient(url, serviceRoleKey);
const { data } = await supabase.from('sessions').select();
// Returns ALL users' sessions!

// Good — user JWT for user-scoped operations
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${userJwt}` } },
});
const { data } = await supabase.from('sessions').select();
// RLS filters to current user's sessions only
```

**Enforced by:** Code review + integration tests verifying cross-user data isolation

---

### API-006: Serve OpenAPI spec at `/openapi.json`

**Scope:** `apps/api/src/app.ts`
**Rule:** The API must serve its OpenAPI 3.1 JSON spec at `GET /openapi.json`. This spec is the single source of truth for client generation.
**Why:** TypeScript clients (`openapi-fetch`) and Swift clients (`swift-openapi-generator`) are generated from this spec. If the spec isn't served, client generation breaks and types drift from the API. ([ADR-007](./decisions/007-api-architecture.md))

```typescript
// Good — apps/api/src/app.ts
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'PomoFocus API', version: 'v1' },
});
```

**Enforced by:** Integration test (`GET /openapi.json` returns valid JSON)

---

### API-007: Social endpoints enforce privacy via JOINs

**Scope:** `apps/api/src/routes/friends.ts`, `apps/api/src/routes/feed.ts`
**Rule:** Social data endpoints must enforce privacy by JOINing through the `friendships` table — never expose session data to non-friends, and never rely solely on RLS for social visibility.
**Why:** RLS policies are per-table. Social privacy requires cross-table logic (are these users friends?). The API enforces this with explicit JOINs. ([ADR-018](./decisions/018-social-features-architecture.md), [ADR-012](./decisions/012-security-data-privacy.md))

```sql
-- Bad — exposes all sessions, relies on client-side filtering
SELECT * FROM sessions WHERE user_id = $1;

-- Good — only returns data for confirmed friends
SELECT s.started_at, s.work_duration, s.ended_at
FROM sessions s
JOIN friendships f ON f.friend_id = s.user_id AND f.user_id = get_user_id()
WHERE s.ended_at IS NULL; -- only active sessions
```

**Enforced by:** Integration tests + code review

---

## 8. Common Anti-Patterns

Quick-reference "DO NOT" list. Each item references the detailed rule that explains why and shows the correct alternative.

---

### CRITICAL — Architecture corruption or security breach

| Anti-Pattern | Correct Alternative | Rule |
|---|---|---|
| Import `data-access` or `state` from `core/` | Core only imports from `types/` | PKG-C07 |
| Import `@supabase/supabase-js` in any client app for data | Use generated OpenAPI client via `data-access/` | APP-001, PKG-D02 |
| `setTimeout` / `setInterval` / `Date.now()` in `packages/core/` | Receive time as a function parameter | PKG-C04 |
| Add Supabase Realtime WebSocket subscription | Use TanStack Query polling (30s default) | APP-005 |
| Create a table without RLS | Always enable RLS + add `get_user_id()` policy | DB-005 |
| Use `timestamp` without timezone | Always `timestamptz` | DB-001 |
| `malloc` / `new` / `String` in firmware | Static buffers, fixed-size arrays | NAT-F01 |
| Use `any` type | Use `unknown`, Zod, or proper typing | U-001 |

### HIGH — Significant bugs or design violations

| Anti-Pattern | Correct Alternative | Rule |
|---|---|---|
| Compute analytics client-side | Call API endpoint, analytics are server-side | PKG-A01, PKG-A04 |
| Create a composite "Focus Score" | Individual metrics with trend arrows | PKG-A02 |
| Store server data in Zustand | TanStack Query owns all server state | PKG-S01 |
| Business logic in Zustand store | Delegate to `core/` pure functions | PKG-S02 |
| Edit auto-generated type files | Regenerate with `supabase gen types` or `protoc` | PKG-T01 |
| Add a 5th notification type | Exactly 4 types allowed (ADR-019) | [ADR-019](./decisions/019-notification-strategy.md) |
| Add background BLE sync for v1 | App-open sync only | [ADR-016](./decisions/016-ble-client-libraries-integration.md) |
| `useEffect` to derive state | Derive during render | PKG-S08 |
| API proxies auth flow | Clients call Supabase Auth directly | APP-006 |
| Skip `supabase gen types` after migration | Always regenerate types | PKG-T02, DB-008 |

### MEDIUM — Quality and consistency issues

| Anti-Pattern | Correct Alternative | Rule |
|---|---|---|
| TS `enum` keyword | `as const` objects + union types | U-010 |
| `as` type assertion | Type guards, Zod parsing, or narrowing | U-009 |
| Default exports | Named exports | U-002 |
| `FlatList` in React Native | `FlashList` | PKG-U03 |
| `staleTime` omitted on query | Always set explicit `staleTime` | PKG-S04 |
| `#define` for typed constants in firmware | `constexpr` | NAT-F03 |
| System OFF sleep in firmware | System ON with `sd_app_evt_wait()` | NAT-F05 |
| `getByTestId` as first choice in tests | `getByRole` > `getByText` > `getByTestId` | TST-002 |
| `user_metadata` in RLS policies | Server-controlled columns | DB-010 |
| Missing Nanopb `.options` for string fields | `max_size` on every variable-length field | NAT-F02 |

---

## Appendix: ADR Cross-Reference

Every rule traces to at least one ADR. This table shows which ADRs are referenced:

| ADR | Rules |
|-----|-------|
| [001 — Monorepo](./decisions/001-monorepo-package-structure.md) | PKG-C01–C07, PKG-A03, PKG-D04, PKG-U01–U02, PKG-B01, U-014 |
| [002 — Auth](./decisions/002-auth-architecture.md) | PKG-C03, PKG-C05, PKG-D01, APP-006 |
| [003 — State](./decisions/003-client-state-management.md) | PKG-S01–S08, APP-005 |
| [004 — Timer](./decisions/004-timer-state-machine.md) | U-008, PKG-C04, PKG-C06, PKG-C08, NAT-F04 |
| [005 — Database](./decisions/005-database-schema-data-model.md) | PKG-T01–T02, DB-001–DB-011 |
| [006 — Sync](./decisions/006-offline-first-sync-architecture.md) | PKG-C06, PKG-D03, DB-002 |
| [007 — API](./decisions/007-api-architecture.md) | PKG-D02, APP-001–002, APP-006, API-001–007 |
| [008 — Long-Lived Processes](./decisions/008-long-lived-processes.md) | API-004 (CF Workers constraints) |
| [009 — CI/CD](./decisions/009-ci-cd-pipeline-design.md) | PKG-T02 |
| [010 — Hardware Platform](./decisions/010-physical-device-hardware-platform.md) | NAT-F01 (nRF52840 RAM constraints) |
| [011 — Observability](./decisions/011-monitoring-observability.md) | APP-003 |
| [012 — Security](./decisions/012-security-data-privacy.md) | APP-002, APP-004, API-005, API-007, DB-005 |
| [013 — BLE GATT](./decisions/013-ble-gatt-protocol-design.md) | PKG-T03, PKG-B02, NAT-F07 |
| [014 — Analytics](./decisions/014-analytics-insights-architecture.md) | PKG-A01–A04 |
| [015 — Firmware](./decisions/015-device-firmware-toolchain.md) | NAT-F01–F06 |
| [016 — BLE Clients](./decisions/016-ble-client-libraries-integration.md) | PKG-B01–B03 |
| [017 — iOS Widget](./decisions/017-ios-widget-architecture.md) | NAT-S03–S05 |
| [018 — Social](./decisions/018-social-features-architecture.md) | API-007 |
| [019 — Notifications](./decisions/019-notification-strategy.md) | Anti-pattern: 5th notification type |
