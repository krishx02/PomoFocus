# ADR-007: API Architecture

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container)
**Platforms:** iOS app, Android, web, VS Code extension, macOS menu bar, Claude Code MCP, Apple Watch (possibly standalone)

## Context and Problem Statement

PomoFocus currently assumes all clients talk directly to Supabase via the Supabase SDK, with Row Level Security (RLS) as the authorization layer. This exposes the Supabase project URL and anon key to every client, relying entirely on RLS policies to prevent unauthorized data access. While RLS is effective, the project lead requires a proper API middle layer that: (1) hides Supabase entirely from clients, (2) provides server-side input validation, (3) enables rate limiting, (4) shapes responses so clients never see raw database structures, and (5) serves as the single entry point for 5-6 direct consumers across TypeScript and Swift.

## Decision Drivers

- **Security** — clients must not know Supabase exists; no anon key, no project URL exposed
- **Cost** — zero-cost at MVP scale, predictable scaling costs, serverless to minimize ops burden
- **Developer experience** — solo developer; type-safe, auto-generated clients for both TypeScript and Swift from a single source of truth
- **Multi-platform support** — API must serve TypeScript consumers (web, mobile, VS Code, MCP) and Swift consumers (macOS menu bar, possibly watchOS) from the same contract
- **Defense-in-depth** — RLS must remain active as a second authorization layer, not replaced by the API
- **Consistency** — must not conflict with ADR-003 (polling-first), ADR-006 (outbox sync), or ADR-002 (Supabase Auth)

## Considered Options

1. **Hono on Cloudflare Workers (REST + OpenAPI)** — Hono framework with `@hono/zod-openapi`, deployed on CF Workers, forwarding user JWTs to Supabase
2. **Next.js Route Handlers on Vercel (REST + OpenAPI)** — API routes colocated with the web app, deployed on Vercel
3. **Hono on Supabase Edge Functions (REST + OpenAPI)** — Hono inside Supabase Edge Functions (Deno runtime)

tRPC was eliminated because 2 of 6 consumers are Swift (not TypeScript). GraphQL was eliminated because the data model (12 tables, flat CRUD) doesn't justify its complexity.

## Decision Outcome

Chosen option: **"Hono on Cloudflare Workers (REST + OpenAPI)"**, because it provides the best combination of cost (free tier covers MVP, $5/month for 10M requests, zero egress), performance (<10ms cold starts, 300+ global edge locations), developer experience (`@hono/zod-openapi` auto-generates OpenAPI 3.1 from Zod schemas), and runtime portability (Hono runs on CF Workers, Vercel Edge, Deno, Bun, or Node.js with zero code changes).

### Key Architecture Decisions

| Decision                        | Choice                                   | Why                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                         | Cloudflare Workers                       | Best cold starts (<10ms), cheapest at scale ($0.30/M requests, zero egress), 300+ edge locations                                                                       |
| Framework                       | Hono                                     | Web Standards-based, runs on any JS runtime, first-class OpenAPI support, officially recommended by both Cloudflare and Supabase                                       |
| API style                       | REST + OpenAPI 3.1                       | Language-agnostic (serves TypeScript + Swift clients), generates SDKs, caching-friendly, universally understood                                                        |
| Schema validation               | Zod via `@hono/zod-openapi`              | Single source of truth: Zod schemas validate requests AND generate OpenAPI spec                                                                                        |
| TypeScript client generation    | `openapi-typescript` + `openapi-fetch`   | Type-safe fetch client generated from OpenAPI spec; used by web, mobile, VS Code, MCP                                                                                  |
| Swift client generation         | Apple `swift-openapi-generator`          | Async/await Swift client generated from same OpenAPI spec; used by macOS menu bar, possibly watchOS                                                                    |
| Auth flow (login/signup)        | Direct Supabase Auth SDK                 | Clients call Supabase Auth directly for login/signup/OAuth. API is not involved in the auth flow — it only validates and forwards the resulting JWT on data requests.  |
| Auth forwarding                 | Forward user's Supabase JWT              | API validates JWT signature, then creates Supabase client with user's token — RLS applies as if client talked directly to Supabase                                     |
| Auth for admin ops              | `service_role` key (server-side only)    | Used only for admin/system operations (analytics aggregation, cleanup); never for user-scoped queries                                                                  |
| Rate limiting                   | Cloudflare built-in or custom middleware | Protects Supabase from abuse; configurable per-endpoint                                                                                                                |
| App location in monorepo        | `apps/api/`                              | Hono API lives alongside other apps; consumes `packages/core/` for business logic                                                                                      |
| Auth token management (clients) | Shared auth interceptors (TS + Swift)    | TypeScript: middleware in `data-access/` wrapping `openapi-fetch` client. Swift: `ClientMiddleware` from `swift-openapi-runtime`. Two modules total, not per-platform. |

### Consequences

- **Good:** Clients never see Supabase URL, anon key, or raw table structures. Defense-in-depth: API validates auth + DB enforces RLS. Auto-generated TypeScript + Swift clients from one OpenAPI spec. Cheapest serverless option at any scale. Hono code is portable to other runtimes if CF Workers doesn't work out. Consistent with ADR-006's outbox sync (just changes the transport target from Supabase SDK to API).
- **Bad:** Adds ~20-50ms latency per request (extra network hop: CF edge → Supabase region). Two deployments to manage (Vercel for web, CF Workers for API). Clients lose Supabase SDK's automatic JWT refresh — must implement token management via shared auth interceptors. Slightly more complex local development setup (need Wrangler for API + Next.js for web).
- **Neutral:** `packages/data-access/` changes from "wraps Supabase SDK" to "wraps generated OpenAPI client." The package's purpose (abstract data access from apps) is preserved. ADR-006's sync drivers in `data-access/` target the API instead of Supabase SDK — no conceptual change.

## Pros and Cons of the Options

### Hono on Cloudflare Workers

- Good, because best cold starts (<10ms avg, max 50ms) — V8 isolates, not containers ([Cloudflare vs Vercel performance](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0))
- Good, because cheapest: $5/month for 10M requests, $0.30/M additional, zero egress ([Cloudflare pricing](https://www.srvrlss.io/compare/cloudflare-vs-supabase/))
- Good, because free tier: 100K requests/day (resets daily, no month-end surprises)
- Good, because `@hono/zod-openapi` generates OpenAPI 3.1 from Zod schemas — single source of truth ([npm](https://www.npmjs.com/package/@hono/zod-openapi))
- Good, because Hono is runtime-portable (CF Workers, Vercel Edge, Deno, Bun, Node.js)
- Good, because [Cloudflare's Chanfana](https://github.com/cloudflare/chanfana) also provides OpenAPI generation for Workers
- Good, because [Supabase officially documents Hono integration](https://supabase.com/docs/guides/getting-started/quickstarts/hono)
- Good, because 300+ global edge locations
- Bad, because 10ms CPU limit on free tier (sufficient for API proxy, tight for complex aggregations)
- Bad, because adds separate deployment target (Wrangler CLI)
- Bad, because Supabase connection goes over the internet (~20-50ms latency per DB call)

### Next.js Route Handlers on Vercel

- Good, because single deployment — web app and API are one unit
- Good, because already in the stack (Vercel for web hosting)
- Good, because Vercel Edge Runtime has decent cold starts (<20ms avg)
- Good, because can use Node.js runtime for complex operations (no CPU limits)
- Bad, because couples API to web app deployment — UI change redeploys the API
- Bad, because more expensive: $20/month Pro, $2/M requests, egress charges after 100GB
- Bad, because OpenAPI tooling for Next.js route handlers is less mature than Hono
- Bad, because API and web share the same domain — CORS and caching complexity
- Bad, because cannot scale API independently of web frontend

### Hono on Supabase Edge Functions

- Good, because tightest Supabase integration — internal network access (lower latency)
- Good, because same platform for database + auth + API — one bill
- Good, because Supabase officially recommends Hono for Edge Functions
- Bad, because deepens Supabase vendor lock-in — contradicts the goal of hiding Supabase from clients
- Bad, because less generous pricing: 2M invocations on Pro ($25/month), then $2/M
- Bad, because Deno runtime — some npm packages need compatibility shims
- Bad, because fewer edge locations and less production maturity than CF Workers

## Research Sources

- [Hono — Web Framework Built on Web Standards](https://hono.dev/docs/)
- [@hono/zod-openapi on npm](https://www.npmjs.com/package/@hono/zod-openapi)
- [Cloudflare Chanfana — OpenAPI generator for Hono/Workers](https://github.com/cloudflare/chanfana)
- [Supabase + Hono Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/hono)
- [Hono on Supabase Edge Functions](https://hono.dev/docs/getting-started/supabase-functions)
- [Hono + Supabase Auth Middleware Discussion](https://github.com/honojs/middleware/issues/352)
- [Cloudflare Workers Pricing](https://www.srvrlss.io/compare/cloudflare-vs-supabase/)
- [Cloudflare vs Vercel vs Netlify Performance 2026](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0)
- [REST vs GraphQL vs tRPC vs gRPC in 2026](https://dev.to/pockit_tools/rest-vs-graphql-vs-trpc-vs-grpc-in-2026-the-definitive-guide-to-choosing-your-api-layer-1j8m)
- [API Design 2026: Multi-Protocol Approach](https://dev.to/dataformathub/api-design-2026-why-the-multi-protocol-approach-is-the-ultimate-guide-2h6o)
- [Supabase Security Best Practices 2026](https://supaexplorer.com/guides/supabase-security-best-practices)
- [Securing Your Supabase API](https://supabase.com/docs/guides/api/securing-your-api)
- [Production-Ready CF Workers Template with Hono + Zod + OpenAPI](https://github.com/alwalxed/hono-openapi-template)

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — adds `apps/api/` for the Hono Workers API. `packages/data-access/` changes from "wraps Supabase SDK" to "wraps generated OpenAPI client."
- [ADR-002: Auth Architecture](./002-auth-architecture.md) — Supabase Auth remains the sole provider. Clients call Supabase Auth SDK directly for login/signup/OAuth (API does not proxy auth flows). API forwards the user's Supabase JWT to Supabase on data requests, preserving RLS.
- [ADR-003: Client State Management](./003-client-state-management.md) — TanStack Query polls the CF Workers API instead of Supabase directly. Same 30s polling interval, same caching behavior.
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — RLS policies remain active and enforced. API uses user's JWT, so `get_user_id()` and all RLS policies work unchanged.
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — outbox sync drivers target the CF Workers API instead of Supabase SDK. Pure sync protocol in `core/sync/` is unaffected. Topology changes: all paths now route through the API.
- [ADR-012: Security & Data Privacy](./012-security-data-privacy.md) — API gateway hides Supabase from clients as security measure. JWT validation in API middleware. GDPR endpoints (`DELETE /v1/me`, `GET /v1/me/export`) are Hono routes.
- [ADR-017: iOS Widget Architecture](./017-ios-widget-architecture.md) — widget receives Tier 1 stats via Expo native module, which calls the API to fetch data
- [ADR-018: Social Features Architecture](./018-social-features-architecture.md) — 12 social API endpoints (6 reads, 6 mutations) as Hono routes on CF Workers with Zod validation
- [ADR-019: Notification Strategy](./019-notification-strategy.md) — `POST /v1/taps` extended with Expo Push API calls; all push sending flows through Hono API on CF Workers
