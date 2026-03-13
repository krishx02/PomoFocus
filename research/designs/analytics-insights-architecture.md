# Design: Analytics & Insights Architecture

**Date:** 2026-03-09
**Status:** Accepted
**Related ADR:** [ADR-014](../decisions/014-analytics-insights-architecture.md)
**Platforms:** All (web, iOS/Android, VS Code extension, macOS widget, Apple Watch, Claude Code MCP, BLE device)

## Context & Scope

PomoFocus records focus sessions with 8 data points each (started_at, ended_at, completed, abandonment_reason, focus_quality, distraction_type, intention_text, process_goal_id). Users need to see meaningful analytics derived from this data — but "meaningful" varies dramatically by platform: the web app can render rich charts, the Apple Watch shows a complication, and the BLE e-ink device has a 800×480 monochrome display that sits on a desk all day.

The analytics architecture must decide: what to compute, where computation runs, how to serve platforms with vastly different capabilities, and — most fundamentally — which metrics are worth showing based on behavioral science research.

## Goals & Non-Goals

**Goals:**

- Define a scientifically grounded metric framework (rooted in SDT and Pomodoro research)
- Establish where analytics computation lives in the monorepo (`packages/analytics/`)
- Define API contract for analytics endpoints (three tiers of detail)
- Specify what constrained platforms (BLE device, Apple Watch) receive
- Keep infrastructure simple — no cron jobs, no materialized views, no summary tables at v1

**Non-Goals:**

- Cross-user analytics or leaderboards (explicitly excluded — undermines autonomy per SDT)
- Composite "Focus Score" (rejected — see "Alternatives Considered")
- Pre-aggregation infrastructure (premature — per-user queries over ~365 rows are milliseconds)
- Client-side analytics computation (server is the single source of truth)
- Swift/C++ port of analytics formulas (Apple Watch and device use cached/synced values)

---

## The Design

### Metric Framework (Three Tiers)

The framework is grounded in Self-Determination Theory (Deci & Ryan), which identifies three innate psychological needs: **autonomy** (I choose my goals), **competence** (I see myself improving), **relatedness** (I'm not alone). Each metric maps to one of these needs.

#### Tier 1 — Glanceable (all platforms)

Designed for the BLE device idle display, Apple Watch complications, and app home screens. Must be comprehensible in <1 second.

| Metric            | Computation                                                                  | SDT Need   | Display                                  |
| ----------------- | ---------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| Goal progress     | `sessions_today / target_sessions_per_day` for active process goal           | Competence | "Study calculus — 1/3"                   |
| Weekly continuity | Boolean per day: any completed session that day                              | Competence | 7 dots (Mon–Sun), filled for active days |
| Current streak    | Count consecutive calendar days (in user timezone) with ≥1 completed session | Competence | "5 days"                                 |

**Streak Specification:**

- **Grace period:** A streak tolerates exactly 1 missed day. Two consecutive missed days resets the streak. Implementation: `currentStreak()` counts backward from today, allowing at most 1 gap day between any two active days. Gap days do not count toward streak length. (Product brief: "one missed day shouldn't reset a 30-day streak.")
- **Scope:** Account-wide for v1. A streak means "≥1 completed session on this calendar day, for any goal." Per-goal streaks are a post-v1 enhancement. The `currentStreak()` function in `packages/analytics/` takes all sessions, not sessions for a specific goal.
- **Day boundary:** Midnight-to-midnight in the user's configured timezone (from `user_preferences.timezone`).
- **Timezone changes:** Use the user's configured timezone at query time. If they change timezone (e.g., travel), the streak may retroactively recalculate — acceptable tradeoff for simplicity. No per-session timezone tracking.

**BLE device receives Tier 1 via BLE sync** (ADR-013 Goal Service: `target_sessions`, `completed_sessions` fields). The phone computes and pushes these values during sync.

**Apple Watch shows Tier 1 from local counters** (sessions today, streak) + cached values from last API sync.

#### Tier 2 — Weekly Insights (app only)

Shown on a weekly insights card. Updated each time the user opens the analytics screen.

| Metric                     | Computation                                                           | Notes                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session completion rate    | `completed / (total − had_to_stop)` (returns 0 when denominator is 0) | "Had to stop" is excluded per business rule (not a failure). Sessions with `abandonment_reason = NULL` are treated as `gave_up` for this calculation (prevents gaming by dismissing the prompt). |
| Focus quality distribution | Count per enum value / total completed                                | Three-segment bar: locked_in / decent / struggled                                                                                                                                                |
| Total focus time           | `SUM(ended_at − started_at)` for completed sessions                   | In hours and minutes                                                                                                                                                                             |
| Peak focus window          | Hour-of-day bucket with highest avg focus_quality                     | "Your best focus is 9–10am"                                                                                                                                                                      |
| Per-goal breakdown         | Group by process_goal_id                                              | Time and sessions per goal                                                                                                                                                                       |

#### Tier 3 — Monthly Trends (app only)

Shown on a monthly deep view. Compares current month vs previous month.

| Metric               | Computation                                                  | Display                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistency trend    | `days_with_sessions / total_days`, current vs previous month | Percentage + ↑↓→ arrow                                                                                                                                                                                                                                                                                            |
| Completion trend     | Completion rate change month over month                      | Percentage + arrow                                                                                                                                                                                                                                                                                                |
| Focus quality trend  | % locked_in change month over month                          | Percentage + arrow                                                                                                                                                                                                                                                                                                |
| Total time trend     | Hours change month over month                                | Hours + arrow                                                                                                                                                                                                                                                                                                     |
| Distraction patterns | Most common distraction_type this month                      | Category name + count. Taxonomy is a closed 5-value enum for v1 (phone, people, thoughts_wandering, got_stuck, other). "Other" is counted in frequency but not surfaced as an actionable insight — if >40% of struggled sessions select "other", that signals the taxonomy needs a new category via DB migration. |
| Per-goal breakdown   | Same as Tier 2 but for the month                             | Per-goal bars                                                                                                                                                                                                                                                                                                     |

### Computation Architecture

```
┌─────────────────────────────────────────────────┐
│                  packages/analytics/             │
│  Pure TypeScript functions. No IO. No React.     │
│  Depends on: @pomofocus/types, @pomofocus/core   │
│                                                  │
│  completionRate(sessions) → number               │
│  focusQualityDistribution(sessions) → {...}      │
│  weeklyConsistency(sessions, timezone) → bool[]  │
│  currentStreak(sessions, timezone) → number      │
│  peakFocusWindow(sessions) → { hour, avg }       │
│  monthlyTrend(current, previous) → TrendResult   │
│  tierOneMetrics(sessions, goals) → Tier1         │
│  tierTwoMetrics(sessions, goals) → Tier2         │
│  tierThreeMetrics(current, prev, goals) → Tier3  │
└────────────────────────┬────────────────────────┘
                         │ imported by
                         ▼
┌─────────────────────────────────────────────────┐
│              apps/api/ (Hono on CF Workers)       │
│                                                  │
│  GET /v1/analytics/glanceable                    │
│    → queries sessions (today + this week)         │
│    → calls tierOneMetrics()                       │
│    → returns { goalProgress, weeklyDots, streak } │
│                                                  │
│  GET /v1/analytics/weekly                        │
│    → queries sessions (this week)                 │
│    → calls tierTwoMetrics()                       │
│    → returns { completion, quality, time, ... }   │
│                                                  │
│  GET /v1/analytics/monthly?month=2026-03         │
│    → queries sessions (this month + last month)   │
│    → calls tierThreeMetrics()                     │
│    → returns { trends, distractions, goals }      │
└─────────────────────────────────────────────────┘
```

### Data Flow Per Platform

| Platform           | Tier 1             | Tier 2     | Tier 3 | Source                         |
| ------------------ | ------------------ | ---------- | ------ | ------------------------------ |
| Web app            | ✓                  | ✓          | ✓      | API calls                      |
| iOS/Android (Expo) | ✓                  | ✓          | ✓      | API calls via TanStack Query   |
| macOS menu bar     | ✓                  | —          | —      | API call (polls on focus)      |
| Apple Watch        | ✓ (cached + local) | ✓ (cached) | —      | API sync when phone connected  |
| VS Code extension  | ✓                  | ✓          | —      | API calls                      |
| Claude Code MCP    | ✓                  | ✓          | —      | API calls                      |
| BLE device         | ✓ (synced)         | —          | —      | Phone pushes via BLE (ADR-013) |

### Key Design Decisions

| Decision                 | Chosen                                                 | Rejected                               | Why                                                                                                                      |
| ------------------------ | ------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Composite Focus Score    | **No** — component metrics with trends                 | Single composite number                | Arbitrary weights undermine autonomy (SDT). Component trends are more informative and less judgmental.                   |
| Computation location     | **Server-side** (API imports analytics package)        | Client-side or pre-computed            | Server is single source of truth. No stale caches. Lightweight client responses.                                         |
| Pre-aggregation          | **None at v1**                                         | Materialized views, cron summary table | Per-user queries over ~365 session rows run in milliseconds (ADR-008). Premature optimization.                           |
| Streak display on device | **Yes** (simple counter)                               | No streak on device                    | User requested. Design review recommends softening with weekly dots alongside.                                           |
| Watch analytics          | **Cached from last API sync**                          | Local Swift computation                | Avoids maintaining Swift port of formulas. Analytics changes slowly (once per ~25min session). Stale data is acceptable. |
| Timezone handling        | **User's configured timezone** (from user_preferences) | UTC everywhere                         | Calendar-day metrics (streak, daily count) must align with user's local midnight.                                        |

### Cold Start Strategy

New users have no session history. The analytics tiers handle this gracefully:

- **Tier 1:** "Study calculus — 0/3" + empty weekly dots + "0 days" streak. All valid from day one, no special case needed.
- **Tier 2:** Unlocked after ≥1 completed session all-time (not per-week). Individual metrics within Tier 2 handle sparse data independently:
  - Completion rate: valid with ≥1 session
  - Focus quality distribution: valid with ≥1 completed session that has reflection data
  - Peak focus window: requires ≥5 sessions with `focus_quality` data to be statistically meaningful. Below this threshold, show "Not enough data yet" for this specific metric.
  - Total focus time and per-goal breakdown: valid with ≥1 session
- **Tier 3:** Requires ≥2 calendar months each containing ≥1 completed session. Not 60+ days. Not required to be consecutive. If sessions exist in January and March but not February, Tier 3 can compare January vs March. The purpose is month-over-month comparison, which requires data in at least 2 distinct months.

No fake data, no placeholder scores, no gamification hooks. Emptiness communicates "you haven't started yet" without shame.

### API Response Shapes (Draft)

```typescript
// GET /v1/analytics/glanceable
interface GlanceableResponse {
  goalProgress: {
    goalId: string;
    goalTitle: string;
    completedToday: number;
    targetToday: number;
  }[];
  weeklyDots: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun] — ISO 8601 Monday-start week
  currentStreak: number; // consecutive days
}

// GET /v1/analytics/weekly
interface WeeklyResponse {
  completionRate: number; // 0–1
  focusQuality: {
    lockedIn: number; // count
    decent: number;
    struggled: number;
  };
  totalFocusMinutes: number;
  peakFocusWindow: { hour: number; avgQuality: number } | null;
  perGoal: {
    goalId: string;
    goalTitle: string;
    sessions: number;
    focusMinutes: number;
  }[];
  sessionCount: number;
}

// GET /v1/analytics/monthly?month=2026-03
interface MonthlyResponse {
  trends: {
    consistency: { current: number; previous: number }; // 0–1
    completionRate: { current: number; previous: number };
    focusQuality: { current: number; previous: number }; // % locked_in
    totalHours: { current: number; previous: number };
  };
  topDistraction: { type: string; count: number } | null;
  perGoal: {
    goalId: string;
    goalTitle: string;
    sessions: number;
    focusMinutes: number;
  }[];
}
```

## Alternatives Considered

### Composite Focus Score

Rejected. A single weighted number (e.g., 30% completion + 25% quality + 25% consistency + 20% trend) has no scientific basis for specific weights, creates an extrinsic motivator that can undermine intrinsic motivation (SDT), and positions the app as a judge. The formula is also circular: self-reported focus quality scored into a metric about focus quality adds no information. Component metrics with trend arrows provide the same insight without the judgment.

### Pre-computed Aggregates via Cron

Rejected for v1. ADR-008 confirms per-user analytics queries over ~365 rows run in milliseconds within a CF Worker. A cron job adding a summary table introduces a new failure mode, stale data (up to 24 hours), and linear scaling across all users — all to optimize something that isn't slow. Can be added later if query performance degrades at scale (the database schema design doc already anticipates this: "add materialized view later if needed").

### Client-side Computation

Rejected as primary strategy. Sends more data over the wire. BLE device can't run TypeScript. Apple Watch would need a Swift port. Multiple clients computing the same formulas creates consistency risk. However, `packages/analytics/` being pure functions means it _can_ be imported client-side for offline scenarios in the future — the architecture doesn't prevent this.

### Cross-user Analytics

Explicitly excluded. Leaderboards and peer comparisons undermine the autonomy need in SDT and contradict PomoFocus's non-judgmental design philosophy. The CHI 2025 goals meta-analysis found that social comparison in quantified-self apps is associated with decreased intrinsic motivation.

## Cross-Cutting Concerns

- **Security:** Analytics endpoints return only the authenticated user's data. RLS on the sessions table (ADR-005) ensures the API can only query the user's own rows. No cross-user data exposure. BLE Tier 1 data is encrypted via LE Secure Connections (ADR-012).

- **Cost:** At v1 scale, all queries are per-user over ~365 rows, indexed on `(user_id, started_at)`. No additional database cost. At 100K users, queries remain independent (no aggregation across users). The only scaling cliff would be cross-user analytics, which is explicitly excluded.

- **Observability:** Analytics endpoint latency monitored via CF Workers dashboard (ADR-011). If p99 latency exceeds 200ms, that's the signal to add pre-aggregation. No Sentry needed for analytics specifically — covered by per-platform Sentry integration at first staging deploy.

- **Migration path:** No migration needed — this is greenfield. If pre-aggregation is needed later, add a `daily_analytics` table populated by a CF Cron Trigger, and have the API read from that table instead of computing on demand. The `packages/analytics/` functions remain unchanged — only the data source changes.

## Resolved Questions

1. ~~**Streak timezone edge case**~~ — **Resolved.** Use the user's configured timezone at query time. A timezone change retroactively recalculates the streak — acceptable tradeoff. See "Streak Specification" under Tier 1 above for full details (grace period, scope, day boundary).

2. ~~**Weekly dot definition**~~ — **Resolved.** ≥1 completed session on that calendar day. Consistency means finishing, not just starting.

## Open Questions

1. **Peak focus window granularity:** 1-hour buckets or 2-hour buckets? Narrower is more precise but requires more data to be meaningful. Recommendation: 2-hour buckets for v1, narrowing to 1-hour when more data exists.

2. **Analytics for archived goals:** When a process goal is "retired", should its sessions still appear in analytics? Recommendation: yes for historical views (monthly trends), no for current "today's goal progress."
