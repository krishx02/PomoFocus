# ADR-014: Analytics & Insights Architecture

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container)
**Platforms:** All (web, iOS/Android, VS Code extension, macOS widget, Apple Watch, Claude Code MCP, BLE device)

## Context and Problem Statement

PomoFocus needs to compute and deliver analytics — session completion rate, focus quality trends, consistency, streaks, and per-goal breakdowns — across all platforms. Platforms range from a web app with rich charts to a BLE e-ink device showing only three simple counters. The architecture must decide: what metrics to compute, where computation happens (client vs server), whether to pre-aggregate, and how constrained platforms (BLE device, Apple Watch) get their data.

## Decision Drivers

- **Scientific grounding** — Metrics must be rooted in behavior-change research (Self-Determination Theory, Pomodoro effectiveness studies), not arbitrary gamification
- **Simplicity** — Solo developer, no always-on server (ADR-008), minimize infrastructure
- **Cross-platform consistency** — All platforms show the same numbers from the same source of truth
- **Testability** — Analytics formulas must be unit-testable pure functions
- **Device constraints** — BLE device and Apple Watch need lightweight, pre-computed payloads

## Considered Options

1. Compute on demand in CF Worker (inline formulas in API)
2. Pre-compute via CF Cron Trigger (nightly aggregation to summary table)
3. Compute client-side in `packages/analytics/`
4. Hybrid — formulas in `packages/analytics/`, executed server-side in CF Worker API

## Decision Outcome

Chosen option: **"Hybrid — formulas in `packages/analytics/`, executed server-side"**, because it provides a single source of truth for computation logic (testable pure functions in a shared package), server-side execution (lightweight client responses), and aligns with the existing monorepo structure (ADR-001 already defines `packages/analytics/`). No new infrastructure needed — no cron jobs, no materialized views, no summary tables at v1 scale.

### Metric Framework

**No composite Focus Score.** Instead, individual component metrics with trend arrows. Research basis: composite scores with arbitrary weights undermine autonomy (SDT) and create extrinsic motivation that erodes when novelty wears off. Component metrics let users decide what matters to them.

**Tier 1 — Glanceable (device + app home screen):**
- Today's goal progress — "Study calculus — 1/3" (competence)
- Weekly continuity — dots for each day this week with sessions (competence)
- Current streak — consecutive days with sessions (competence)

**Tier 2 — Weekly insights (app only):**
- Session completion rate — finished / (total − had_to_stop); returns 0 when denominator is 0
- Focus quality distribution — % locked_in vs decent vs struggled
- Total focus time — sum of session durations
- Peak focus window — time-of-day with best focus_quality
- Per-goal breakdown — time and sessions per process goal

**Tier 3 — Monthly trends (app only):**
- Consistency trend — % of days with sessions, this month vs last
- Completion trend — rate change month over month
- Focus quality trend — % locked_in change month over month
- Total focus time trend — hours change month over month
- Distraction patterns — most common distraction_type

### Computation Architecture

- **`packages/analytics/`** contains pure TypeScript functions for all metric computations. Depends on `@pomofocus/types` and `@pomofocus/core` only (ADR-001). No IO, no React, no Supabase imports.
- **Hono API (`apps/api/`)** imports `packages/analytics/` and executes formulas against SQL query results. Exposes analytics endpoints for each tier.
- **Clients** call API endpoints and render pre-computed results. No client-side computation of analytics.
- **BLE device** receives Tier 1 counters via BLE sync from the phone (ADR-013 Goal Service: `target_sessions`, `completed_sessions`).
- **Apple Watch** shows cached analytics from last API sync + local simple counters (sessions today). No local analytics computation — stale cached data is acceptable between syncs.

### Consequences

- **Good:** Single source of truth for formulas (packages/analytics/). All platforms get consistent numbers. No new infrastructure. Testable with unit tests. Aligns with existing ADR-001 package structure.
- **Bad:** packages/analytics/ adds package overhead for relatively simple arithmetic functions. Every analytics page load hits the database (no pre-computation). Apple Watch shows stale analytics between syncs.
- **Neutral:** If offline mobile analytics becomes needed, packages/analytics/ can be imported directly by the Expo app. CF Cron pre-computation can be added later if query performance degrades at scale.

## Pros and Cons of the Options

### Compute on demand in CF Worker (inline)
- Good, because simplest possible architecture — zero packages, zero infrastructure
- Good, because always up-to-date, no stale caches
- Bad, because formulas are locked inside API route handlers, not reusable or independently testable
- Bad, because duplicating formulas for offline mobile analytics would require extraction later anyway

### Pre-compute via CF Cron Trigger
- Good, because analytics reads are instant (pre-computed values in a table)
- Good, because BLE device sync payload can pull from pre-computed table
- Bad, because new table + cron job + failure mode for v1 when per-user queries are already milliseconds
- Bad, because data is stale up to 24 hours (Source: ADR-008 confirms per-user queries over ~365 rows run in milliseconds — pre-computation is premature optimization)

### Compute client-side in packages/analytics/
- Good, because formulas are maximally portable — same code runs in tests, browser, potentially firmware
- Good, because reduces API surface area (one "get sessions" endpoint)
- Bad, because sends more data over the wire (all sessions vs pre-computed results)
- Bad, because BLE device can't run TypeScript — still needs pre-computed data from phone
- Bad, because battery impact on mobile and Watch from local computation

### Hybrid — formulas in packages/analytics/, executed server-side
- Good, because single source of truth for formulas with unit tests
- Good, because server-side execution means lightweight client responses
- Good, because aligns with ADR-001 monorepo structure (packages/analytics/ already defined)
- Good, because can shift to client-side execution later for offline scenarios without rewriting formulas
- Bad, because adds a package boundary for functions that are simple arithmetic
- Bad, because formula changes require API redeploy

## Research Sources

- [Designing for Sustained Motivation: SDT in Behaviour Change Technologies](https://academic.oup.com/iwc/advance-article/doi/10.1093/iwc/iwae040/7760010) — Oxford Academic, 2024. Found most BCTs optimize engagement with the app, not the behavior. Informed decision to avoid composite Focus Score.
- [Systematic Review of Goals for Behavior Change](https://dl.acm.org/doi/full/10.1145/3706598.3714072) — CHI 2025. HCI research skewed toward quantitative, extrinsic goals. Opportunity in qualitative, intrinsic goals. Informed tier structure.
- [Framework of the Lived Experience of Metrics](https://dl.acm.org/doi/full/10.1145/3706598.3713650) — CHI 2025. Users create "metric ecologies" they adjust to life circumstances. Supports component metrics over single scores.
- [Time to Form a Habit: Meta-Analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC11641623/) — Healthcare, 2024. Consistency (habit formation) is the key behavioral dimension, not raw volume.
- Self-Determination Theory (Deci & Ryan) — Autonomy, competence, relatedness as innate psychological needs. Composite scores with arbitrary weights undermine autonomy.

## Related Decisions

- [ADR-001](./001-monorepo-package-structure.md) — Defines `packages/analytics/` in the dependency graph (depends on `types/` and `core/` only)
- [ADR-002](./002-auth-architecture.md) — Auth model; analytics endpoints use `userId` from authenticated session
- [ADR-003](./003-client-state-management.md) — TanStack Query for server state; clients poll analytics endpoints
- [ADR-005](./005-database-schema-data-model.md) — Sessions table schema (the raw data analytics computes over)
- [ADR-007](./007-api-architecture.md) — All client traffic through Hono API on CF Workers
- [ADR-008](./008-long-lived-processes.md) — No always-on server; per-user queries run in milliseconds
- [ADR-013](./013-ble-gatt-protocol-design.md) — BLE GATT Goal Service provides device Tier 1 counters
- [ADR-017](./017-ios-widget-architecture.md) — iOS widget displays Tier 1 stats via App Group UserDefaults
- [ADR-018](./018-social-features-architecture.md) — social features are a separate surface from analytics; Tier 1 stats are personal, not social
- [ADR-019: Notification Strategy](./019-notification-strategy.md) — weekly summary notification links to Tier 2 analytics insights
