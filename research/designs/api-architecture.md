# Design: API Architecture

**Date:** 2026-03-07
**Status:** Accepted
**Related ADR:** [ADR-007](../decisions/007-api-architecture.md)
**Platforms:** iOS app, Android, web, VS Code extension, macOS menu bar, Claude Code MCP, Apple Watch (possibly standalone)

## Context & Scope

PomoFocus targets 9 platforms from a single monorepo. The current architecture (ADRs 001-006) assumes all clients interact with Supabase directly via the Supabase SDK, with Row Level Security (RLS) as the sole authorization layer. This exposes the Supabase project URL and anon key to every client.

The project lead requires a proper API middle layer that hides Supabase entirely. Clients should only know about a single API endpoint — they never see the database URL, anon key, or raw table structures. The API adds input validation, rate limiting, response shaping, and business logic orchestration on top of Supabase's existing RLS.

5-6 platforms are direct API consumers: web (Next.js), mobile (Expo), VS Code extension, macOS menu bar widget, Claude Code MCP server, and possibly Apple Watch (standalone mode). The remaining platforms (iOS widget, BLE device) proxy through the mobile app.

## Goals & Non-Goals

**Goals:**

- Hide Supabase from all clients — no anon key, no project URL, no raw table structures exposed
- Serve both TypeScript and Swift consumers from one API contract (OpenAPI 3.1)
- Auto-generate type-safe clients for TypeScript (`openapi-fetch`) and Swift (`swift-openapi-generator`)
- Validate all inputs server-side (Zod schemas) before they reach the database
- Rate limit API endpoints to protect Supabase from abuse
- Preserve RLS as defense-in-depth by forwarding user JWTs to Supabase
- Keep cost at $0 for MVP, scaling predictably

**Non-Goals:**

- Replacing Supabase Auth — auth remains Supabase Auth (ADR-002), the API forwards JWTs
- Real-time push — the API serves REST requests; polling-first strategy (ADR-003) is preserved
- Designing the OpenAPI contract itself (routes, schemas, endpoints) — that's a follow-up implementation task
- BLE protocol or device firmware — those communicate via the mobile app, not the API directly
- Admin dashboard or internal tooling — out of scope for v1

## The Design

### System Architecture

```
                        ┌─────────────────────────────────────┐
                        │         Cloudflare Workers          │
                        │                                     │
                        │  ┌───────────────────────────────┐  │
                        │  │     Hono API (apps/api/)      │  │
   ┌──────────┐        │  │                               │  │
   │   Web    │───────▶│  │  • JWT validation             │  │
   │ (Next.js)│        │  │  • Zod input validation       │  │
   └──────────┘        │  │  • Rate limiting              │  │
   ┌──────────┐        │  │  • Business logic (core/)     │  │
   │  Mobile  │───────▶│  │  • Response shaping           │  │
   │  (Expo)  │        │  │                               │  │       ┌─────────────┐
   └──────────┘        │  │  Forward user JWT ─────────────┼──┼──▶   │  Supabase   │
   ┌──────────┐        │  │                               │  │       │  (Postgres  │
   │  VS Code │───────▶│  │  service_role key             │  │       │  + RLS)     │
   │   Ext    │        │  │  (admin ops only) ─────────────┼──┼──▶   │             │
   └──────────┘        │  │                               │  │       └─────────────┘
   ┌──────────┐        │  └───────────────────────────────┘  │
   │  macOS   │───────▶│                                     │
   │ Menu Bar │        └─────────────────────────────────────┘
   └──────────┘
   ┌──────────┐
   │   MCP    │───────▶ (same CF Workers endpoint)
   │  Server  │
   └──────────┘
```

### Request Flow (User-Scoped Operations)

1. Client authenticates directly with Supabase Auth SDK (login/signup/OAuth). The API is not involved in the initial auth flow.
2. Client receives Supabase JWT (access token + refresh token)
3. Client sends API request with `Authorization: Bearer <supabase_jwt>`
4. CF Workers API:
   a. Validates JWT signature using Supabase JWT secret
   b. Validates request body/params using Zod schema
   c. Rate-limits the request
   d. Executes business logic (may call `packages/core/` functions)
   e. Creates Supabase client with user's JWT (RLS applies)
   f. Executes database query
   g. Shapes response (may omit internal fields, rename columns, nest related data)
5. Client receives typed response matching the OpenAPI spec

### Auth Token Lifecycle

Clients manage JWT refresh via shared auth interceptors:

**TypeScript (web, mobile, VS Code, MCP):**

- Auth middleware in `packages/data-access/` wrapping the generated `openapi-fetch` client
- Intercepts 401 responses, calls `/auth/refresh` endpoint, retries original request
- Stores tokens in platform-appropriate secure storage (SecureStore on Expo, Keychain equivalent on web, VS Code SecretStorage)

**Swift (macOS menu bar, possibly watchOS):**

- `ClientMiddleware` from `swift-openapi-runtime`
- Same refresh flow: intercept 401, call `/auth/refresh`, retry
- Stores tokens in Keychain

### OpenAPI Client Generation Pipeline

```
Zod schemas (apps/api/src/routes/)
        │
        ▼
@hono/zod-openapi
        │
        ▼
OpenAPI 3.1 spec (apps/api/openapi.json)
        │
   ┌────┴────┐
   ▼         ▼
openapi-typescript     swift-openapi-generator
+ openapi-fetch        (Apple's tool)
   │                   │
   ▼                   ▼
TS client types     Swift client code
(packages/           (native/apple/
 data-access/)        Sources/APIClient/)
```

### API Layer Responsibilities

| Responsibility   | Implemented via                                    | Notes                                                                            |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Auth validation  | Hono middleware (JWT verify)                       | Checks signature using `SUPABASE_JWT_SECRET` env var                             |
| Input validation | `@hono/zod-openapi` route schemas                  | Zod schemas define request body, params, query; auto-reject invalid requests     |
| Rate limiting    | Cloudflare rate limiting or custom Hono middleware | Per-endpoint, per-user configurable                                              |
| Business logic   | `packages/core/` function calls                    | API is a thin orchestration layer; domain logic stays in `core/`                 |
| Data access      | Supabase SDK with user's JWT                       | RLS applies; `get_user_id()` and all ADR-005 policies work unchanged             |
| Response shaping | Zod response schemas in route definitions          | Clients see a clean API contract, not raw table structures                       |
| Error handling   | Hono error middleware                              | Consistent error format across all endpoints; no Supabase errors leak to clients |
| CORS             | Hono CORS middleware                               | Configure allowed origins per environment                                        |

### Monorepo Integration

```
apps/
  api/                  # NEW — Hono API on CF Workers
    src/
      routes/           # Route definitions with Zod schemas
      middleware/        # Auth, rate limiting, error handling
      index.ts          # Hono app entry point
    wrangler.toml       # CF Workers config
    openapi.json        # Generated OpenAPI spec (committed)
  web/                  # Next.js on Vercel (unchanged)
  mobile/               # Expo (unchanged)
  vscode-extension/     # VS Code extension (unchanged)
  mcp-server/           # MCP server (unchanged)

packages/
  core/                 # Pure domain logic (unchanged)
  data-access/          # CHANGED: wraps generated OpenAPI client instead of Supabase SDK
  types/                # Auto-generated from Postgres schema (unchanged)
  state/                # Zustand + TanStack Query (unchanged, polls API instead of Supabase)
  ...
```

`apps/api/` depends on `packages/core/` and `packages/types/`. It does NOT depend on `packages/data-access/` — the API IS the data access layer's backend. `packages/data-access/` is the API's frontend (client).

### Sync Architecture Impact (ADR-006)

The outbox sync pattern is transport-agnostic. The sync protocol in `core/sync/` is unchanged. Only the sync drivers in `data-access/` change their target:

| Component             | Before                         | After                                                          |
| --------------------- | ------------------------------ | -------------------------------------------------------------- |
| Outbox upload (TS)    | `data-access/` → Supabase SDK  | `data-access/` → OpenAPI client → CF Workers API → Supabase    |
| Polling pull (TS)     | TanStack Query → Supabase SDK  | TanStack Query → OpenAPI client → CF Workers API → Supabase    |
| Outbox upload (Swift) | `native/` → Supabase Swift SDK | `native/` → Generated Swift client → CF Workers API → Supabase |
| Watch sync            | Watch → iPhone → Supabase      | Watch → iPhone → CF Workers API → Supabase                     |
| BLE sync              | Device → Phone → Supabase      | Device → Phone → CF Workers API → Supabase                     |
| MCP sync              | Direct Supabase REST           | MCP → CF Workers API → Supabase                                |

### Cost Projection

| Scale            | Requests/month | CF Workers cost | Supabase cost  | Total API cost |
| ---------------- | -------------- | --------------- | -------------- | -------------- |
| MVP (0-1K users) | ~1.5M          | $0 (free tier)  | $0 (free tier) | **$0**         |
| Growth (1K-10K)  | ~15M           | ~$6.50          | $25 (Pro)      | **~$31.50**    |
| Scale (100K)     | ~150M          | ~$47            | $25+ (Pro)     | **~$72+**      |

## Alternatives Considered

### Next.js Route Handlers (Rejected)

Colocating the API with the web app is simpler operationally (one deployment), but couples API availability to web deployments, costs more at scale ($20/month + $2/M requests + egress), and produces less portable code. A web UI change should not risk API downtime.

### Supabase Edge Functions (Rejected)

Tightest integration with Supabase (internal network, lowest latency), but directly contradicts the project goal of hiding Supabase from clients. Puts the API on the same platform it's supposed to abstract. Less generous pricing, less mature runtime.

### tRPC (Rejected — Eliminated)

Requires TypeScript on both client and server. 2 of 6 direct consumers are Swift (macOS menu bar, possibly watchOS). Non-starter for a multi-language client base.

### GraphQL (Rejected — Eliminated)

PomoFocus has 12 tables with relatively flat CRUD operations. GraphQL's value (flexible queries for complex, nested data) isn't justified. Adds schema maintenance, resolver complexity, and N+1 query risks for a solo developer.

## Cross-Cutting Concerns

- **Security:** Defense-in-depth. API validates JWT and input; database enforces RLS. `service_role` key is only used for admin operations. Supabase URL and keys are never exposed to clients. Rate limiting at the API layer protects Supabase from abuse.
- **Cost:** $0 at MVP, scaling linearly. CF Workers' zero-egress model prevents surprise bills. No additional services needed (rate limiting is built into CF or Hono middleware).
- **Observability:** CF Workers provides built-in request logging and analytics. For deeper observability, add Langfuse or structured logging to API routes. Errors should be logged server-side with request context; clients receive generic error codes.
- **Migration path:** Since Hono is runtime-portable, the API can be moved from CF Workers to Vercel Edge, Fly.io, or any Node.js host by changing the deployment config — no application code changes needed.

## Resolved Questions

1. **Auth flow for initial login/signup:** **Resolved — direct Supabase Auth.** Clients call the Supabase Auth SDK directly for login, signup, and OAuth. The API does not proxy auth endpoints. Rationale: (1) all per-platform auth flows already assume direct Supabase Auth SDK usage (ADR-002 design doc, Tiers 1-4); (2) OAuth redirect flows (Apple Sign-In, Google) are handled natively by the Supabase SDK — proxying would add complexity for no security benefit; (3) the API's purpose is to hide Supabase's data layer, not its auth layer — Supabase Auth has its own security model (PKCE, secure token storage). The client receives the JWT from Supabase Auth, then sends it to the API for all subsequent data requests.

## Open Questions

1. **OpenAPI spec versioning:** How to handle breaking changes to the API contract? Versioned URL prefixes (`/v1/`, `/v2/`) or header-based versioning?
2. **Local development:** How to run the API locally? Wrangler provides a local dev server, but it needs to connect to a Supabase instance (local via `supabase start` or remote).
3. **CI/CD pipeline:** How to deploy the API alongside the web app? Separate workflows, or a single workflow with conditional deployments?
