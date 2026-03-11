# PomoFocus MVP Roadmap

> **Version:** 1.1 | **Date:** 2026-03-11 | **Status:** Ready for issue decomposition
>
> This roadmap bridges "we have 19 ADRs and a product brief" to "we have hundreds of small, agent-ready GitHub issues." Every work item is concrete enough for a decomposition agent to produce issues with exact file paths, test commands, and acceptance criteria.

---

## Research Findings

Synthesis of 9 expert perspectives on MVP roadmapping and build-order planning. These principles directly informed the phase structure and sequencing below.

### 1. Boris Cherny — CLAUDE.md-Driven Development

"Anytime we see Claude do something incorrectly we add it to the CLAUDE.md, so Claude knows not to do it next time." Cherny runs 5 Claude instances in parallel, each on its own git checkout, yielding 20-30 PRs/day. Key insight: **"Give Claude a way to verify its work — browser testing, test suites, phone simulators. Verification 2-3x the quality of the final result."**

**Application:** Test/lint/type-check infrastructure must exist BEFORE agents can be productive. Each issue must be a single well-scoped task with a verification command. Repeatable workflows are encoded as slash commands (already done: `/ship-issue`, `/clarify`, etc.).

Sources: [How Boris Uses Claude Code](https://howborisusesclaudecode.com), [Pragmatic Engineer interview](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny), [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)

### 2. Ryan Singer / Shape Up — Fixed Time, Variable Scope

"An estimate is where you start with a design and say, 'How long will it take?' An appetite flips that — you start with a number and go to a design." The pitch has 5 ingredients: Problem, Appetite, Solution, Rabbit Holes, No-Gos. **Circuit breaker:** if a project doesn't ship in its allotted cycle, it doesn't automatically get an extension — "instead of investing more time in a bad approach, the circuit breaker pushes us to reframe the problem." **Scope hammering:** "we use an even stronger word — hammering — to reflect the power and force it takes to repeatedly bang the scope so it fits in the time box."

**Application:** Each phase has a fixed appetite. BLE/firmware gets an explicit 6-week circuit breaker. No-gos map to "out of scope" in agent-ready issues. Cool-down periods between phases for bug fixes and debt.

Sources: [Shape Up](https://basecamp.com/shapeup), [Lenny's Newsletter](https://www.lennysnewsletter.com/p/shape-up-ryan-singer)

### 3. Andrej Karpathy — From Vibe Coding to Org Engineering

"AI agents barely worked before December 2025, but since then they've become reliable." Karpathy coined "Org Engineering" (February 2026) — managing parallel AI coding agents as an organization where "prompts, roles, processes, tools, and workflows are the source code." He ran 8 agents (4 Claude, 4 Codex) each with its own GPU, demonstrating the concept.

**Application:** Structure work as "org engineering" — each phase produces issues that agents pick up in parallel. The developer's job: write the issue, provide context (CLAUDE.md, ADRs, design docs), let the agent run, review the output. Every task needs a verification loop.

Sources: [Karpathy's Org Engineering experiment](https://quasa.io/media/karpathy-s-experiment-assembling-an-ai-research-team-highlights-limitations-and-ushers-in-org-engineering), [The Decoder](https://the-decoder.com/andrej-karpathy-says-programming-is-unrecognizable-now-that-ai-agents-actually-work/)

### 4. Simon Willison — Red/Green TDD for Agents

"Use test driven development, write the tests first, confirm that the tests fail before you implement the change that gets them to pass." Willison calls this "a fantastic fit for coding agents" because "tests give us reliable exit criteria. We are not relying on AI agent's whims, but we force it to iterate until the previously failed tests pass." Also: "Integration projects are the kind of thing coding agents excel at."

**Application:** Red/Green TDD is the default agent workflow. Each issue includes the test file path and expected behavior. Agents write tests (red), implement (green), refactor. Integration work (connecting packages, wiring APIs) is perfect for agents.

Sources: [Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/red-green-tdd/), [Agentic Engineering Patterns overview](https://simonwillison.net/2026/Feb/23/agentic-engineering-patterns/)

### 5. swyx — Tiny Teams & Fire-Ready-Aim

"Build the thing you really want to use. If no one else uses it, that's fine." The Tiny Teams Playbook: simple/boring tech, simple product, compound learning, **let fires burn** ("in order to prioritize the 10% critically important"). "What happens with LLM-enabled engineers is they ship an MVP first, then if the MVP succeeds, they get other people... fire-ready-aim shifts time to market by orders of magnitude."

**Application:** The 19 ADRs are the "ready." Now it's time to "fire." Let fires burn — not every platform ships simultaneously. Focus on web + mobile first, let Watch/macOS/VS Code/MCP wait.

Sources: [Tiny Teams Playbook](https://www.latent.space/p/tiny), [swyx.io](https://www.swyx.io/)

### 6. Kent Beck — Make the Change Easy, Then Make the Easy Change

"For each desired change, make the change easy (warning: this may be hard), then make the easy change." From Tidy First?: "Before you implement a behavior change (B), it may be beneficial to first perform one or more structural changes (S)." **Constantine's Equivalence:** "The cost of software is roughly equal to the cost of changing it... dominated by the cost of big, cascading changes. Therefore, the cost of software is approximately equal to the coupling."

**Application:** Phase 0 (monorepo scaffold, types, CI, test framework) is pure structural investment — "making the change easy." Subsequent phases are "the easy changes." Keep issues pure: either structural (S) or behavioral (B), never both. The layered package architecture minimizes coupling.

Sources: [Kent Beck's tweet](https://x.com/KentBeck/status/250733358307500032), [Tidy First? — SE Radio](https://se-radio.net/2024/05/se-radio-615-kent-beck-on-tidy-first/)

### 7. Walking Skeleton — Cockburn & Tracer Bullets

Alistair Cockburn: "A Walking Skeleton is a tiny implementation of the system that performs a small end-to-end function... a thinly connected functioning architecture." The Pragmatic Programmer's tracer bullets: "Let's try and produce something really early on that we can actually give to the user to see how close we will be to the target." Critical distinction: **tracer code is NOT a prototype — it's the real system, just thin.**

**Application:** Phase 1 IS the walking skeleton: timer starts on web → session saved via API → stored in Supabase → displayed on refresh. Real Nx monorepo, real Hono API, real Supabase schema, real OpenAPI client generation — just the thinnest slice of each. Every subsequent phase adds flesh to existing bones.

Sources: [Walking Skeleton — Henrico Dolfing](https://www.henricodolfing.com/2018/04/start-your-project-with-walking-skeleton.html), [Walking Skeleton — c2 wiki](https://wiki.c2.com/?WalkingSkeleton=)

### 8. Multi-Platform MVP Strategy

Consensus: "Start where your users are, nail the core experience, then expand." Web-first has structural advantages for MVP: no installation barrier, instant deployment, faster iteration. Cross-platform frameworks (Expo/React Native) reduce cost but don't eliminate sequencing — each platform has its own deployment, testing, and edge cases. Code sharing via Expo monorepos can eliminate 40-50% of duplicate code.

**Application:** Web is the walking skeleton platform (fastest iteration, no app store review). Mobile follows immediately using shared packages (~80% code reuse). Native platforms (iOS widget, macOS, watchOS) are separate bets shaped individually. BLE is the highest-risk bet with explicit circuit breaker.

Sources: [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)

### 9. Dependency-Driven Build Order

"Topological sorting transforms complex dependency structures into actionable sequences." Nx automatically detects dependencies between workspace parts and builds the project graph. pnpm runs scripts "in topological order — from the deepest leaf upward."

**Application:** The PomoFocus package graph dictates build order: `types` (leaf) → `core` → `data-access` / `analytics` → `state` → apps. Each layer is testable independently. Downstream work doesn't start until upstream is stable. Nx `affected` detection ensures changes propagate correctly.

Sources: [Nx Buildable Libraries](https://nx.dev/docs/concepts/buildable-and-publishable-libraries), [Nx TypeScript Tutorial](https://nx.dev/docs/getting-started/tutorials/typescript-packages-tutorial)

### Universal Principles (Cross-Expert Synthesis)

| # | Principle | Advocates |
|---|-----------|-----------|
| 1 | **Infrastructure before features** — build the feedback loop first | Beck, Cockburn, Cherny, Willison, Karpathy |
| 2 | **Fix time, vary scope** — set appetites, hammer scope, apply circuit breakers | Singer, swyx |
| 3 | **One platform first, then extend** — web → mobile → native → device | Multi-platform consensus |
| 4 | **Small, verifiable units** — 1 PR per agent session, clear acceptance test | Cherny, Singer, Beck, Willison, Karpathy |
| 5 | **Tests are THE feedback loop** — Red/Green TDD for agents | Willison, Cherny, Beck, Karpathy |
| 6 | **Build in dependency order** — topological sort through the monorepo | Nx/pnpm, Beck (coupling = cost) |

---

## Current State

### What Exists Today
- **Product brief** v0.7 — 9 sections, complete (88.9 KB)
- **19 ADRs** — all accepted, all finalized (one-way doors locked)
- **15 design docs** — implementation blueprints for each ADR
- **Agent workflow infrastructure** — 8 subagents, 11 skills, 3 issue templates, MCP config, ambiguity-check hook
- **CLAUDE.md** — comprehensive project context and rules
- **AGENTS.md + GitHub-Agents.md** — cross-agent brief + 12-section operational reference

### What Does NOT Exist
- **Zero application code** — no `apps/`, `packages/`, `native/`, `firmware/` directories with source
- **No monorepo scaffold** — no `package.json`, `nx.json`, `pnpm-workspace.yaml`, `tsconfig.json`
- **No database** — no Supabase migrations, no schema, no type generation
- **No CI/CD** — `.github/workflows/` is empty (dormant by design per ADR-009)
- **No test framework** — no Vitest, Playwright, Maestro configuration
- **No GitHub setup** — no Projects v2, no labels (13 defined, need `gh label create`)

### v1 Scope (from Product Brief)
| In v1 | Platform |
|--------|----------|
| Yes | Web app (Expo web on Vercel) |
| Yes | Mobile app (Expo iOS + Android) |
| Yes | iOS home screen widget (SwiftUI WidgetKit) |
| Yes | Physical device prototype (EN04 + e-ink) |
| Yes | Hono API on Cloudflare Workers |
| **Post-v1** | Apple Watch, macOS menu bar, VS Code extension, Claude Code MCP |

---

## Critical Path

There are **two independent tracks** that run in parallel and converge when the mobile app needs to talk to the device.

### Track 1: TypeScript Pipeline (determines app launch timeline)

```
Supabase schema (ADR-005)
    ↓
supabase gen types → packages/types
    ↓
packages/core/timer (ADR-004) + packages/core/goals + packages/core/sync (ADR-006)
    ↓
apps/api — Hono on CF Workers (ADR-007) + OpenAPI spec generation
    ↓
packages/data-access — openapi-fetch client + sync drivers
    ↓
packages/state — Zustand stores + TanStack Query hooks (ADR-003)
    ↓
apps/web — Expo web (walking skeleton)
    ↓
apps/mobile — Expo iOS/Android (shared packages)
```

If any item on Track 1 slips, the app launch date slips. Analytics, iOS widget, social features all depend on the web walking skeleton being functional.

### Track 2: Firmware (determines device readiness — fully independent)

```
PlatformIO scaffold (7A.1) — NO TypeScript dependency
    ↓
E-ink display (7A.2) + Timer FSM C++ (7A.3) + Encoder/vibration (7A.4)  [parallel]
    ↓
Protobuf .proto + Nanopb C gen (7A.5)
    ↓
BLE GATT server (7A.6)
    ↓
Session outbox (7A.7)
    ↓
Sleep + power (7A.8)
```

Track 2 starts on day 1 and has zero dependencies on Track 1. If firmware slips, it does NOT delay the app — it only delays BLE sync (which has a circuit breaker).

### Convergence Point

The two tracks merge at **Phase 7B.3** (Mobile BLE Adapter), which needs:
- Track 1: mobile app working (end of Phase 4, ~week 13)
- Track 2: firmware with BLE GATT server (end of 7A.6, ~week 5-6)

By the time Track 1 reaches the convergence point, Track 2 should already have a working device waiting.

---

## Parallelization Opportunities

Work items that can proceed simultaneously with separate agents on separate branches:

| Work Item A | Work Item B | Why Independent |
|-------------|-------------|-----------------|
| `packages/core/timer` (TS) | Firmware scaffold + e-ink display (C++) | Completely different toolchains (Nx/TS vs PlatformIO/C++), different directories, same spec (ADR-004) |
| `packages/core/timer` | `apps/api` route scaffolding | Timer is pure logic; API is HTTP scaffolding — different packages |
| `packages/ui` components | `packages/core/sync` | UI depends on `types` only; sync depends on `core` — different dependency paths |
| `packages/analytics` | `packages/data-access/sync` | Both depend on `core` but don't depend on each other |
| `packages/ble-protocol` | Social API endpoints | Completely independent feature domains |
| Firmware timer FSM (C++) | Firmware e-ink display (C++) | Different hardware subsystems, can merge later |
| iOS widget (Phase 6) | BLE client integration (Phase 7B) | Swift vs TypeScript — different toolchains, different directories |
| Apple Watch (post-v1) | VS Code extension (post-v1) | Fully independent platforms |
| Database migration writing | CI pipeline setup | Different files (supabase/ vs .github/) |

**Maximum parallelism:** From day one, firmware work (Phase 7A) runs as an independent track alongside TypeScript work (Phase 0+). During Phase 0, up to 5 agents can work simultaneously (monorepo scaffold, database schema, CI pipeline, linting config, firmware scaffold + e-ink). During Phase 1, up to 4 agents (core/timer TS, API routes, web app scaffold, firmware timer C++ + rotary encoder). During later phases, parallelism increases as the dependency tree widens.

**The firmware track is the key unlock:** Because `firmware/device/` is PlatformIO/C++ with zero Nx dependencies, and because all specs (ADR-004 timer states, ADR-013 GATT profile, ADR-010 hardware) are fully written, firmware development can start immediately and run continuously alongside the TypeScript pipeline. The two tracks converge only when BLE client adapters need both the mobile app (Phase 4) and the firmware GATT server (Phase 7A) to exist.

---

## Phase 0: Foundation — "Make the Change Easy"

**Appetite:** 2 weeks | **Done milestone:** `pnpm nx affected --target=test` runs green on an empty test suite across all 7 packages, CI passes on push, `supabase gen types` produces TypeScript types from the live schema.

This phase is pure structural investment (Beck's S-changes). It produces no user-visible features but makes every subsequent feature dramatically cheaper.

### 0.1 Nx + pnpm Monorepo Scaffold
- **What:** Initialize Nx workspace with pnpm. Create the 7 package stubs (`types`, `core`, `analytics`, `data-access`, `state`, `ui`, `ble-protocol`) and 3 app stubs (`api`, `web`, `mobile`) as empty Nx libraries/applications with correct `tsconfig.json` references and dependency constraints.
- **Why here:** Everything depends on the monorepo existing. The package dependency graph (`types ← core ← data-access/analytics ← state`, apps consume all) must be enforced from day one to prevent coupling violations.
- **Packages/files:** Root `package.json`, `nx.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, each package's `package.json` + `tsconfig.json` + `src/index.ts`
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md)
- **Acceptance signal:** `pnpm install` succeeds, `pnpm nx graph` renders the correct dependency diagram, `pnpm nx run-many --target=build` passes on all packages.
- **Est. issues:** 8-12 (scaffold root, scaffold each of 7 packages, scaffold each of 3 apps, configure dependency constraints)

### 0.2 Supabase Project + Core Schema Migration
- **What:** Create Supabase project, write SQL migration for all 12 tables (profiles, user_preferences, long_term_goals, process_goals, sessions, breaks, devices, device_sync_log, friend_requests, friendships, encouragement_taps) with 9 enums, UUID PKs, timestamptz columns, foreign keys, check constraints, and the `get_user_id()` helper function.
- **Why here:** `packages/types` is generated from the schema. The schema is the source of truth for the entire type system. Without it, no typed code can be written.
- **Packages/files:** `supabase/migrations/`, `supabase/config.toml`, root `.env` (Supabase URL + anon key, gitignored)
- **ADR(s):** [ADR-005](./decisions/005-database-schema-data-model.md), [design doc](./designs/database-schema-data-model.md)
- **Acceptance signal:** `supabase db push` applies all migrations without error. All 12 tables visible in Supabase dashboard. `get_user_id()` function exists.
- **Est. issues:** 8-10 (enum types migration, profiles + user_preferences, goals tables, sessions + breaks, devices + sync_log, social tables, get_user_id function, RLS policies skeleton, seed data script)

### 0.3 Type Generation Pipeline
- **What:** Configure `supabase gen types typescript` to output to `packages/types/src/database.ts`. Set up the generation script in `package.json`. Create barrel exports for commonly used types (Session, Profile, Goal, etc.).
- **Why here:** Every other package imports from `packages/types`. This is the leaf of the dependency tree — it must exist first.
- **Packages/files:** `packages/types/src/`, `packages/types/package.json` (script: `gen:types`)
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-005](./decisions/005-database-schema-data-model.md)
- **Acceptance signal:** `pnpm nx run @pomofocus/types:gen` produces typed output. Import `Session` from `@pomofocus/types` compiles without error in any downstream package.
- **Est. issues:** 3-4 (configure gen script, create barrel exports, add to Nx pipeline, test imports from downstream)

### 0.4 Test Framework Configuration
- **What:** Configure Vitest as the test runner for all TypeScript packages. Set up shared Vitest config at root, per-package overrides. Create example test in `packages/core` to validate the pipeline. Configure test coverage reporting.
- **Why here:** Tests are THE feedback loop for agents (Willison, Cherny). Without Vitest configured, no Red/Green TDD is possible. Every subsequent issue depends on `pnpm test` working.
- **Packages/files:** Root `vitest.config.ts`, each package's `vitest.config.ts`, `packages/core/src/example.test.ts`
- **ADR(s):** [ADR-009](./decisions/009-ci-cd-pipeline-design.md), [research/08-testing-frameworks.md](./08-testing-frameworks.md)
- **Acceptance signal:** `pnpm nx test @pomofocus/core` runs and passes. `pnpm nx affected --target=test` detects and runs affected tests. Coverage report generates.
- **Est. issues:** 4-5 (root Vitest config, per-package configs for 7 packages, example test, coverage config, Nx test target configuration)

### 0.5 Linting + Formatting Configuration
- **What:** Configure ESLint (flat config) + Prettier for the entire monorepo. Set up shared rules. Enforce import direction constraints (`core` cannot import `data-access`, etc.). Configure TypeScript strict mode.
- **Why here:** Agents produce better code with lint feedback. Import direction enforcement prevents coupling violations that are expensive to fix later.
- **Packages/files:** Root `eslint.config.js`, `.prettierrc`, each `tsconfig.json` strict settings, `.vscode/settings.json`
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-009](./decisions/009-ci-cd-pipeline-design.md)
- **Acceptance signal:** `pnpm nx lint @pomofocus/core` passes. Importing `@pomofocus/data-access` from `@pomofocus/core` triggers a lint error. `pnpm nx affected --target=lint` runs on all affected packages.
- **Est. issues:** 5-7 (ESLint flat config, Prettier config, per-package overrides, import boundary rules, TypeScript strict mode, VS Code settings, pre-commit check)

### 0.6 CI Pipeline (GitHub Actions)
- **What:** Create `.github/workflows/ci.yml` that runs on PR and push to main. Steps: checkout, pnpm install, `nx affected --target=lint`, `nx affected --target=test`, `nx affected --target=type-check`, `nx affected --target=build`. Uses `ubuntu-latest`. Caches pnpm store and Nx cache.
- **Why here:** CI is the gatekeeper that validates every PR. Without it, agents can merge broken code. This is the "verification 2-3x the quality" that Cherny describes.
- **Packages/files:** `.github/workflows/ci.yml`
- **ADR(s):** [ADR-009](./decisions/009-ci-cd-pipeline-design.md)
- **Acceptance signal:** Push a branch, CI runs all 4 targets, all pass. PR shows green checks. `nx affected` correctly detects which packages are impacted.
- **Est. issues:** 3-4 (workflow file, pnpm caching, Nx caching, branch protection rules)

### 0.7 packages/core Module Scaffolding
- **What:** Create the module structure inside `packages/core/`: `timer/`, `goals/`, `sync/`, `session/`. Each module gets an `index.ts` barrel export and a placeholder type. No implementation yet — just the skeleton that subsequent phases will fill.
- **Why here:** Having the directory structure and module boundaries defined upfront prevents agents from creating ad-hoc file structures. The module split (timer, goals, sync, session) matches the ADR-defined domain boundaries.
- **Packages/files:** `packages/core/src/timer/`, `packages/core/src/goals/`, `packages/core/src/sync/`, `packages/core/src/session/`
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md), [ADR-004](./decisions/004-timer-state-machine.md), [ADR-006](./decisions/006-offline-first-sync-architecture.md)
- **Acceptance signal:** `import { TimerState } from '@pomofocus/core/timer'` compiles. All modules export at least a placeholder type. `pnpm nx build @pomofocus/core` passes.
- **Est. issues:** 4-5 (timer module scaffold, goals module scaffold, sync module scaffold, session module scaffold, barrel exports)

**Phase 0 total: ~35-47 issues**

---

## Phase 1: Walking Skeleton — Thinnest Vertical Slice

**Appetite:** 3 weeks | **Done milestone:** A user visits the web app, starts a 25-minute timer, the timer counts down, session is saved to Supabase via the Hono API, and the session appears in a session list on page refresh. Deployed to Vercel (web) + Cloudflare Workers (API) + Supabase (DB). No auth — anonymous usage only at this point.

This is the tracer bullet. Real architecture, just thin. Every component is production-grade but minimal.

### 1.1 Timer State Machine — Core Logic
- **What:** Implement the pure `transition(state, event) → newState` function in `packages/core/timer/`. TypeScript discriminated unions for 9 states (`idle`, `focusing`, `paused`, `short_break`, `long_break`, `break_paused`, `reflection`, `completed`, `abandoned`). All events, guards, and transitions per the design doc. Exhaustive `switch` — no default cases. Comprehensive test suite covering every valid transition and invalid transition rejection.
- **Why here:** The timer is the core of the entire product. Every platform, every UI, every sync operation depends on timer state. It's pure logic with zero dependencies beyond `@pomofocus/types` — the perfect first implementation.
- **Packages/files:** `packages/core/src/timer/types.ts`, `packages/core/src/timer/transition.ts`, `packages/core/src/timer/guards.ts` (tests co-located as `*.test.ts` per TST-006)
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md), [design doc](./designs/timer-state-machine.md)
- **Acceptance signal:** 100% of state machine transitions pass tests. Every valid transition produces correct new state. Every invalid transition is rejected. `pnpm nx test @pomofocus/core` green.
- **Est. issues:** 8-12 (timer state types, idle→focusing transition + test, focusing→paused + test, focusing→completed + test, focusing→abandoned + test, break transitions + tests, reflection transitions + tests, configurable durations, session counting logic, break cycle logic [short/long], guard functions, integration test for full session lifecycle)

### 1.2 Hono API — Minimal Routes
- **What:** Set up `apps/api/` as a Hono application on Cloudflare Workers. Implement 4 routes: `GET /health`, `POST /v1/sessions` (create session), `GET /v1/sessions` (list sessions), `GET /v1/me` (get profile). Use `@hono/zod-openapi` for request/response validation and OpenAPI 3.1 spec generation. Connect to Supabase using `service_role` key for now (auth middleware comes in Phase 2).
- **Why here:** The API is the gateway between clients and data. The walking skeleton needs at minimum: create a session and list sessions. The OpenAPI spec generated here feeds the client SDK in 1.3.
- **Packages/files:** `apps/api/src/index.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/routes/sessions.ts`, `apps/api/src/routes/me.ts`, `apps/api/wrangler.toml`, `apps/api/package.json`
- **ADR(s):** [ADR-007](./decisions/007-api-architecture.md), [design doc](./designs/api-architecture.md)
- **Acceptance signal:** `wrangler dev` starts local API. `curl localhost:8787/health` returns 200. `POST /v1/sessions` with valid body inserts row in Supabase. `GET /v1/sessions` returns list. OpenAPI spec served at `/openapi.json`.
- **Est. issues:** 8-10 (Hono project scaffold, wrangler.toml config, Supabase client setup, health route, sessions POST route + Zod schema, sessions GET route + Zod schema, profile GET route, OpenAPI spec configuration, error handling middleware, local dev script)

### 1.3 OpenAPI Client Generation + packages/data-access
- **What:** Generate TypeScript API client from the Hono OpenAPI spec using `openapi-fetch`. Set up `packages/data-access/` with the generated client, base URL configuration, and request/response type safety. Create a thin wrapper for session operations.
- **Why here:** `packages/data-access` is how all client apps talk to the API. Once the OpenAPI spec exists (1.2), the client can be auto-generated. This is the "openapi-fetch generated from spec" pipeline described in ADR-007.
- **Packages/files:** `packages/data-access/src/client.ts`, `packages/data-access/src/sessions.ts`, `packages/data-access/scripts/generate-client.ts`
- **ADR(s):** [ADR-007](./decisions/007-api-architecture.md), [ADR-001](./decisions/001-monorepo-package-structure.md)
- **Acceptance signal:** `pnpm nx run @pomofocus/data-access:generate` produces typed client. `createSession()` and `getSessions()` functions exist with full type safety. Types match the Zod schemas from the API.
- **Est. issues:** 5-7 (openapi-fetch setup, client generation script, session operations wrapper, base URL config, type validation tests, Nx pipeline integration, error handling types)

### 1.4 packages/state — Zustand Timer Store + TanStack Query
- **What:** Create Zustand store for local timer state (wrapping `packages/core/timer/transition`). Create TanStack Query hooks for session data (`useSession`, `useSessions`). The Zustand store calls `transition()` on user actions and manages the platform timer driver (setInterval for web).
- **Why here:** `packages/state` is the bridge between pure core logic and React UIs. Both web and mobile will import from here. The timer store is the first consumer of the core timer FSM.
- **Packages/files:** `packages/state/src/timer-store.ts`, `packages/state/src/hooks/use-sessions.ts`, `packages/state/src/hooks/use-session.ts`
- **ADR(s):** [ADR-003](./decisions/003-client-state-management.md), [ADR-004](./decisions/004-timer-state-machine.md)
- **Acceptance signal:** Timer store advances through idle→focusing→completed cycle. `useSessions()` hook fetches from API and returns typed data. Store tests pass in Vitest with mocked API.
- **Est. issues:** 6-8 (Zustand store setup, timer store with transition delegation, setInterval driver for web, TanStack Query provider config, useSessions hook, useSession hook, store tests, hook tests)

### 1.5 apps/web — Minimal Expo Web App
- **What:** Create `apps/web/` as an Expo app configured for web output. Minimal UI: a single screen with a start/stop button, a countdown display, and a session list below. Imports timer store from `@pomofocus/state` and session hooks. No navigation, no auth, no styling polish.
- **Why here:** The web app is the thinnest client that proves the architecture works end-to-end. It exercises: Expo web → packages/state → packages/core/timer → packages/data-access → Hono API → Supabase. This IS the walking skeleton.
- **Packages/files:** `apps/web/`, `apps/web/app/index.tsx`, `apps/web/package.json`, `apps/web/app.json`
- **ADR(s):** [ADR-003](./decisions/003-client-state-management.md)
- **Acceptance signal:** `pnpm nx start @pomofocus/web` opens in browser. User clicks "Start" → timer counts down → clicks "Complete" → session appears in list below. Page refresh shows persisted sessions from API.
- **Est. issues:** 5-7 (Expo web scaffold, timer display component, start/stop button wired to store, session list component, API integration, dev server configuration, basic layout)

### 1.6 End-to-End Deployment
- **What:** Deploy the walking skeleton: web app to Vercel, API to Cloudflare Workers, Supabase already running. Configure environment variables (Supabase URL, API URL). Set up Vercel GitHub integration for preview deploys on PR.
- **Why here:** Deployment validates the full production pipeline. The walking skeleton isn't complete until it's running on real infrastructure — Cockburn: "automatically built, deployed, and tested end-to-end."
- **Packages/files:** `apps/web/vercel.json`, `apps/api/wrangler.toml` (production config), GitHub secrets
- **ADR(s):** [ADR-009](./decisions/009-ci-cd-pipeline-design.md)
- **Acceptance signal:** Visit `pomofocus.vercel.app` (or equivalent), start a timer, complete a session, refresh page — session persists. API health check at `api.pomofocus.dev/health` returns 200.
- **Est. issues:** 4-5 (Vercel project setup, CF Workers deploy config, environment variable management, Vercel GitHub integration, smoke test verification)

**Phase 1 total: ~36-49 issues**

---

## Phase 2: Auth + Sync + Goals

**Appetite:** 3 weeks | **Done milestone:** Users can sign up / log in (email + Google + Apple OAuth). Sessions are tied to authenticated users with RLS. Goals can be created and associated with sessions. Offline sessions queue in the outbox and sync when connectivity returns. All data is user-scoped — users only see their own data.

### 2.1 Supabase Auth Integration
- **What:** Implement auth flow on web: sign up (email), log in (email), Google OAuth, Apple Sign-In. Use Supabase Auth SDK directly from the client (not proxied through API per ADR-002). Store JWT in HttpOnly cookie (web). Create `packages/data-access/auth/` module for token management and refresh logic.
- **Why here:** Auth is required before RLS can work. Without auth, all data is globally visible. Google OAuth and Apple Sign-In are App Store requirements (Apple) and UX expectations (Google).
- **Packages/files:** `packages/data-access/src/auth/`, `apps/web/` (auth pages), Supabase Auth config (dashboard)
- **ADR(s):** [ADR-002](./decisions/002-auth-architecture.md), [design doc](./designs/auth-architecture.md)
- **Acceptance signal:** User signs up with email → profile created in `profiles` table. User logs in with Google → session established. JWT stored securely. Token refresh works silently. Logged-out user sees login page.
- **Est. issues:** 8-10 (Supabase Auth config, email signup flow, email login flow, Google OAuth setup, Apple Sign-In setup, token storage [HttpOnly cookie], token refresh interceptor, auth state hook in packages/state, login page UI, signup page UI)

### 2.2 API Auth Middleware
- **What:** Add JWT validation middleware to Hono API. Extract Bearer token from Authorization header, verify with Supabase, forward user's token to Supabase for RLS-scoped queries. All routes except `/health` require auth. Create `get_user_id()` SQL function that maps `auth.uid()` to `profiles.id`.
- **Why here:** RLS requires the API to forward user tokens. Without auth middleware, RLS policies are untested and all queries return global data.
- **Packages/files:** `apps/api/src/middleware/auth.ts`, `supabase/migrations/` (get_user_id function)
- **ADR(s):** [ADR-007](./decisions/007-api-architecture.md), [ADR-002](./decisions/002-auth-architecture.md), [ADR-005](./decisions/005-database-schema-data-model.md)
- **Acceptance signal:** Unauthenticated request to `/v1/sessions` returns 401. Authenticated request returns only that user's sessions. `get_user_id()` function correctly maps JWT to profile ID.
- **Est. issues:** 5-7 (JWT extraction middleware, Supabase token forwarding, get_user_id migration, 401 response handling, auth integration tests, rate limiting skeleton)

### 2.3 RLS Policies — All Tables
- **What:** Write Row Level Security policies for all 12 tables using `get_user_id()` helper. Users can only read/write their own data. Social tables (friend_requests, friendships, encouragement_taps) have bidirectional policies. Test each policy.
- **Why here:** RLS is defense-in-depth (ADR-012). It must be active before any real user data flows through the system. Testing RLS policies now prevents security issues later.
- **Packages/files:** `supabase/migrations/` (RLS policies)
- **ADR(s):** [ADR-005](./decisions/005-database-schema-data-model.md), [ADR-012](./decisions/012-security-data-privacy.md)
- **Acceptance signal:** User A cannot read User B's sessions. User A can read their own friend_requests (sent and received). All 12 tables have active RLS policies. Integration tests verify isolation.
- **Est. issues:** 6-8 (RLS for profiles + user_preferences, RLS for goals tables, RLS for sessions + breaks, RLS for devices + sync_log, RLS for social tables, integration tests, policy documentation)

### 2.4 Goals Model
- **What:** Implement goals in `packages/core/goals/`: long-term goals, process goals (with streak tracking), and session intentions. API endpoints: CRUD for long-term goals, CRUD for process goals, session intention on session create. Streak logic: 1-day grace period, account-wide, user timezone at query time.
- **Why here:** Goals are the second core domain object after sessions. The session lifecycle (Phase 3) requires goal association. Process goals drive the streak system and analytics (Phase 5).
- **Packages/files:** `packages/core/src/goals/`, `apps/api/src/routes/goals.ts`, `packages/state/src/hooks/use-goals.ts`
- **ADR(s):** [ADR-005](./decisions/005-database-schema-data-model.md), [ADR-014](./decisions/014-analytics-insights-architecture.md)
- **Acceptance signal:** User creates a long-term goal and a process goal. Process goal tracks streak correctly (increments on session completion, grace period works). Session can be associated with a goal. API endpoints return typed goal data.
- **Est. issues:** 8-10 (long-term goal types + core logic, process goal types + core logic, streak calculation function + tests, API endpoints for long-term goals CRUD, API endpoints for process goals CRUD, session-goal association, state hooks for goals, grace period logic + tests, timezone handling, goal validation rules)

### 2.5 Sync FSM — Core Logic
- **What:** Implement the pure sync state machine in `packages/core/sync/`: outbox queue states (pending, uploading, uploaded, failed), conflict resolution rules (server wins on conflict, client-generated UUIDs for idempotency), retry policy (exponential backoff). No IO — pure `transition(queueState, event) → newQueueState`.
- **Why here:** Offline-first sync is fundamental to the product (users need the app to work without connectivity). The sync FSM follows the same pattern as the timer (ADR-004) — pure logic, no side effects. Must exist before sync drivers (2.6).
- **Packages/files:** `packages/core/src/sync/types.ts`, `packages/core/src/sync/transition.ts`, `packages/core/src/sync/queue.ts` (tests co-located as `*.test.ts` per TST-006)
- **ADR(s):** [ADR-006](./decisions/006-offline-first-sync-architecture.md), [design doc](./designs/offline-first-sync-architecture.md)
- **Acceptance signal:** Sync FSM transitions pass 100% of tests. Queue correctly handles: enqueue → upload → success, enqueue → upload → fail → retry with backoff, duplicate detection via UUID. `pnpm nx test @pomofocus/core` green.
- **Est. issues:** 6-8 (sync queue types, queue state transitions + tests, conflict resolution rules + tests, retry policy with backoff + tests, UUID idempotency logic, dequeue ordering, integration test for full sync lifecycle, queue size management)

### 2.6 Sync Drivers — packages/data-access
- **What:** Implement sync drivers in `packages/data-access/sync/`: API upload driver (uses openapi-fetch client), queue persistence driver (IndexedDB for web, to be extended for mobile in Phase 4). Network detection. Wire the sync engine to the core FSM.
- **Why here:** Sync drivers are the IO layer that the pure sync FSM (2.5) needs to actually upload data. Without drivers, offline sessions would queue forever. This completes the offline-first story on web.
- **Packages/files:** `packages/data-access/src/sync/upload-driver.ts`, `packages/data-access/src/sync/persistence-driver.ts`, `packages/data-access/src/sync/network-detector.ts`
- **ADR(s):** [ADR-006](./decisions/006-offline-first-sync-architecture.md), [ADR-001](./decisions/001-monorepo-package-structure.md)
- **Acceptance signal:** Session created offline is persisted in IndexedDB. When connectivity returns, session uploads to API automatically. Duplicate upload (same UUID) is rejected gracefully by server (`ON CONFLICT DO NOTHING`). Retry with backoff works after transient failure.
- **Est. issues:** 5-7 (upload driver, IndexedDB persistence driver, network detection, sync engine wiring, offline→online test, retry behavior test, queue drain on reconnect)

**Phase 2 total: ~38-50 issues**

---

## Phase 3: Session Lifecycle + Reflection

**Appetite:** 2 weeks | **Done milestone:** Full session lifecycle works on web: user selects a goal, optionally writes an intention, starts a focus session, timer runs through focus→break→focus cycles, break enforcement is recommended-but-skippable, post-session reflection captures focus quality + distraction type + notes, and abandoned sessions collect a reason. All data persists and syncs.

### 3.1 Pre-Session Flow
- **What:** Implement the pre-session UI on web: goal selection from user's goals, optional session intention (200 char max, not editable after start), 30-second countdown before focus begins. Wire to timer store.
- **Why here:** The session lifecycle starts with pre-session. This must exist before the timer can produce meaningful data (goal association, intention text). The 30-second pre-session is part of the core product experience (product brief).
- **Packages/files:** `apps/web/` (pre-session screen), `packages/state/src/timer-store.ts` (pre-session state)
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md), product brief Session Flow
- **Acceptance signal:** User sees goal picker before starting. Intention input accepts up to 200 characters. 30-second countdown runs before focus begins. Goal and intention are associated with the session record.
- **Est. issues:** 4-6 (goal selection UI, intention input component, pre-session countdown, wire to timer store, intention validation [200 char], session-goal association on start)

### 3.2 Focus→Break Cycles
- **What:** Implement full timer cycling on web: focus period → short break → focus → short break → ... → long break (after configurable N sessions). Break enforcement: recommended but skippable (SKIP_BREAK event). Break usefulness rating after each break.
- **Why here:** The timer walking skeleton (Phase 1) only handled start→complete. Real usage requires cycling through focus and break periods. The core timer FSM already supports this (ADR-004) — this wires it to the web UI.
- **Packages/files:** `apps/web/` (break screen), `packages/core/src/timer/` (cycle logic), `packages/state/src/timer-store.ts`
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md), [design doc](./designs/timer-state-machine.md)
- **Acceptance signal:** After focus completes, break timer starts automatically. User can skip break (SKIP_BREAK event). After N short breaks, long break triggers. Break usefulness rating prompt appears after break. Cycle count displays correctly.
- **Est. issues:** 5-7 (break timer UI, skip break button + event, short/long break cycle logic, break usefulness rating UI, cycle counter display, configurable session count, break data persistence)

### 3.3 Post-Session Reflection
- **What:** Implement reflection flow after session completion: focus quality (5-point scale), distraction type (closed 5-value enum), reflection notes (free text). Conditional branching: if `reflection_enabled` in user preferences, show full reflection; otherwise skip to completed. Store reflection data on session record.
- **Why here:** Reflection is the core thesis of PomoFocus — "the product is portable structure." Without reflection, sessions are just timed blocks with no learning. This is what differentiates PomoFocus from a kitchen timer.
- **Packages/files:** `packages/core/src/session/reflection.ts`, `apps/web/` (reflection screen), API session update endpoint
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md) (reflection state), [ADR-005](./decisions/005-database-schema-data-model.md) (session columns)
- **Acceptance signal:** After timer completes, reflection UI appears (if enabled). Focus quality and distraction type are selectable. Notes are free text. Reflection data saves to session record via API. User can disable reflection in preferences and it's skipped.
- **Est. issues:** 5-7 (focus quality selector component, distraction type selector component, reflection notes input, conditional reflection flow, API session update with reflection data, user preference toggle, reflection state transition tests)

### 3.4 Abandonment Flow
- **What:** Implement session abandonment: user can abandon during focus (explicit "Stop" action). After abandonment, optional reason prompt ("Had to stop" or "Gave up" — non-judgmental). `NULL` reason treated as `gave_up` in analytics. Abandoned sessions are recorded with actual focus duration.
- **Why here:** Abandonment is a critical data point for analytics (Phase 5). Without abandonment handling, the timer only records completed sessions, missing a key aspect of the user's focus patterns.
- **Packages/files:** `packages/core/src/timer/` (abandoned state), `apps/web/` (abandonment UI), API
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md), [ADR-005](./decisions/005-database-schema-data-model.md)
- **Acceptance signal:** User clicks "Stop" during focus → timer enters abandoned state → reason prompt appears → session saved with actual duration and optional reason. Dismissing reason prompt saves session with NULL reason.
- **Est. issues:** 3-4 (abandon button + confirmation, reason prompt UI, session save with partial duration, abandonment tests)

### 3.5 Timer Persistence + Rehydration
- **What:** Handle app kill / browser refresh during active session. Persist timer state to local storage on every state change. On app restart, rehydrate timer state using timestamps to calculate elapsed time. If session has been running longer than max duration, auto-abandon.
- **Why here:** Without persistence, closing the browser tab loses an in-progress session. This is critical for real usage — users will switch tabs, close laptops, etc. The timer must survive interruptions.
- **Packages/files:** `packages/state/src/timer-store.ts` (persistence), `packages/core/src/timer/rehydrate.ts`
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md) (design doc: persistence/rehydration strategy)
- **Acceptance signal:** Start timer → close tab → reopen → timer resumes at correct time. Start timer → close tab → wait beyond session duration → reopen → session auto-completed or auto-abandoned with correct duration.
- **Est. issues:** 4-5 (state persistence on change, rehydration logic with timestamp math, auto-abandon on expiry, max duration guard, rehydration tests)

**Phase 3 total: ~21-29 issues**

---

## Phase 4: Mobile App

**Appetite:** 3 weeks | **Done milestone:** Expo iOS + Android app works with the same session lifecycle as web: auth, timer, goals, reflection, sync. Local notifications fire for timer end, goal nudge, and weekly summary. Push notifications wired for encouragement taps. Secure token storage via expo-secure-store.

### 4.1 packages/ui — Shared Components
- **What:** Create shared React/React Native UI components in `packages/ui/`: Button, TextInput, Card, Timer display, Goal picker, Session list item. Use React Native primitives (View, Text, Pressable) that work on both web and mobile via Expo.
- **Why here:** The web app (Phase 1-3) built UI inline. Now that mobile needs the same components, extract shared UI to prevent duplication. `packages/ui` depends only on `@pomofocus/types`.
- **Packages/files:** `packages/ui/src/components/`, `packages/ui/src/index.ts`
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md)
- **Acceptance signal:** Components render correctly on both web (Expo web) and mobile (Expo iOS simulator). `import { TimerDisplay } from '@pomofocus/ui'` works from both `apps/web` and `apps/mobile`.
- **Est. issues:** 6-8 (Button component, TextInput component, Card component, TimerDisplay component, GoalPicker component, SessionListItem component, barrel exports, Storybook or visual test setup)

### 4.2 apps/mobile — Expo App Scaffold
- **What:** Create `apps/mobile/` as an Expo managed workflow app. Configure navigation (Expo Router), screens (Home/Timer, Sessions, Goals, Settings), and wire to `@pomofocus/state` and `@pomofocus/ui`. Same business logic as web — different navigation shell and platform glue.
- **Why here:** Mobile is the second platform. It shares ~80% of code via packages. The delta is navigation, notifications, secure storage, and platform-specific behavior (backgrounding).
- **Packages/files:** `apps/mobile/`, `apps/mobile/app/`, `apps/mobile/app.json`, `apps/mobile/package.json`
- **ADR(s):** [ADR-001](./decisions/001-monorepo-package-structure.md)
- **Acceptance signal:** `pnpm nx start @pomofocus/mobile` opens in iOS simulator. User can navigate between Home, Sessions, Goals, Settings. Timer starts and runs. Sessions list populates from API.
- **Est. issues:** 6-8 (Expo scaffold, Expo Router navigation, Home/Timer screen, Sessions screen, Goals screen, Settings screen, wire to state package, dev build configuration)

### 4.3 Mobile Auth + Secure Storage
- **What:** Implement auth on mobile using Supabase Auth SDK with `expo-secure-store` for token storage. Deep link handling for OAuth redirects. Same auth flows as web (email, Google, Apple) adapted for mobile.
- **Why here:** Mobile needs its own token storage mechanism (expo-secure-store, not cookies). OAuth redirects work differently on mobile (deep links). This must work before any user-specific data can flow.
- **Packages/files:** `apps/mobile/` (auth screens), `packages/data-access/src/auth/` (mobile adapter)
- **ADR(s):** [ADR-002](./decisions/002-auth-architecture.md), [ADR-012](./decisions/012-security-data-privacy.md)
- **Acceptance signal:** User logs in on mobile → token stored in expo-secure-store. Google OAuth opens system browser, redirects back to app. Token refresh works in background. Logout clears secure storage.
- **Est. issues:** 5-7 (expo-secure-store setup, mobile auth adapter, OAuth deep link handling, login screen, signup screen, token refresh on mobile, logout flow)

### 4.4 Local Notifications
- **What:** Implement 3 local notification types on mobile: timer end (scheduled when session starts), goal nudge (scheduled daily, self-cancels if session started today), weekly summary (user-configurable day/time, default Sunday 7pm). Request notification permission at first timer creation.
- **Why here:** Notifications are a mobile-specific feature (web push explicitly deferred per ADR-019). Timer end notifications are critical for focus sessions where the phone is face-down. Permission timing at first timer creation is a high-value moment.
- **Packages/files:** `apps/mobile/` (notification setup), `packages/state/src/notification-store.ts`
- **ADR(s):** [ADR-019](./decisions/019-notification-strategy.md)
- **Acceptance signal:** Start a 1-minute timer, lock phone → notification fires at timer end. Configure goal nudge → fires daily if no session started. Weekly summary fires at configured time. Permission requested exactly once at first timer start.
- **Est. issues:** 5-7 (expo-notifications setup, timer end scheduling, goal nudge scheduling + self-cancel, weekly summary scheduling + config, permission request flow, notification preferences UI, notification cancel on manual session end)

### 4.5 Expo Push Service Setup
- **What:** Register for Expo Push tokens on mobile app launch. Store `expo_push_token` in `devices` table via API endpoint (`POST /v1/devices`). This wires the infrastructure for encouragement taps (Phase 8) but doesn't implement tap sending yet.
- **Why here:** Push token registration should happen early so the infrastructure is ready when social features need it. The `devices` table already exists (Phase 0 schema). This is lightweight plumbing.
- **Packages/files:** `apps/mobile/` (push registration), `apps/api/src/routes/devices.ts`, `packages/data-access/src/devices.ts`
- **ADR(s):** [ADR-019](./decisions/019-notification-strategy.md), [ADR-005](./decisions/005-database-schema-data-model.md)
- **Acceptance signal:** App launch registers push token with Expo Push Service. Token stored in `devices` table. Token refreshes on app reinstall. API endpoint validates and stores token.
- **Est. issues:** 3-4 (expo-notifications push token registration, API device registration endpoint, data-access device client, token refresh handling)

### 4.6 Mobile Sync + Backgrounding
- **What:** Extend sync drivers for mobile: use Expo SQLite for outbox persistence (replacing IndexedDB). Handle app backgrounding: persist timer state, trigger sync on app foreground. Ensure the outbox drains when the app returns from background.
- **Why here:** Mobile has different persistence and lifecycle requirements than web. Expo SQLite replaces IndexedDB. App backgrounding must not lose timer state or queued sessions.
- **Packages/files:** `packages/data-access/src/sync/` (mobile persistence driver), `apps/mobile/` (app state handling)
- **ADR(s):** [ADR-006](./decisions/006-offline-first-sync-architecture.md), [ADR-003](./decisions/003-client-state-management.md)
- **Acceptance signal:** Create session offline on mobile → session queued in SQLite → bring app online → session syncs to API. Background app during timer → foreground → timer resumes correctly. Outbox drains automatically on foreground.
- **Est. issues:** 4-5 (Expo SQLite persistence driver, app state lifecycle handling, foreground sync trigger, background timer persistence, mobile offline→online test)

**Phase 4 total: ~29-39 issues**

---

## Phase 5: Analytics

**Appetite:** 2 weeks | **Done milestone:** All three analytics tiers compute correctly via API endpoints. Tier 1 (goal progress, weekly dots, streak) available for all platforms. Tier 2 (completion rate, focus quality, consistency) and Tier 3 (monthly trends) available for app. Cold-start thresholds enforced.

### 5.1 packages/analytics — Pure Computation Functions
- **What:** Implement all analytics formulas as pure functions in `packages/analytics/`: completion rate, focus quality distribution, consistency score, streak calculation, goal progress, weekly dots (sessions per day of week), peak focus window, total focus time, per-goal breakdown, distraction patterns. No IO — input is arrays of session/goal objects, output is computed metrics.
- **Why here:** Analytics depends on sessions and goals existing (Phases 1-3). It's a pure computation package with no platform dependencies — perfect for isolated testing. Must exist before API endpoints (5.2-5.4) can serve results.
- **Packages/files:** `packages/analytics/src/`, test files
- **ADR(s):** [ADR-014](./decisions/014-analytics-insights-architecture.md), [design doc](./designs/analytics-insights-architecture.md)
- **Acceptance signal:** All Tier 1/2/3 metric functions pass tests with known input→output pairs. Edge cases handled (zero sessions, single session, 365 sessions). Cold-start returns appropriate "not enough data" response.
- **Est. issues:** 10-14 (completion rate function, focus quality distribution, consistency score, streak calculation with grace period, goal progress, weekly dots, peak focus window, total focus time, per-goal breakdown, distraction pattern analysis, monthly trend functions, cold-start thresholds, edge case tests, integration test with realistic data)

### 5.2 API Endpoints — Tier 1 (Glanceable)
- **What:** Add `GET /v1/analytics/tier1` endpoint. Returns: goal progress (% of process goal target), weekly dots (binary: did user focus each day this week), current streak (consecutive days with completed session, 1-day grace). Computed server-side using `packages/analytics` functions querying user's sessions.
- **Why here:** Tier 1 metrics are needed by all platforms (web, mobile, iOS widget, BLE device). They're the simplest to compute and most frequently accessed.
- **Packages/files:** `apps/api/src/routes/analytics.ts`
- **ADR(s):** [ADR-014](./decisions/014-analytics-insights-architecture.md), [ADR-007](./decisions/007-api-architecture.md)
- **Acceptance signal:** `GET /v1/analytics/tier1` returns JSON with `goalProgress`, `weeklyDots`, `currentStreak`. Values match expected output for test user's session history. Response time < 100ms.
- **Est. issues:** 3-4 (Tier 1 endpoint, query user sessions, wire to analytics functions, response schema + tests)

### 5.3 API Endpoints — Tier 2 (Weekly Insights)
- **What:** Add `GET /v1/analytics/tier2` endpoint. Returns: completion rate, focus quality distribution (histogram), total focus time this week, peak focus window (most productive hour), per-goal breakdown. Requires ≥1 session all-time (cold-start threshold).
- **Why here:** Tier 2 provides the weekly insights that drive user engagement. It's app-only (not widget or device). Depends on Tier 1 infrastructure (5.2).
- **Packages/files:** `apps/api/src/routes/analytics.ts`
- **ADR(s):** [ADR-014](./decisions/014-analytics-insights-architecture.md)
- **Acceptance signal:** `GET /v1/analytics/tier2` returns all weekly insight metrics. Returns 204 (no content) when user has zero sessions. Response includes trend arrows (up/down/flat vs previous week).
- **Est. issues:** 3-4 (Tier 2 endpoint, wire to analytics functions, trend arrow computation, cold-start handling)

### 5.4 API Endpoints — Tier 3 (Monthly Trends)
- **What:** Add `GET /v1/analytics/tier3` endpoint. Returns: monthly consistency trend, monthly completion trend, monthly quality trend, monthly focus time trend, monthly distraction patterns. Requires ≥2 calendar months with data (cold-start threshold).
- **Why here:** Tier 3 is the long-term view. It's the last analytics tier and the least frequently accessed. Depends on Tier 1/2 infrastructure.
- **Packages/files:** `apps/api/src/routes/analytics.ts`
- **ADR(s):** [ADR-014](./decisions/014-analytics-insights-architecture.md)
- **Acceptance signal:** `GET /v1/analytics/tier3` returns monthly trend data. Returns 204 when < 2 months of data. Trends show direction correctly over multi-month periods.
- **Est. issues:** 3-4 (Tier 3 endpoint, monthly aggregation logic, cold-start threshold, trend tests with multi-month data)

**Phase 5 total: ~19-26 issues**

---

## Phase 6: iOS Widget

**Appetite:** 2 weeks | **Done milestone:** iOS home screen widget displays Tier 1 analytics (user-selectable stat). Supports Small, Medium, and Lock Screen (Accessory) sizes. Data flows from Expo app via App Group UserDefaults. Widget refreshes when app computes new analytics.

### 6.1 @bacons/apple-targets Setup
- **What:** Configure `@bacons/apple-targets` Expo Config Plugin for the iOS widget extension. Create the widget target directory at `apps/mobile/targets/ios-widget/`. Configure App Group for data sharing between main app and widget extension. Verify `expo prebuild --clean` preserves widget files.
- **Why here:** The build infrastructure must exist before any widget code. `@bacons/apple-targets` integrates the WidgetKit extension into the Expo build pipeline. This is pure structural setup.
- **Packages/files:** `apps/mobile/targets/ios-widget/`, `apps/mobile/app.json` (plugin config)
- **ADR(s):** [ADR-017](./decisions/017-ios-widget-architecture.md), [design doc](./designs/ios-widget-architecture.md)
- **Acceptance signal:** `expo prebuild` generates Xcode project with widget target. App Group configured and accessible from both targets. Widget appears in device widget gallery (even if empty).
- **Est. issues:** 3-4 (plugin config, target directory setup, App Group config, prebuild verification)

### 6.2 React Native → UserDefaults Bridge
- **What:** Create an Expo native module that writes Tier 1 analytics stats to App Group shared UserDefaults. Module exposes `writeWidgetData(stats: WidgetStats)` and calls `WidgetCenter.shared.reloadAllTimelines()` after each write. Define shared `WidgetKeys` constants in both TypeScript and Swift.
- **Why here:** The data bridge must exist before the widget can display anything. This is the plumbing between the Expo app (which computes analytics) and the SwiftUI widget (which displays them).
- **Packages/files:** `apps/mobile/modules/widget-bridge/` (native module), `packages/types/src/widget-keys.ts`, `apps/mobile/targets/ios-widget/WidgetKeys.swift`
- **ADR(s):** [ADR-017](./decisions/017-ios-widget-architecture.md)
- **Acceptance signal:** App writes stats to UserDefaults → widget reads correct values. `WidgetCenter.reloadAllTimelines()` triggers widget refresh. WidgetKeys match between TS and Swift (verified by `/align-repo`).
- **Est. issues:** 4-5 (native module implementation, WidgetKeys constants [TS + Swift], UserDefaults write function, WidgetCenter reload trigger, bridge tests)

### 6.3 SwiftUI Widget Implementation
- **What:** Implement the WidgetKit extension in SwiftUI. `AppIntentConfiguration` allows users to choose which stat to display (goal progress, weekly dots, streak, completion rate). Three size families: Small (single stat), Medium (stat + context), Lock Screen Accessory (compact). Read data from App Group UserDefaults.
- **Why here:** All infrastructure is ready (target, bridge, data flow). This is the behavioral implementation of the widget itself.
- **Packages/files:** `apps/mobile/targets/ios-widget/*.swift`
- **ADR(s):** [ADR-017](./decisions/017-ios-widget-architecture.md)
- **Acceptance signal:** Widget renders in all 3 sizes on iOS 17+ device. User can configure which stat to show via long-press → Edit Widget. Widget updates when app writes new data. Graceful display when no data available.
- **Est. issues:** 5-7 (AppIntent configuration, Small widget view, Medium widget view, Lock Screen Accessory view, TimelineProvider, placeholder/snapshot views, no-data state)

**Phase 6 total: ~12-16 issues**

---

## Phase 7A: Device Firmware — Independent Hardware Track

**Appetite:** 6 weeks (runs parallel with Phases 0-4) | **Starts: Day 1** | **CIRCUIT BREAKER: If the device can't run a standalone timer with e-ink display + rotary encoder after 4 weeks, simplify to timer + LED only.**

**Done milestone:** Physical device runs as a standalone Pomodoro timer: e-ink display shows countdown, rotary encoder navigates/starts/pauses, vibration motor signals timer end, BLE GATT server advertises and accepts connections from nRF Connect, sessions stored in flash outbox. Device works independently of the phone — it IS a usable timer even before any client integration.

> **Why this starts on day one:** The firmware is PlatformIO/C++ in `firmware/device/` — a completely separate toolchain from the Nx/TypeScript monorepo. It has zero code dependencies on any TypeScript package. All specs needed (ADR-004 timer states, ADR-010 hardware, ADR-013 GATT profile, ADR-015 toolchain) are fully written design docs. Starting firmware early de-risks the highest-uncertainty work while the TypeScript pipeline gets built.

### 7A.1 Firmware Scaffold — PlatformIO + EN04
- **What:** Set up `firmware/device/` with PlatformIO project for the Seeed XIAO ePaper EN04 (nRF52840). Configure `platformio.ini` with Arduino framework, BLE SoftDevice, and library dependencies (GxEPD2, Nanopb). Create `setup()` and `loop()` skeleton. Verify build compiles and uploads to board.
- **Why here:** The firmware build system must work before any firmware logic. This validates the toolchain: PlatformIO finds the EN04 board, compiles Arduino C++, and can upload via USB. **Zero dependency on the TypeScript monorepo.**
- **Packages/files:** `firmware/device/platformio.ini`, `firmware/device/src/main.cpp`, `firmware/device/lib/`
- **ADR(s):** [ADR-010](./decisions/010-physical-device-hardware-platform.md), [ADR-015](./decisions/015-device-firmware-toolchain.md)
- **Acceptance signal:** `pio run` compiles without error. `pio run -t upload` uploads to EN04 board. Serial output shows "PomoFocus booting..." Board LED blinks to confirm firmware running.
- **Est. issues:** 4-5 (platformio.ini config, main.cpp skeleton, library dependencies, build verification, upload verification)

### 7A.2 E-Ink Display Driver
- **What:** Implement e-ink display driver using GxEPD2 (`GxEPD2_426_GDEQ0426T82` class). Create display manager with functions: `showTimerScreen(minutes, seconds, state)`, `showIdleScreen()`, `showGoalScreen(goalName)`, `showSessionComplete()`. Implement partial refresh strategy (1/min during session, full refresh every ~5 partial refreshes to clear ghosting).
- **Why here:** The display is the primary output of the device and one of the key technical unknowns (partial refresh behavior on this specific panel). **Validate early.** Depends only on 7A.1 (PlatformIO builds). No TypeScript dependency.
- **Packages/files:** `firmware/device/src/display.h`, `firmware/device/src/display.cpp`
- **ADR(s):** [ADR-010](./decisions/010-physical-device-hardware-platform.md)
- **Acceptance signal:** Timer countdown displays on e-ink (800x480, clear text). Partial refresh updates time without full-screen flash. Full refresh clears ghosting artifacts. Display hibernates during sleep.
- **Est. issues:** 5-7 (GxEPD2 initialization, timer screen layout, idle screen layout, partial refresh implementation, full refresh cycle, ghosting prevention, display sleep/wake)

### 7A.3 Timer FSM — C++ Port
- **What:** Port the timer state machine to C++ (`firmware/device/src/timer.h`). Same 9 states (`idle`, `focusing`, `paused`, `short_break`, `long_break`, `break_paused`, `reflection`, `completed`, `abandoned`), same transitions, same guards as defined in ADR-004's design doc. This is a direct translation from the spec — not a port of the TypeScript code (which may not exist yet).
- **Why here:** The timer FSM is the core firmware logic. The spec is fully defined in [ADR-004 design doc](./designs/timer-state-machine.md) with state tables, event tables, and guards. **Does NOT need the TypeScript implementation to exist** — both are parallel implementations of the same spec. Can start as soon as the firmware scaffold compiles (7A.1).
- **Packages/files:** `firmware/device/src/timer.h`, `firmware/device/src/timer.cpp`, `firmware/device/src/timer_test.cpp`
- **ADR(s):** [ADR-004](./decisions/004-timer-state-machine.md), [design doc](./designs/timer-state-machine.md)
- **Acceptance signal:** All state transitions match ADR-004 spec. Unit tests (PlatformIO native test runner or serial-based) pass for every valid transition and reject every invalid one. Timer correctly cycles through focus→break→focus periods.
- **Est. issues:** 5-7 (state/event enums, transition function, guard functions, configurable durations, session counting [short/long break logic], state persistence to flash, unit tests)

### 7A.4 Rotary Encoder + Vibration Motor + LED
- **What:** Implement hardware I/O drivers. Rotary encoder (KY-040): rotate to navigate menus/select goals, press to start/pause/stop. Vibration motor: buzz pattern on timer end (2N2222 transistor + 1N4148 flyback diode). LED: state indication (focusing=steady, paused=blink, idle=off). Encoder debouncing (100nF caps on CLK/DT, internal pull-up on SW).
- **Why here:** Input and feedback hardware is independent of everything except the firmware scaffold (7A.1). Can be developed and tested in isolation. **Zero TypeScript dependency.**
- **Packages/files:** `firmware/device/src/input.h`, `firmware/device/src/input.cpp`, `firmware/device/src/feedback.h`, `firmware/device/src/feedback.cpp`
- **ADR(s):** [ADR-010](./decisions/010-physical-device-hardware-platform.md)
- **Acceptance signal:** Rotate encoder → serial output shows direction + step count. Press encoder → serial output shows press event. Vibration motor buzzes on command. LED toggles on command. Debouncing eliminates false triggers on fast rotation.
- **Est. issues:** 5-7 (encoder rotation handler, encoder press handler with debouncing, vibration motor driver [transistor circuit], LED state driver, 100nF cap debouncing verification, internal pull-up on SW pin, input→timer event mapping)

### 7A.5 Protobuf Schema + Nanopb C Generation
- **What:** Define `packages/ble-protocol/proto/pomofocus.proto` with message types for Timer state, Goal, SessionSync, DeviceInfo. Generate C code via Nanopb for firmware use. Define `.options` files for static buffer sizing. The `.proto` file is the single source of truth — TypeScript and Swift generation happen later in Phase 7B.
- **Why here:** The Protobuf schema is defined from ADR-013 (fully specified message types). Nanopb C generation is a standalone `nanopb_generator` invocation — **does not need the Nx monorepo**. The generated `.pb.h` and `.pb.c` files go into `firmware/device/lib/proto/`. TS/Swift generation is deferred to 7B.1 when the monorepo package exists.
- **Packages/files:** `packages/ble-protocol/proto/pomofocus.proto`, `packages/ble-protocol/proto/pomofocus.options`, `firmware/device/lib/proto/` (generated C)
- **ADR(s):** [ADR-013](./decisions/013-ble-gatt-protocol-design.md), [ADR-015](./decisions/015-device-firmware-toolchain.md)
- **Acceptance signal:** `nanopb_generator` produces `.pb.h` and `.pb.c` files. Firmware compiles with generated code. Timer state message encodes/decodes correctly in C. Buffer sizes fit within `.options` limits.
- **Est. issues:** 4-5 (.proto schema definition, .options file for max sizes, Nanopb generation script, firmware compilation with generated code, encode/decode round-trip test in C)

### 7A.6 BLE GATT Server
- **What:** Implement BLE GATT server on EN04 using nRF52840 SoftDevice. 5 services per ADR-013: Timer Service (0x0001), Goal Service (0x0002), Session Sync Service (0x0003), Device Info (0x180A standard), DFU placeholder (Nordic standard). Custom 128-bit UUIDs. Advertising with device name + service UUIDs. Pairing: LE Secure Connections + Passkey Entry (6-digit code on e-ink display).
- **Why here:** Depends on 7A.5 (Nanopb types for characteristic values) and 7A.3 (timer states for Timer Service). Can be developed alongside 7A.2/7A.4. Testable with nRF Connect app on phone before any custom mobile code exists.
- **Packages/files:** `firmware/device/src/ble.h`, `firmware/device/src/ble.cpp`, `firmware/device/src/ble_services.h`, `firmware/device/src/ble_services.cpp`
- **ADR(s):** [ADR-013](./decisions/013-ble-gatt-protocol-design.md), [ADR-012](./decisions/012-security-data-privacy.md)
- **Acceptance signal:** Phone (nRF Connect app) discovers device, sees service UUIDs, reads Timer Service characteristics (current state, time remaining), writes commands (start/pause/stop). Pairing prompts passkey on e-ink display. Connection survives 10 minutes of idle.
- **Est. issues:** 8-10 (BLE SoftDevice init, advertising config, Timer Service characteristics [read + notify], Goal Service characteristics [write], Session Sync Service setup, Device Info service, custom UUID registration, Passkey Entry pairing, connection state management, MTU negotiation)

### 7A.7 Session Outbox (Flash Storage)
- **What:** Implement session outbox: completed sessions encoded via Nanopb, stored in nRF52840 flash (256KB available, ~2,500 sessions). Outbox drain protocol: when BLE central connects and requests Session Sync, chunked transfer with sequence numbers and application-level acks. Outbox survives power cycles.
- **Why here:** Depends on 7A.5 (Nanopb encoding) and 7A.6 (BLE GATT for transfer). This completes the device-side storage and sync story. Testable with nRF Connect (manual characteristic reads).
- **Packages/files:** `firmware/device/src/outbox.h`, `firmware/device/src/outbox.cpp`, `firmware/device/src/flash_storage.h`
- **ADR(s):** [ADR-006](./decisions/006-offline-first-sync-architecture.md), [ADR-013](./decisions/013-ble-gatt-protocol-design.md), [ADR-015](./decisions/015-device-firmware-toolchain.md)
- **Acceptance signal:** Complete 3 timer sessions on device → 3 sessions in flash outbox. Connect with nRF Connect → read Session Sync characteristic → chunked transfer delivers all 3 sessions. Power cycle device → outbox intact. Drain outbox → flash freed.
- **Est. issues:** 5-7 (flash storage abstraction, Nanopb session encoding to flash, outbox queue management, chunked transfer protocol [sequence numbers + acks], power-cycle persistence test, outbox drain + free, storage capacity monitoring)

### 7A.8 System ON Sleep + Power Management
- **What:** Implement System ON sleep with BLE SoftDevice active (~5μA MCU + ~22μA BLE advertising). Wake on: BLE connection event, rotary encoder press (GPIO interrupt), timer alarm. E-ink display hibernate during sleep. Battery monitoring via ADC.
- **Why here:** Depends on all prior firmware work being functional. Sleep mode is the final firmware optimization — the device needs to work first, then it needs to last 8-10 weeks on battery. This is the last firmware-only work item.
- **Packages/files:** `firmware/device/src/power.h`, `firmware/device/src/power.cpp`
- **ADR(s):** [ADR-010](./decisions/010-physical-device-hardware-platform.md), [ADR-015](./decisions/015-device-firmware-toolchain.md)
- **Acceptance signal:** Device enters sleep after 2 minutes of idle. BLE remains discoverable (nRF Connect still sees it). Encoder press wakes device. BLE connection wakes device. Current draw in sleep: <30μA measured with multimeter. Battery level readable via Device Info service.
- **Est. issues:** 4-5 (System ON sleep implementation, GPIO wake interrupt [encoder press], BLE event wake, display hibernate integration, battery ADC monitoring)

**Phase 7A total: ~40-53 issues**

**Phase 7A dependency graph:**
```
7A.1 (scaffold) ──┬── 7A.2 (e-ink display)
                  ├── 7A.3 (timer FSM C++)
                  ├── 7A.4 (encoder + vibration + LED)
                  └── 7A.5 (protobuf + Nanopb)
                           ↓
                       7A.6 (BLE GATT server) ← also needs 7A.3
                           ↓
                       7A.7 (session outbox)
                           ↓
                       7A.8 (sleep + power) ← needs all above
```

---

## Phase 7B: BLE Protocol + Client Integration

**Appetite:** 3 weeks (starts after Phase 0 for TS packages; client adapters start after Phase 4) | **CIRCUIT BREAKER: If end-to-end BLE sync (device → phone → API) is not working 6 weeks after Phase 7A completes, ship with device-only timer (no sync) for v1.**

**Done milestone:** Mobile app discovers the device, pairs, reads timer state, sends commands, and drains the session outbox. Synced sessions flow: device → BLE → mobile app → Hono API → Supabase. Web Bluetooth provides the same capability on Chrome. The full pipeline works end-to-end.

> **Why this is separate from 7A:** The TypeScript BLE protocol package (`packages/ble-protocol`) needs the Nx monorepo (Phase 0). The mobile BLE adapter needs the mobile app (Phase 4). But the firmware (7A) needs neither. Splitting into two tracks lets firmware development start 10+ weeks earlier.

### 7B.1 Protobuf TS/Swift Generation + packages/ble-protocol Scaffold
- **What:** Set up `packages/ble-protocol/` in the Nx monorepo. Generate TypeScript and Swift code from the `.proto` file already defined in 7A.5 (using `protoc`). Create barrel exports for generated types. Verify round-trip encoding/decoding in TypeScript.
- **Why here:** Depends on Phase 0.1 (monorepo exists) and 7A.5 (.proto file defined). The TS types enable BleTransport interface definition (7B.2) and the mobile/web adapters (7B.3, 7B.4).
- **Packages/files:** `packages/ble-protocol/src/`, `packages/ble-protocol/scripts/generate-ts.sh`, `packages/ble-protocol/scripts/generate-swift.sh`
- **ADR(s):** [ADR-013](./decisions/013-ble-gatt-protocol-design.md)
- **Acceptance signal:** `pnpm nx run @pomofocus/ble-protocol:generate` produces TypeScript and Swift code. `import { TimerState } from '@pomofocus/ble-protocol'` compiles. TS encode/decode matches C encode/decode (same bytes for same input).
- **Est. issues:** 4-5 (protoc TS generation setup, protoc Swift generation setup, barrel exports, generation script in Nx pipeline, cross-language round-trip test)

### 7B.2 BleTransport Interface + Sync Orchestration
- **What:** Implement the shared BLE abstraction in `packages/ble-protocol/`: `BleTransport` interface (connect, disconnect, read, write, subscribe, negotiateMtu) and sync orchestration (scan → connect → negotiate MTU → drain outbox → disconnect). Platform-specific transport adapters will implement this interface.
- **Why here:** Depends on 7B.1 (Protobuf TS types). The shared abstraction defines the contract that mobile and web adapters must fulfill. Testable with mock transport (no hardware needed).
- **Packages/files:** `packages/ble-protocol/src/transport.ts`, `packages/ble-protocol/src/sync-orchestrator.ts`
- **ADR(s):** [ADR-016](./decisions/016-ble-client-libraries-integration.md), [design doc](./designs/ble-client-libraries-integration.md)
- **Acceptance signal:** BleTransport interface is importable. Sync orchestrator correctly sequences: scan → connect → negotiate MTU → drain outbox → disconnect. Orchestrator tests pass with mock transport.
- **Est. issues:** 4-6 (BleTransport interface, sync orchestrator state machine, MTU negotiation protocol, mock transport for testing, orchestrator tests, error handling + retry)

### 7B.3 Mobile BLE Adapter — react-native-ble-plx
- **What:** Implement the `BleTransport` adapter using react-native-ble-plx in `packages/ble-protocol/`. Scan for PomoFocus device, connect, negotiate MTU, subscribe to Timer Service notifications, write commands, drain Session Sync outbox. Wire to sync orchestrator (7B.2). Handle pairing flow (OS-managed passkey).
- **Why here:** Depends on Phase 4 (mobile app exists) + 7B.2 (BleTransport interface) + 7A.6 (firmware GATT server to test against). This is the convergence point where firmware meets the app.
- **Packages/files:** `packages/ble-protocol/src/adapters/react-native-adapter.ts`, `apps/mobile/` (BLE UI)
- **ADR(s):** [ADR-016](./decisions/016-ble-client-libraries-integration.md)
- **Acceptance signal:** Mobile app discovers device, pairs, reads timer state, sends commands, receives session sync data. Synced sessions appear in mobile session list and upload to API. Works on real iOS and Android devices (NOT Expo Go — requires dev build).
- **Est. issues:** 8-10 (react-native-ble-plx setup, BleTransport adapter implementation, device scanning UI, connection management, Timer Service read/subscribe, command writing, Session Sync reception, Protobuf decode on mobile, sync-to-API pipeline, pairing flow handling)

### 7B.4 Web BLE Adapter — Web Bluetooth (Progressive Enhancement)
- **What:** Implement the `BleTransport` adapter using Web Bluetooth API. Same functionality as mobile adapter but for Chrome/Edge/Opera (~78% browser support). Progressive enhancement — feature-detect Web Bluetooth, show "Connect Device" only if available.
- **Why here:** Depends on Phase 1 (web app exists) + 7B.2 (BleTransport interface). Lower priority than mobile BLE but shares the protocol. Can be developed in parallel with 7B.3.
- **Packages/files:** `packages/ble-protocol/src/adapters/web-bluetooth-adapter.ts`, `apps/web/` (BLE UI)
- **ADR(s):** [ADR-016](./decisions/016-ble-client-libraries-integration.md)
- **Acceptance signal:** Chrome shows "Connect Device" button. User pairs with PomoFocus device via Web Bluetooth prompt. Timer state reads from device. Sessions sync through web. Graceful degradation on unsupported browsers.
- **Est. issues:** 4-6 (Web Bluetooth adapter, feature detection, connection UI, session sync via web, unsupported browser fallback, Chrome-specific testing)

### 7B.5 End-to-End BLE Sync Pipeline
- **What:** Integration testing of the complete sync pipeline: device completes sessions → sessions stored in flash outbox → user opens mobile app → app scans and connects via BLE → drains outbox → Protobuf decoded → sessions uploaded to Hono API → stored in Supabase → appear in session list on all platforms. Test with real hardware and real network.
- **Why here:** This is the convergence of all prior work: firmware (7A), BLE protocol (7B.1-7B.2), mobile adapter (7B.3), API (Phase 1), sync (Phase 2). The final integration test that proves the phone-away thesis.
- **Packages/files:** Integration test documentation, manual test scripts
- **ADR(s):** [ADR-006](./decisions/006-offline-first-sync-architecture.md), [ADR-013](./decisions/013-ble-gatt-protocol-design.md), [ADR-016](./decisions/016-ble-client-libraries-integration.md)
- **Acceptance signal:** Complete 5 sessions on device while phone is off. Open mobile app → device discovered → sessions sync → 5 sessions appear in app → 5 sessions visible via API. Repeat with web (Chrome Web Bluetooth). Battery level reads correctly.
- **Est. issues:** 3-4 (E2E test plan, mobile E2E sync test, web E2E sync test, edge cases [interrupted transfer, large outbox, low battery])

**Phase 7B total: ~23-31 issues**

**Phase 7B dependency graph:**
```
Phase 0.1 (monorepo) + 7A.5 (.proto file)
    ↓
7B.1 (TS/Swift protobuf gen)
    ↓
7B.2 (BleTransport + orchestrator)
    ↓
7B.3 (mobile adapter) ← needs Phase 4 (mobile app) + 7A.6 (firmware GATT)
7B.4 (web adapter)    ← needs Phase 1 (web app) + 7A.6 (firmware GATT)
    ↓
7B.5 (E2E sync test)  ← needs 7A.7 (firmware outbox) + Phase 2 (API sync)
```

---

## Phase 8: Social Features

**Appetite:** 3 weeks | **Done milestone:** Users can add friends, see who's focusing (Library Mode), send/receive encouragement taps (with push notification), view today's Quiet Feed, and share invite links. All social data is privacy-preserving (friends never see raw session data). Mobile + web only.

### 8.1 Friend Requests + Friendships
- **What:** Implement friend request flow: send request (`POST /v1/friend-requests`), accept/decline, view pending requests. Friendship creation (dual-row pattern for symmetric queries). Unfriend. 100 friend limit enforcement. Username search for adding friends.
- **Why here:** Friendships are the foundation of all social features. Library Mode, Quiet Feed, and encouragement taps all require the friendship relationship to exist.
- **Packages/files:** `apps/api/src/routes/friends.ts`, `apps/api/src/routes/friend-requests.ts`, `packages/state/src/hooks/use-friends.ts`, mobile + web UI
- **ADR(s):** [ADR-018](./decisions/018-social-features-architecture.md), [design doc](./designs/social-features-architecture.md)
- **Acceptance signal:** User A sends request to User B → B sees pending request → B accepts → mutual friendship exists. Unfriend removes both directions. 101st friend request returns error. Username search finds users.
- **Est. issues:** 8-10 (send request endpoint, accept/decline endpoints, list requests endpoint, friendship creation [dual-row], unfriend endpoint, friend limit check, username search, state hooks, friend request UI, friend list UI)

### 8.2 Library Mode (Presence)
- **What:** Implement "who's focusing now" view: `GET /v1/friends/focusing` returns friends with active sessions (sessions where `ended_at IS NULL` and `started_at > NOW() - INTERVAL '4 hours'`). Client-side countdown: `remaining = duration - (now - started_at)`. Adaptive polling: 30s → 60s after 2 minutes on screen.
- **Why here:** Library Mode is the core social feature — seeing friends focused motivates you to focus. It depends on friendships (8.1) and the sessions table serving as the presence layer.
- **Packages/files:** `apps/api/src/routes/friends.ts`, `packages/state/src/hooks/use-friends-focusing.ts`, mobile + web UI
- **ADR(s):** [ADR-018](./decisions/018-social-features-architecture.md)
- **Acceptance signal:** When Friend A is in a focus session, Friend B sees "A is focusing (18 min left)" in Library Mode. Countdown updates locally every 60s. View refreshes via polling (30s initially, 60s after 2 min). 4-hour stale session filter works.
- **Est. issues:** 5-7 (focusing friends endpoint, client-side countdown logic, adaptive polling hook, Library Mode UI [mobile], Library Mode UI [web], stale session filter, no-friends empty state)

### 8.3 Encouragement Taps
- **What:** Implement tap sending: `POST /v1/taps` sends a tap to a friend (push notification via Expo Push Service). Toggle-style (tap again to remove). Max 3 taps per day per friend pair. Taps arrive silently during active focus session (no sound, no vibration) and surface after session ends. `GET /v1/taps` returns received taps.
- **Why here:** Taps are the social interaction mechanism — the "quiet encouragement" that differentiates PomoFocus from social media. Depends on friendships (8.1) and push infrastructure (Phase 4.5).
- **Packages/files:** `apps/api/src/routes/taps.ts`, `packages/state/src/hooks/use-taps.ts`, mobile + web UI
- **ADR(s):** [ADR-018](./decisions/018-social-features-architecture.md), [ADR-019](./decisions/019-notification-strategy.md)
- **Acceptance signal:** User A taps User B → B receives push notification (silent if focusing). Tap again → tap removed. 4th tap in same day returns error. Taps received during focus session appear after session ends. Tap list shows who sent taps today.
- **Est. issues:** 6-8 (send tap endpoint + Expo Push call, remove tap endpoint, rate limiting [3/day/pair], silent delivery during focus, tap list endpoint, tap notification handling on mobile, tap UI [mobile], tap UI [web])

### 8.4 Quiet Feed
- **What:** Implement "today's activity" feed: `GET /v1/feed/today` returns which friends focused today (binary yes/no, no session details). Fetch-once + pull-to-refresh (data changes every ~25 min). No real-time updates — polling only.
- **Why here:** The Quiet Feed is the passive social surface — "who focused today." It's the least interactive social feature and depends on friendships (8.1).
- **Packages/files:** `apps/api/src/routes/feed.ts`, `packages/state/src/hooks/use-feed.ts`, mobile + web UI
- **ADR(s):** [ADR-018](./decisions/018-social-features-architecture.md)
- **Acceptance signal:** Feed shows "Alice focused today" and "Bob focused today" (no session details). Pull-to-refresh updates the feed. Empty state for no friends or no activity today.
- **Est. issues:** 3-5 (feed endpoint, feed hook [fetch-once + pull-to-refresh], feed UI [mobile], feed UI [web], empty states)

### 8.5 Invite Links
- **What:** Implement stateless invite links: `/invite/USERNAME` (no tokens, no expiry). When a logged-in user visits the link, they send a friend request to that username. When a logged-out user visits, they're prompted to sign up first, then the friend request is sent post-signup.
- **Why here:** Invite links are the growth mechanism. They're simple (stateless, no token management) and depend on friend requests (8.1).
- **Packages/files:** `apps/api/src/routes/invite.ts`, `apps/web/app/invite/[username].tsx`, `apps/mobile/app/invite/[username].tsx`
- **ADR(s):** [ADR-018](./decisions/018-social-features-architecture.md)
- **Acceptance signal:** Visit `/invite/alice` while logged in → friend request sent to alice. Visit while logged out → redirect to signup → after signup, friend request sent. Invalid username shows error.
- **Est. issues:** 3-4 (invite endpoint/redirect, web invite page, mobile deep link handling, post-signup friend request flow)

**Phase 8 total: ~25-34 issues**

---

## Phase 9: Polish + Ship

**Appetite:** 2 weeks | **Done milestone:** Onboarding flow guides new users. GDPR endpoints work (data export + account deletion). User preferences are configurable. Sentry captures errors. The app is ready for beta users.

### 9.1 Onboarding Flow
- **What:** Build the new-user onboarding experience: welcome screen → create first long-term goal → set up first process goal → start first timer. Progressive disclosure — don't overwhelm with settings. Notification permission requested during first timer creation (not during onboarding).
- **Why here:** Onboarding is built last (product brief guidance) because it's the last thing experienced by users but the first thing designed. It can only be built after all the features it introduces exist.
- **Packages/files:** `apps/web/` (onboarding screens), `apps/mobile/` (onboarding screens)
- **ADR(s):** Product brief (onboarding section)
- **Acceptance signal:** New user sees onboarding flow on first launch. Flow guides through goal creation and first timer. Returning users skip onboarding. Onboarding is completable in < 2 minutes.
- **Est. issues:** 5-7 (welcome screen, goal creation step, process goal step, first timer start, onboarding completion flag, mobile onboarding, web onboarding)

### 9.2 GDPR Endpoints
- **What:** Implement `DELETE /v1/me` (cascade delete all user data) and `GET /v1/me/export` (JSON download of all user data). Cascade delete removes: profile, preferences, goals, sessions, breaks, devices, sync log, friend requests, friendships, taps. Export returns all the same data as JSON. 30-day backup purge via CF Cron Trigger.
- **Why here:** GDPR compliance is required before any EU user data is collected. These endpoints should be available at launch, not added retroactively.
- **Packages/files:** `apps/api/src/routes/me.ts`, `supabase/migrations/` (cascade rules if not already in place)
- **ADR(s):** [ADR-012](./decisions/012-security-data-privacy.md)
- **Acceptance signal:** `DELETE /v1/me` removes all user data (verified by querying all 12 tables). `GET /v1/me/export` returns complete JSON with all user data. No orphaned records after deletion.
- **Est. issues:** 4-5 (DELETE endpoint with cascade, export endpoint, cascade verification tests, cron trigger for backup purge, export format validation)

### 9.3 User Preferences
- **What:** Implement user preferences UI and API: timer durations (focus, short break, long break), timezone, reflection enabled/disabled, notification settings (goal nudge time, weekly summary day/time), sessions before long break count.
- **Why here:** Users have been using default settings through all testing phases. Now that the full feature set exists, they need to customize their experience.
- **Packages/files:** `apps/api/src/routes/settings.ts`, `packages/state/src/hooks/use-preferences.ts`, mobile + web settings screens
- **ADR(s):** [ADR-005](./decisions/005-database-schema-data-model.md)
- **Acceptance signal:** User changes focus duration from 25 to 50 minutes → next timer uses 50 minutes. Disable reflection → reflection step is skipped. Change timezone → streak calculation uses new timezone. All preferences sync across devices.
- **Est. issues:** 5-7 (preferences API endpoint, preferences state hook, timer duration settings UI, notification settings UI, reflection toggle, timezone selector, preferences sync)

### 9.4 Sentry Integration
- **What:** Add Sentry free tier (5K errors, 50 replays/month) for client-side error tracking. Initialize in app entry points (`apps/web`, `apps/mobile`). Configure source maps for TypeScript. Strip PII from error reports. Never add Sentry to shared packages (`packages/`).
- **Why here:** Sentry is added at first staging deploy (ADR-011). By this phase, both web and mobile are deployed to staging environments. Error tracking is essential for beta quality.
- **Packages/files:** `apps/web/` (Sentry init), `apps/mobile/` (Sentry init)
- **ADR(s):** [ADR-011](./decisions/011-monitoring-observability.md)
- **Acceptance signal:** Intentional error in web app appears in Sentry dashboard with source-mapped stack trace. Intentional error in mobile app appears in Sentry with symbolicated stack trace. No PII in error reports.
- **Est. issues:** 3-4 (Sentry web setup, Sentry mobile setup, source map configuration, PII stripping verification)

### 9.5 Web App Polish + Refactor
- **What:** Refactor web app to use shared `packages/ui` components (replacing inline UI from Phase 1-3). Responsive layout. Accessibility basics (ARIA labels, keyboard navigation). Loading states. Error boundaries.
- **Why here:** The web app was built incrementally — timer first, then auth, then goals, then analytics. Now it needs a polish pass to feel like a cohesive product before beta launch.
- **Packages/files:** `apps/web/` (refactored screens), `packages/ui/`
- **ADR(s):** —
- **Acceptance signal:** Web app uses shared components from `packages/ui`. Responsive on mobile and desktop widths. Basic keyboard navigation works. Loading and error states display correctly.
- **Est. issues:** 5-7 (migrate to shared components, responsive layout, accessibility pass, loading states, error boundaries, visual consistency check, performance audit)

**Phase 9 total: ~22-30 issues**

---

## Risk Register

| # | Risk | Phase | Likelihood | Impact | Mitigation |
|---|------|-------|-----------|--------|------------|
| 1 | **BLE firmware integration fails** — EN04 board + e-ink + BLE + rotary encoder don't play well together | Phase 7A | Medium | Critical | Phase 7A starts day 1, so failures surface in weeks 1-4 (not weeks 16+). 4-week circuit breaker on standalone device; 6-week circuit breaker on BLE sync. Fallback: device-only timer (no sync) for v1. |
| 2 | **E-ink partial refresh artifacts** — GDEQ0426T82 shows ghosting or inconsistent partial refresh | Phase 7A.2 | Medium | Medium | Validated in week 1-2 (not month 4). Full refresh every ~5 partials. Fall back to full refresh only if needed (slower but correct). |
| 3 | **react-native-ble-plx + Expo managed workflow** — BLE requires dev builds, no Expo Go | Phase 7B.3 | Low | Medium | Known limitation (ADR-016). Firmware GATT server can be validated with nRF Connect long before mobile adapter is built. EAS Build for test devices. |
| 4 | **Offline sync edge cases** — conflict resolution, queue ordering, idempotency failures | Phase 2 | Low | High | Extensive unit tests on core sync FSM. Server-side `ON CONFLICT DO NOTHING` as safety net. UUID idempotency is the primary defense. |
| 5 | **iOS widget data freshness** — UserDefaults writes not triggering widget refresh reliably | Phase 6 | Low | Low | `WidgetCenter.reloadAllTimelines()` is the documented approach. Fallback: time-based refresh interval. |
| 6 | **Supabase Auth edge cases** — token refresh race conditions, deferred sign-up complexity | Phase 2 | Low | Medium | Use Supabase Auth SDK as documented. Deferred sign-up is a Supabase feature. Test token refresh under poor network conditions. |
| 7 | **Nanopb static buffer overflow** — Protobuf messages exceed allocated buffer size on MCU | Phase 7 | Low | Medium | Define max message sizes in `.options` files. Test with maximum-size messages. Monitor buffer usage in firmware. |

---

## Post-v1 Parking Lot

Items explicitly deferred from v1, with ADR references. These become the backlog for future phases.

| Item | ADR | Rationale for Deferral |
|------|-----|----------------------|
| Apple Watch app (watchOS 10+) | ADR-010 | Companion app complexity; core product doesn't depend on it |
| macOS menu bar widget (SwiftUI + MenuBarExtra) | ADR-010 | Native Swift; needs CoreBluetooth for BLE (ADR-016 defers) |
| VS Code extension | ADR-001 | Thin client over API; stable API required first |
| Claude Code MCP server | ADR-001 | Thin client over API; stable API required first |
| Background BLE sync | ADR-016 | iOS kills background BLE after 30s-3min; complex and unreliable |
| Live Activity (Dynamic Island / Lock Screen) | ADR-017 | Would show real-time timer; risks inconsistency with BLE device |
| WebSocket presence for Library Mode | ADR-008, ADR-018 | Polling works for v1; WebSocket adds complexity with no user-facing gain |
| Pre-aggregation / materialized views | ADR-014 | Per-user queries over ~365 rows are fast enough (<100ms) |
| Cross-user analytics | ADR-014 | Requires server-side aggregation; no v1 use case |
| Langfuse observability | ADR-011 | Deferred until MCP server built and pain point arises |
| Advanced BLE security (Secure Connections Only, GATT encryption, MAC rotation) | ADR-012 | LE Secure Connections + Passkey Entry sufficient for v1 |
| Hybrid sleep on device (System ON daytime + System OFF overnight) | ADR-015 | System ON sleep provides adequate battery life (~8-10 weeks) |
| Web Push notifications | ADR-019 | ~6% opt-in rate; not worth service worker complexity |
| BLE encouragement tap vibration | ADR-019 | Requires additional GATT characteristic; defer to v2 |
| Railway / always-on server | ADR-008 | No v1 use case; CF Workers + Cron Triggers are sufficient |
| Supabase Realtime WebSockets | ADR-003 | Polling-first (30s) is sufficient; no real-time UI requirement |

---

## Summary

| Phase | Name | Appetite | Est. Issues | Starts | Critical Path? |
|-------|------|----------|-------------|--------|---------------|
| 0 | Foundation | 2 weeks | 35-47 | Day 1 | **Yes** — blocks TS pipeline |
| 7A | Device Firmware | 6 weeks | 40-53 | **Day 1** (parallel with Phase 0) | No — independent C++ track |
| 1 | Walking Skeleton | 3 weeks | 36-49 | After Phase 0 | **Yes** — proves architecture |
| 2 | Auth + Sync + Goals | 3 weeks | 38-50 | After Phase 1 | **Yes** — enables user data |
| 3 | Session Lifecycle | 2 weeks | 21-29 | After Phase 2 | **Yes** — core product experience |
| 4 | Mobile App | 3 weeks | 29-39 | After Phase 3 | Partial — mobile is v1 target |
| 5 | Analytics | 2 weeks | 19-26 | After Phase 3 | No — parallelizable with Phase 4 |
| 6 | iOS Widget | 2 weeks | 12-16 | After Phase 5 | No — parallelizable |
| 7B | BLE Client Integration | 3 weeks | 23-31 | After Phase 0 (adapters after Phase 4) | No — circuit breaker applies |
| 8 | Social Features | 3 weeks | 25-34 | After Phase 2 | No — parallelizable |
| 9 | Polish + Ship | 2 weeks | 22-30 | After all above | **Yes** — gate to launch |
| **Total** | | | **~300-404** | | |

> **Note on timeline:** The critical path for the TypeScript pipeline is Phases 0→1→2→3→4→9 (~15 weeks serial). But Phase 7A (firmware) runs **entirely in parallel from day 1** — by the time the mobile app exists (end of Phase 4), the firmware should have a working standalone device with BLE GATT server ready for integration.
>
> **Effective timeline with parallelism:**
> - Weeks 1-2: Phase 0 (TS foundation) + Phase 7A.1-7A.4 (firmware scaffold, display, timer, encoder)
> - Weeks 3-5: Phase 1 (walking skeleton) + Phase 7A.5-7A.6 (protobuf, GATT server)
> - Weeks 6-8: Phase 2 (auth, sync, goals) + Phase 7A.7-7A.8 (outbox, sleep) + Phase 7B.1-7B.2 (TS BLE package)
> - Weeks 9-10: Phase 3 (session lifecycle) + Phase 8 (social — can overlap)
> - Weeks 11-13: Phase 4 (mobile) + Phase 5 (analytics — parallel)
> - Weeks 14-15: Phase 7B.3-7B.5 (BLE client integration) + Phase 6 (iOS widget)
> - Weeks 16-17: Phase 9 (polish + ship)
>
> **~17 weeks with full parallelism** (vs 30+ weeks serial). Firmware de-risking happens during the first 8 weeks while TS infrastructure is being built.
