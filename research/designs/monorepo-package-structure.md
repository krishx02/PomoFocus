# Design: Monorepo Package Structure

**Date:** 2026-03-06
**Status:** Accepted
**Related ADR:** [ADR-001](../decisions/001-monorepo-package-structure.md)
**Platforms:** All — iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context & Scope

PomoFocus is a multi-platform Pomodoro productivity app built from a single Nx + pnpm monorepo. The monorepo contains TypeScript packages (shared logic, UI, data access), runnable apps (Next.js, Expo, VS Code extension, MCP server), native Apple code (SwiftUI for widgets and watchOS), and ESP32 firmware (C++). This design defines the folder structure, package boundaries, dependency graph, type generation strategy, and Nx module boundary enforcement.

## Goals & Non-Goals

**Goals:**
- Define clear package boundaries with one responsibility per package
- Enforce dependency direction via Nx tags so packages never import "upward"
- Eliminate manual cross-language type sync between TypeScript, Swift, and C++
- Support all 9 target platforms with appropriate code sharing
- Keep the number of packages manageable for a solo developer

**Non-Goals:**
- Defining the internal file structure within each package (deferred to implementation)
- Choosing specific libraries for state management, UI framework, etc. (separate /tech-design sessions)
- Setting up CI/CD pipelines (separate decision)
- Defining the database schema (separate /tech-design session)

## The Design

### Folder Structure

```
pomofocus/
├── packages/                    # Shared TypeScript packages
│   ├── types/                   # Contracts — shared TS types, enums, constants
│   │   ├── src/
│   │   │   ├── database.ts      # AUTO-GENERATED: supabase gen types --lang typescript
│   │   │   ├── domain.ts        # Re-exports from database.ts + any TS-only types
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/types
│   │   └── project.json         # tags: ["type:types", "scope:shared"]
│   │
│   ├── core/                    # Domain — timer state machine, goal model, session logic
│   │   ├── src/
│   │   │   ├── timer/           # Timer reducer, state transitions
│   │   │   ├── goals/           # Three-layer goal model logic
│   │   │   ├── sessions/        # Session recording, completion, reflection
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/core — depends on @pomofocus/types
│   │   └── project.json         # tags: ["type:domain", "scope:shared"]
│   │
│   ├── analytics/               # Domain — Focus Score, insights computation
│   │   ├── src/
│   │   │   ├── focus-score.ts   # Focus Score formula
│   │   │   ├── insights.ts      # Weekly/monthly insight generators
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/analytics — depends on @pomofocus/types, @pomofocus/core
│   │   └── project.json         # tags: ["type:domain", "scope:shared"]
│   │
│   ├── data-access/             # Data layer — Supabase queries, sync, auth
│   │   ├── src/
│   │   │   ├── client.ts        # Supabase client initialization
│   │   │   ├── sessions.ts      # Session CRUD queries
│   │   │   ├── goals.ts         # Goal CRUD queries
│   │   │   ├── auth.ts          # Auth helpers (login, signup, deferred auth)
│   │   │   ├── sync.ts          # Real-time subscription wrappers
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/data-access — depends on @pomofocus/types, @pomofocus/core
│   │   └── project.json         # tags: ["type:data-access", "scope:shared"]
│   │
│   ├── ui/                      # Presentation — shared React/RN components
│   │   ├── src/
│   │   │   ├── timer-display/
│   │   │   ├── goal-card/
│   │   │   ├── session-summary/
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/ui — depends on @pomofocus/types
│   │   └── project.json         # tags: ["type:ui", "scope:shared"]
│   │
│   ├── state/                   # State — Zustand stores + TanStack Query hooks
│   │   ├── src/
│   │   │   ├── stores/
│   │   │   │   ├── timer-store.ts    # Zustand store wrapping @pomofocus/core timer
│   │   │   │   └── ui-store.ts       # Shared UI state (active view, etc.)
│   │   │   ├── queries/
│   │   │   │   ├── use-sessions.ts   # TanStack Query hooks wrapping @pomofocus/data-access
│   │   │   │   ├── use-goals.ts
│   │   │   │   └── query-client.ts   # Shared QueryClient config (30s staleTime/refetchInterval)
│   │   │   ├── persistence/
│   │   │   │   ├── types.ts          # PersistenceAdapter interface
│   │   │   │   ├── mmkv-adapter.ts   # For Expo mobile
│   │   │   │   └── local-storage-adapter.ts  # For Next.js web
│   │   │   └── index.ts
│   │   ├── package.json         # @pomofocus/state — depends on @pomofocus/types, @pomofocus/core, @pomofocus/data-access
│   │   └── project.json         # tags: ["type:state", "scope:shared"]
│   │
│   └── ble-protocol/            # Infrastructure — BLE GATT profile, data encoding
│       ├── proto/
│       │   └── pomofocus.proto  # SOURCE OF TRUTH for BLE message types
│       ├── src/
│       │   ├── generated/       # AUTO-GENERATED: protoc --ts_out
│       │   ├── gatt-profile.ts  # Service/characteristic UUID constants
│       │   ├── connection.ts    # BLE connection management
│       │   └── index.ts
│       ├── package.json         # @pomofocus/ble-protocol — depends on @pomofocus/types
│       └── project.json         # tags: ["type:infra", "scope:shared"]
│
├── apps/                        # Runnable applications
│   ├── web/                     # Next.js web app
│   │   ├── package.json         # depends on: types, core, analytics, data-access, state, ui
│   │   └── project.json         # tags: ["type:app", "scope:web"]
│   │
│   ├── mobile/                  # Expo / React Native (iOS + Android)
│   │   ├── package.json         # depends on: types, core, analytics, data-access, state, ui, ble-protocol
│   │   └── project.json         # tags: ["type:app", "scope:mobile"]
│   │
│   ├── vscode/                  # VS Code extension
│   │   ├── package.json         # depends on: types, core, data-access, state, ui
│   │   └── project.json         # tags: ["type:app", "scope:vscode"]
│   │
│   └── mcp-server/              # Claude Code MCP server (placeholder)
│       ├── package.json         # depends on: types, core, data-access
│       └── project.json         # tags: ["type:app", "scope:mcp"]
│
├── native/                      # Native Apple code (SwiftUI, managed by Xcode)
│   ├── shared/
│   │   ├── DatabaseTypes.swift  # AUTO-GENERATED: supabase gen types --lang swift
│   │   └── BLETypes.swift       # AUTO-GENERATED: protoc --swift_out
│   ├── ios-widget/              # SwiftUI + WidgetKit (iOS 17+)
│   ├── mac-widget/              # SwiftUI + MenuBarExtra
│   └── watchos/                 # SwiftUI + WatchKit (watchOS 10+)
│
├── firmware/                    # ESP32 device firmware
│   └── device/
│       ├── src/
│       │   ├── generated/       # AUTO-GENERATED: protoc --cpp_out (BLE types)
│       │   ├── main.cpp
│       │   ├── timer.cpp
│       │   ├── display.cpp
│       │   └── ble.cpp
│       └── platformio.ini
│
├── nx.json                      # Nx workspace configuration
├── pnpm-workspace.yaml          # pnpm workspace definition
├── package.json                 # Root package.json
├── tsconfig.base.json           # Shared TypeScript configuration
└── .eslintrc.json               # Module boundary rules
```

### Dependency Graph

```
                    @pomofocus/types
                   (zero deps, auto-generated from Postgres)
                          │
              ┌───────────┼───────────────┐
              │           │               │
       @pomofocus/core    │        @pomofocus/ui
       (types only)       │        (types only)
              │           │               │
     ┌────────┤           │               │
     │        │           │               │
@pomofocus/ @pomofocus/   │               │
analytics  data-access    │               │
(types,    (types,core)   │               │
 core)          │         │               │
     │          │    @pomofocus/           │
     │          │    ble-protocol          │
     │          │    (types only)          │
     │          │         │               │
     └────┬─────┴─────────┘               │
          │                               │
   @pomofocus/state                       │
   (core, data-access, types)             │
   Zustand stores + TanStack Query hooks  │
          │                               │
     ┌────┴───────────────────────────────┘
     │
    ┌┴───────────────────────┐
    │         apps/          │
    │  web, mobile, vscode,  │
    │  mcp-server            │
    └────────────────────────┘
```

**Key rule:** Arrows point upward only. No package imports from a package below it. Apps are the only "wiring" layer that connects everything. Note: `mcp-server` does not depend on `state/` — it uses `core/` and `data-access/` directly (no React).

### Nx Module Boundary Tags

Two dimensions: **type** (architectural layer) and **scope** (platform/domain).

**Type tags and dependency rules:**

| Source Tag | Can Depend On |
|---|---|
| `type:app` | `type:state`, `type:domain`, `type:data-access`, `type:ui`, `type:infra`, `type:types` |
| `type:state` | `type:domain`, `type:data-access`, `type:types` |
| `type:domain` | `type:domain`, `type:types` |
| `type:data-access` | `type:domain`, `type:types` |
| `type:ui` | `type:types` |
| `type:infra` | `type:types` |
| `type:types` | (nothing — leaf node) |

**Scope tags and dependency rules:**

| Source Tag | Can Depend On |
|---|---|
| `scope:web` | `scope:shared` |
| `scope:mobile` | `scope:shared` |
| `scope:vscode` | `scope:shared` |
| `scope:mcp` | `scope:shared` |
| `scope:shared` | `scope:shared` |

### Cross-Language Type Generation

**Source of truth: Postgres schema → TypeScript + Swift**

```bash
# Run in CI or on schema change
supabase gen types --lang typescript --project-id $PROJECT_ID > packages/types/src/database.ts
supabase gen types --lang swift --swift-access-control public --project-id $PROJECT_ID > native/shared/DatabaseTypes.swift
```

**Source of truth: Protobuf → TypeScript + Swift + C++**

```bash
# Run in CI or on proto change
protoc --ts_out=packages/ble-protocol/src/generated \
       --swift_out=native/shared \
       --cpp_out=firmware/device/src/generated \
       packages/ble-protocol/proto/pomofocus.proto
```

**Result:** Zero manual cross-language type maintenance. CI enforces sync.

### Package Responsibilities

| Package | Imports | Exports | Key Principle |
|---|---|---|---|
| `@pomofocus/types` | Nothing | TS interfaces, enums, constants | Auto-generated from Postgres. No logic. |
| `@pomofocus/core` | `types` | Timer reducer, goal model, session logic | Pure functions. No IO, no React, no Supabase. |
| `@pomofocus/analytics` | `types`, `core` | Focus Score, insights | Read-only consumer of core types. Pure computation. |
| `@pomofocus/data-access` | `types`, `core` | Supabase CRUD, auth, sync | All IO lives here. Core never knows about Supabase. |
| `@pomofocus/state` | `types`, `core`, `data-access` | Zustand stores, TanStack Query hooks | React state wiring. Thin wrapper around core + data-access. See [ADR-003](../decisions/003-client-state-management.md). |
| `@pomofocus/ui` | `types` | React/RN components | Presentational. Props typed from types. No business logic. |
| `@pomofocus/ble-protocol` | `types` | BLE GATT profile, connection mgmt | Protocol definition from Protobuf. Only mobile + web consume. |

## Alternatives Considered

**Fat Core (3 packages):** Rejected because `core` would become a grab-bag with no clear internal boundaries. Nx affected detection would be too broad — any change rebuilds everything. Doesn't match the developer's preferred pattern of clean layer separation.

**Domain-Split (8 packages):** Rejected because timer/goals/sessions are tightly coupled (a session belongs to a goal and uses the timer). Splitting them into 3 separate packages creates circular dependency risk and cross-package import friction. The coupling is real and would violate the boundaries immediately. Also, 8 packages is more maintenance than a solo dev needs pre-code.

## Cross-Cutting Concerns

- **Security:** Package boundaries don't affect security directly. Auth logic lives in `data-access/` which wraps Supabase Auth. No package exposes credentials.
- **Cost:** No cost implications. Nx + pnpm is free. Type generation runs in existing CI.
- **Observability:** Each package can be independently versioned and its build/test times tracked by Nx's task runner. This will be useful for identifying packages that slow down CI.
- **Migration path:** If `core/` grows too large, split it into `timer/`, `goals/`, `sessions/` using Nx's `@nx/workspace:move` generator. Import paths update automatically. The `types/` package already exists as the shared interface layer, so the split is clean.

## Open Questions

1. **Should `ui/` use React Native Web for cross-platform components, or separate web and mobile component sets?** — Deferred to a UI framework /tech-design session.
2. **How does the iOS widget communicate with the Expo app via App Group?** — Deferred to the iOS Widget Architecture /tech-design session.
3. **What Protobuf message structures does the BLE protocol need?** — Deferred to the BLE Protocol /tech-design session.
