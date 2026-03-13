---
paths:
  - 'apps/api/**'
---

# API Route Standards

Source: research/coding-standards.md Section 7

Hono REST API on Cloudflare Workers (`apps/api/`).

- **API-001:** Every route uses `createRoute` from `@hono/zod-openapi` with Zod schemas for params, body, and response. No untyped route handlers — they break client generation.
- **API-002:** Global `defaultHook` on the OpenAPI Hono app for consistent 422 JSON on validation failures.
- **API-003:** Global `app.onError` handler returning structured JSON — never let CF Workers return raw error text with stack traces.
- **API-004:** No expensive work in global scope. CF Workers have a 1s startup limit. Create Supabase client per-request using `c.env` bindings, not at module top level.
- **API-005:** Forward user JWT for user-scoped operations (RLS stays active). Use `service_role` key only for admin operations (`DELETE /v1/me`, cross-user aggregations).
- **API-006:** Serve OpenAPI 3.1 spec at `GET /openapi.json`. This is the single source of truth for TS and Swift client generation.
- **API-007:** Social endpoints enforce privacy via friendship JOINs — never expose session data to non-friends, never rely solely on RLS for social visibility (ADR-018).
