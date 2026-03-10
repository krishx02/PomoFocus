# ADR-008: Long-Lived Processes

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 3 (Component)
**Platforms:** All (infrastructure concern)

## Context and Problem Statement

Cloudflare Workers (ADR-007) handle all client-server communication but have execution time limits (10ms CPU free, 30s wall-clock paid). The stack research (04-stack-recommendations.md) listed Railway as a "defer until Phase 3" option for long-lived processes like BLE gateway daemons and analytics aggregation. The question is whether any v1 use case actually requires an always-on server beyond what CF Workers provide.

## Decision Drivers

- **Simplicity** — solo developer; fewer runtime environments = less operational burden
- **Cost** — zero-cost MVP infrastructure (Railway starts at $5/month)
- **Necessity** — only add infrastructure that solves a real v1 problem
- **Consistency** — align with existing CF Workers infrastructure (ADR-007)

## Considered Options

1. **No always-on server — CF Workers + Cron Triggers only**
2. **Railway for background jobs** — always-on container for analytics aggregation and scheduled tasks
3. **Fly.io for background jobs** — similar to Railway, with global edge deployment

## Decision Outcome

Chosen option: **"No always-on server — CF Workers + Cron Triggers only"**, because every v1 use case is handled by existing CF Workers infrastructure:

| Use case | Why an always-on server isn't needed |
|----------|--------------------------------------|
| BLE gateway daemon | BLE device syncs through the phone app (ADR-006), not a cloud relay |
| Analytics aggregation | Per-user analytics (component metrics, trends — see ADR-014) are single SQL queries over ~365 rows — run in milliseconds within a Worker |
| Scheduled tasks (daily cleanup, snapshots) | CF [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) run Workers on a schedule without an HTTP trigger |
| WebSocket presence (Library Mode) | Deferred to post-v1; when needed, CF Durable Objects handle this within the Workers ecosystem |
| Push notification dispatch | Decided in [ADR-019](./019-notification-strategy.md): Expo Push Service called from Hono API within CF Workers request limits |

### Consequences

- **Good:** Zero additional infrastructure. Zero additional cost. One runtime environment (CF Workers) for all server-side code. Simpler deployment and monitoring.
- **Bad:** Batch cross-user analytics (e.g., "compute analytics for all users nightly") will exceed Worker time limits at scale. When this is needed, an always-on server or a chunked Worker strategy must be added. (Note: ADR-014 explicitly excludes cross-user analytics from v1.)
- **Neutral:** Railway/Fly.io remain viable escape hatches. Adding one later requires no changes to existing code — it would be additive (new deployment target consuming the same Supabase database).

## Pros and Cons of the Options

### No always-on server (CF Workers + Cron Triggers)

- Good, because zero additional cost and operational complexity
- Good, because CF Cron Triggers cover all scheduled task needs for v1
- Good, because one runtime environment means one set of logs, one deployment pipeline
- Bad, because batch cross-user analytics can't run in a single Worker at scale
- Bad, because if a future feature genuinely needs long-running computation, there's no infrastructure ready

### Railway for background jobs

- Good, because supports long-running processes (hours, days, forever)
- Good, because simple Docker deployment — run any code
- Good, because $5/month base cost is affordable
- Bad, because adds a second runtime environment to manage, monitor, and deploy
- Bad, because not needed for any v1 use case — premature infrastructure
- Bad, because introduces another failure point and another set of credentials

### Fly.io for background jobs

- Good, because global edge deployment (similar to CF Workers' distribution)
- Good, because supports persistent volumes for local state
- Good, because generous free tier (3 shared VMs)
- Bad, because same "not needed for v1" problem as Railway
- Bad, because more complex networking model than Railway
- Bad, because adds operational complexity for no v1 benefit

## Research Sources

- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — schedule Workers without HTTP triggers
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) — CPU and wall-clock time constraints
- [Railway Pricing](https://railway.app/pricing) — $5/month base, usage-based compute
- [Fly.io Pricing](https://fly.io/docs/about/pricing/) — free tier with 3 shared VMs

## Related Decisions

- [ADR-007: API Architecture](./007-api-architecture.md) — CF Workers are the sole server-side runtime for v1. This ADR confirms no additional runtime is needed.
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — BLE device syncs through the phone, eliminating the need for a cloud-based BLE gateway.
- [ADR-003: Client State Management](./003-client-state-management.md) — polling-first (30s) eliminates the need for an always-on WebSocket server.
