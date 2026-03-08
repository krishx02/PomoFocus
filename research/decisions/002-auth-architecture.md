# ADR-002: Auth Architecture

**Status:** Accepted
**Date:** 2026-03-06
**Decision-makers:** Project lead
**Zoom level:** Level 1 (System)
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context and Problem Statement

PomoFocus targets 9 platforms from a single monorepo. Every platform needs authenticated access to user data (sessions, goals, settings) stored in Supabase. The auth provider must support deferred sign-up (anonymous users who later create accounts), Apple Sign-In (App Store requirement), and cross-platform token distribution — including platforms without a browser UI (VS Code extension, MCP server, widgets, BLE device). The decision also affects whether Supabase's Row Level Security (RLS) works seamlessly, since RLS policies depend on `auth.uid()` from Supabase-issued JWTs.

## Decision Drivers

- **Cross-platform support** — must work on all 9 platforms with appropriate per-platform auth patterns
- **Zero-cost MVP** — no auth costs at small scale; generous free tier
- **Seamless RLS integration** — `auth.uid()` in RLS policies must work without JWT exchange hacks
- **Deferred sign-up** — anonymous users accumulate data, then promote to authenticated without data loss
- **Apple Sign-In compliance** — required by App Store when offering any social login
- **Developer experience** — fast setup, good docs, minimal boilerplate for a solo developer
- **BLE device compatibility** — auth must work with a phone-as-proxy pattern for the physical device

## Considered Options

1. **Supabase Auth (sole provider, long-term)** — use Supabase's built-in auth across all platforms, accept vendor coupling
2. **Better Auth from day one (with JWT exchange)** — self-hosted, MIT-licensed auth with a JWT exchange layer to make Supabase RLS work
3. **Supabase Auth (MVP) then migrate to Better Auth** — start with Supabase Auth, plan a migration later

## Decision Outcome

Chosen option: **"Supabase Auth (sole provider, long-term)"**, because it provides zero-cost auth with seamless RLS integration, supports all 9 platforms via per-platform token distribution patterns, and avoids the complexity of JWT exchange or a future migration that would invalidate all sessions and require reworking RLS policies.

Supabase Auth is the sole long-term auth provider. Better Auth was evaluated as an alternative but rejected. No migration is planned.

### Consequences

- **Good:** Zero auth cost at MVP scale (50k MAUs free). RLS `auth.uid()` works out of the box. Anonymous auth built-in. GDPR/HIPAA/SOC2 compliance handled by Supabase. One auth system to learn, not two.
- **Bad:** Vendor lock-in — auth, database, and access control are all coupled to Supabase. If Supabase changes pricing or has an outage, auth goes with it. Less customizable than Better Auth's plugin ecosystem (no built-in organizations/multi-tenancy).
- **Neutral:** Auth abstraction layer (`packages/data-access/` owns all auth imports; `packages/core/` receives `userId: string`) makes a future migration affect only one package.

## Pros and Cons of the Options

### Supabase Auth (sole provider)

- Good, because zero cost at MVP scale (50k MAUs free, 100k on Pro $25/month)
- Good, because `auth.uid()` in RLS policies works immediately — no JWT exchange needed
- Good, because anonymous auth is built-in for deferred sign-up
- Good, because Apple Sign-In, Google, email/password all supported out of the box
- Good, because official Expo quickstart and Next.js SSR support
- Good, because GDPR, HIPAA, SOC2 compliant (Supabase handles certifications)
- Bad, because vendor lock-in to Supabase for auth + database + access control
- Bad, because no built-in organizations/multi-tenancy plugin (relevant for social features)
- Bad, because less customizable — limited hooks compared to Better Auth's plugin system

### Better Auth from day one (with JWT exchange)

- Good, because zero vendor lock-in (MIT license, fully self-hosted)
- Good, because rich plugin ecosystem (anonymous auth, OIDC provider, organizations, passkeys, API keys) ([Better Auth](https://better-auth.com/))
- Good, because dedicated Expo plugin (`@better-auth/expo` v1.5.3) with SecureStore integration ([npm](https://www.npmjs.com/package/@better-auth/expo))
- Good, because no per-user pricing, no usage limits, no feature tiers
- Good, because 48k+ GitHub stars, very active development and community
- Bad, because JWT exchange adds complexity — must run a server-side function to mint Supabase-compatible JWTs for every database call ([Supabase third-party auth docs](https://supabase.com/docs/guides/auth/third-party/overview))
- Bad, because Better Auth is NOT in Supabase's 5 supported third-party providers (Clerk, Firebase Auth, Auth0, Cognito, WorkOS)
- Bad, because no compliance certifications (GDPR/SOC2 is your responsibility)
- Bad, because requires Expo SDK 55+ with New Architecture
- Bad, because more upfront setup time for a solo developer

### Supabase Auth (MVP) then migrate to Better Auth

- Good, because fastest path to working auth (minutes, not hours)
- Good, because can evaluate Better Auth maturity over 6-12 months
- Good, because official migration guide exists with batch processing ([Better Auth migration guide](https://better-auth.com/docs/guides/supabase-migration-guide))
- Bad, because migration invalidates all active sessions — every user gets logged out
- Bad, because migration does NOT cover RLS policy reconfiguration
- Bad, because you learn and build with two auth systems instead of one
- Bad, because "the later never comes" — migration keeps getting deferred while lock-in deepens
- Bad, because JWT exchange is still needed after migration

## Research Sources

- [Supabase Auth with React Native quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Using Supabase with Expo (official docs)](https://docs.expo.dev/guides/using-supabase/)
- [Better Auth — official site](https://better-auth.com/)
- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo)
- [@better-auth/expo on npm](https://www.npmjs.com/package/@better-auth/expo)
- [Better Auth anonymous plugin](https://better-auth.com/docs/plugins/anonymous)
- [Supabase Auth vs Better Auth comparison](https://www.auth0alternatives.com/compare/supabase-auth/vs/better-auth)
- [Migrating from Supabase Auth to Better Auth](https://better-auth.com/docs/guides/supabase-migration-guide)
- [Supabase third-party auth overview](https://supabase.com/docs/guides/auth/third-party/overview)
- [Supabase Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Better Auth OIDC Provider plugin](https://better-auth.com/docs/plugins/oidc-provider)
- [Authentication in Expo and React Native apps](https://docs.expo.dev/develop/authentication/)
- [Top authentication solutions for React 2026 (WorkOS)](https://workos.com/blog/top-authentication-solutions-react-2026)
- [Better Auth vs NextAuth vs Auth0 (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/)
- [OAuth for IoT API security (Approov)](https://blog.approov.io/adapting-oauth2-for-internet-of-things-iot-api-security)
- [OAuth for mobile apps best practices (Curity)](https://curity.io/resources/learn/oauth-for-mobile-apps-best-practices/)

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — auth imports confined to `packages/data-access/`, never in `packages/core/`
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — RLS uses `auth.uid()` via `get_user_id()` helper; deferred sign-up preserves user ID on identity promotion
- Database: Supabase (Postgres + RLS + Realtime) — accepted, see `research/04-stack-recommendations.md`
- Testing frameworks — accepted, see `research/08-testing-frameworks.md`
- [ADR-007: API Architecture](./007-api-architecture.md) — auth flow routes through the Hono API on CF Workers. API validates user's Supabase JWT and forwards to Supabase — RLS and `get_user_id()` work unchanged. Clients manage JWT refresh via shared auth interceptors.
