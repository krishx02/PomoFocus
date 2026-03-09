# ADR-011: Monitoring & Observability Strategy

**Status:** Accepted
**Date:** 2026-03-08
**Decision-makers:** Project lead
**Zoom level:** Level 3–4 (tooling/pattern)
**Platforms:** All (iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device)

## Context and Problem Statement

PomoFocus targets 9+ platforms. As a solo side project with $0/month budget, the question is: how much observability effort is warranted, and what's the minimum viable stack? The answer depends on what the existing infrastructure providers already give for free.

## Decision Drivers

- $0/month budget — free tiers only
- Solo developer — no on-call rotation, no team dashboards needed
- Pre-code stage — no app code or users yet
- Two-way door — observability tools are swappable with low migration cost
- Built-in observability from Supabase, Cloudflare Workers, and Vercel covers most infrastructure monitoring

## Considered Options

1. Built-ins only (zero added tools)
2. Built-ins + Sentry free tier (deferred to first staging deploy)
3. Built-ins + Sentry + Langfuse free tier

## Decision Outcome

Chosen option: "Built-ins + Sentry free tier, deferred to first staging deploy", because the platform built-ins cover infrastructure monitoring, but no built-in covers client-side crash reporting across React Native, Swift, and VS Code. Sentry fills exactly that gap at $0. Deferring integration until first staging deploy avoids premature setup while ensuring coverage before any external user touches the app.

### Implementation Strategy

**Day one (now):**
- Use Supabase dashboard for database, auth, storage, and API monitoring
- Use Cloudflare Workers dashboard for API metrics, logs, and automatic tracing
- Use Vercel dashboard for web function logs, deployment analytics, and Web Vitals
- No additional tools, no SDKs, no accounts

**Trigger: first staging deploy of any platform:**
- Create Sentry account (free Developer plan)
- Integrate Sentry SDK into the deploying platform
- Configure source maps / symbolication
- Repeat for each subsequent platform as it reaches staging

**Deferred (add only when pain point arises):**
- Langfuse for LLM/MCP observability (token cost tracking)
- Custom Grafana dashboards (Supabase provides pre-built JSON with 200+ charts if ever needed)
- Uptime monitoring (Vercel and Cloudflare handle this)
- Business analytics / product metrics (separate concern from observability)

### Consequences

- **Good:** Zero cost, zero setup effort now. Sentry free tier (5K errors/month, 1 user, 50 session replays) is generous for an indie app. Every platform has a Sentry SDK. Source-mapped stack traces and breadcrumbs save significant solo debugging time.
- **Bad:** No client-side crash reporting during local development phase (accepted — you're the only user). Three separate dashboards for infrastructure monitoring (Supabase, CF, Vercel) instead of a single pane of glass.
- **Neutral:** Sentry free tier is limited to 1 team member. If the project grows to need collaborators, the Team plan ($26/month) would be needed.

## Pros and Cons of the Options

### Built-ins Only
- Good, because zero effort, zero cost, zero accounts to manage
- Good, because Supabase, CF Workers, and Vercel each have maturing observability features ([CF automatic tracing launched March 2026](https://blog.cloudflare.com/workers-tracing-now-in-open-beta/))
- Bad, because no client-side crash reporting — silent failures on users' devices go undetected
- Bad, because no source-mapped stack traces for JS/TS errors

### Built-ins + Sentry Free Tier (chosen)
- Good, because fills the one gap built-ins don't cover (client-side errors)
- Good, because Sentry has SDKs for every PomoFocus platform: React Native, Next.js, Swift, VS Code extensions
- Good, because free tier (5K errors, 10K performance units, 50 replays/month) is more than enough for indie scale ([Sentry pricing](https://sentry.io/pricing/))
- Good, because breadcrumbs and session replay reduce debugging time for hard-to-reproduce bugs
- Bad, because one more SDK per platform (though typically 3–5 lines of init code)
- Bad, because Sentry's free tier UI shows upgrade prompts

### Built-ins + Sentry + Langfuse
- Good, because adds LLM cost tracking and prompt tracing for MCP server
- Good, because recommended in project research docs for agent observability
- Bad, because MCP server isn't built yet — premature optimization
- Bad, because adds another account and SDK for a narrow use case

## Platform-Specific Notes

| Platform | Built-in Monitoring | Sentry SDK | Notes |
|----------|-------------------|------------|-------|
| Web (Next.js/Vercel) | Vercel Analytics, Function Logs, Web Vitals | `@sentry/nextjs` | Automatic source maps via Vercel integration |
| API (Cloudflare Workers) | Workers Logs, automatic tracing, metrics | `@sentry/cloudflare` | CF's built-in tracing may be sufficient; Sentry optional here |
| iOS / Android (Expo) | — | `@sentry/react-native` | Primary value: crash reports from real devices |
| macOS menu bar (SwiftUI) | — | `sentry-cocoa` | Crash reports for native Swift code |
| Apple Watch (SwiftUI) | — | `sentry-cocoa` | watchOS support — verify SDK compatibility |
| VS Code extension | — | `@sentry/node` | Extension host crash reporting |
| Claude Code MCP | — | `@sentry/node` | Defer to Langfuse if LLM tracing needed later |
| BLE device (firmware) | — | N/A | Firmware errors surface through mobile app via BLE |

## Research Sources

- [Cloudflare Workers Observability docs](https://developers.cloudflare.com/workers/observability/)
- [Cloudflare Workers automatic tracing (open beta)](https://blog.cloudflare.com/workers-tracing-now-in-open-beta/)
- [Supabase Observability features](https://supabase.com/blog/new-observability-features-in-supabase)
- [Supabase Metrics API](https://supabase.com/docs/guides/telemetry/metrics)
- [Sentry pricing](https://sentry.io/pricing/)
- [BetterStack vs Sentry comparison](https://betterstack.com/community/comparisons/datadog-vs-sentry/)
- [Railway observability blog](https://blog.railway.com/p/using-logs-metrics-traces-and-alerts-to-understand-system-failures)

## Related Decisions

- [ADR-001](./001-monorepo-package-structure.md) — Package structure determines where Sentry init code lives (per-app, not in shared packages)
- [ADR-005](./005-database-schema-data-model.md) — Database monitoring handled by Supabase built-ins
