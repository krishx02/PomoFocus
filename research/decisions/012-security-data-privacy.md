# ADR-012: Security & Data Privacy

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 1-2 (system-level, affects schema, API, auth, BLE)
**Platforms:** All (iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device)

## Context and Problem Statement

PomoFocus collects low-to-moderate sensitivity productivity data: timer sessions, goals with user-written titles, self-reported focus quality, friendship connections, and reflection notes. The app targets a global audience (EU users expected from launch), handles OAuth sign-in via Apple and Google, and includes a BLE device that syncs through the phone. The question is: what security and privacy measures does a consumer productivity app actually need — balancing real-world risk against development effort on a $0/month budget?

## Decision Drivers

- **GDPR compliance** — EU users from launch; must comply with data minimization, right to erasure, and right to data portability from day one
- **$0/month budget** — rely on platform-provided security, no additional services
- **Low-to-moderate data sensitivity** — timer durations and goal titles, not health/financial data
- **Multi-platform** — security model must work across web, mobile, BLE device, native Apple, VS Code, and MCP
- **Existing architecture** — Supabase (AES-256 at rest, TLS in transit), API gateway (ADR-007), RLS on every table (ADR-005)

## Considered Options

1. Lean GDPR — Supabase defaults + RLS + API gateway + GDPR endpoints + BLE passkey pairing
2. Defense in Depth — Option 1 + application-level encryption for sensitive fields (goals, reflections)
3. Maximum BLE Security — Option 1 + Secure Connections Only mode + GATT-level encryption + MAC rotation

## Decision Outcome

Chosen option: **"Lean GDPR"**, because the data PomoFocus handles does not justify application-level encryption complexity or advanced BLE hardening. Supabase's built-in encryption (AES-256 at rest, TLS 1.2+ in transit) combined with RLS on every table and the API gateway (ADR-007) provides sufficient protection for productivity data. The incremental effort is limited to two API endpoints (data export, account deletion), a privacy policy, and BLE passkey pairing configuration.

### Consequences

- **Good:** Near-zero additional development effort. GDPR compliance from day one. No third-party security SDKs to vet or maintain. Aligns with existing architecture (ADR-005 hard deletes, ADR-007 API gateway).
- **Bad:** Goal titles and reflection notes stored as plaintext in Supabase (behind AES-256 at-rest encryption). A Supabase admin breach would expose this data. BLE passkey (6 digits) is brute-forceable if initial pairing exchange is captured.
- **Neutral:** The decision is partially revisable — application-level encryption for specific fields could be added later without changing the overall architecture, though it would break queries on those fields.

## The Security Model

### Encryption

| Layer             | Mechanism        | Responsibility                                    |
| ----------------- | ---------------- | ------------------------------------------------- |
| In transit        | TLS 1.2+ (HTTPS) | Supabase, Cloudflare Workers, Vercel (automatic)  |
| At rest           | AES-256          | Supabase (automatic, no configuration needed)     |
| Application-level | None             | Not required for low-to-moderate sensitivity data |

No additional encryption is needed. Supabase's shared responsibility model covers encryption at rest and in transit. Application-level encryption (e.g., `pgcrypto`) is not warranted because: (1) the data is not health, financial, or credential data; (2) encrypted fields cannot be queried, breaking analytics; (3) key management adds significant complexity for marginal security gain.

### Access Control

| Layer              | Mechanism                                                                                              | Reference |
| ------------------ | ------------------------------------------------------------------------------------------------------ | --------- |
| API gateway        | Hono on CF Workers — clients never access Supabase directly                                            | ADR-007   |
| Row-level security | RLS on every table via `get_user_id()` helper                                                          | ADR-005   |
| JWT validation     | Server-side validation of Supabase JWT in API middleware                                               | ADR-007   |
| Social visibility  | Scoped functions (`is_friend_focusing`, `did_friend_focus_today`) — friends never see raw session data | ADR-005   |

### GDPR Compliance

| Requirement                         | Implementation                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Right to erasure (Art. 17)          | `DELETE /v1/me` — cascade deletes all user data (sessions, goals, friendships, devices, preferences). Hard deletes (ADR-005).                  |
| Right to data portability (Art. 20) | `GET /v1/me/export` — returns all user data as JSON download                                                                                   |
| Privacy policy                      | Static page at `/privacy` — describes data collected, purposes, retention, and rights                                                          |
| Consent                             | Acknowledgment at sign-up (link to privacy policy). No cookie banner needed — no tracking, no ads, no third-party analytics.                   |
| Data minimization                   | Store only what's needed: provider user ID, email (account recovery), display name (social features). No profile pictures unless user uploads. |
| Data retention                      | 30 days post-deletion for backup safety, then hard purge via scheduled CF Worker cron job                                                      |

### OAuth Data Minimization

| Provider       | Scopes Requested             | Data Stored                                                                                                                |
| -------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Apple Sign-In  | `name`, `email`              | Provider `sub` (user ID), email (real or private relay), display name (cached on first login — Apple only returns it once) |
| Google         | `openid`, `email`, `profile` | Provider `sub`, email, display name                                                                                        |
| Email/password | N/A                          | Email, hashed password (Supabase Auth handles hashing)                                                                     |

Supabase Auth manages all OAuth tokens, refresh cycles, and session management. `packages/data-access/` wraps Supabase Auth; `packages/core/` never handles auth data — it receives `userId: string` per ADR-002.

### BLE Security

| Measure         | Implementation                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Pairing         | LE Secure Connections with Passkey Entry — 6-digit code displayed on e-ink screen, entered on phone                             |
| Bonding         | Persist Long Term Key (LTK) after initial pairing — re-pairing not needed for subsequent sessions                               |
| Link encryption | AES-CCM 128-bit (standard for LE Secure Connections)                                                                            |
| Accepted risk   | Timer/goal data is low-stakes — brute-forcing a 6-digit passkey to intercept "user focused 25 minutes" is not a credible threat |

Advanced BLE hardening (Secure Connections Only mode, GATT-level encryption, MAC rotation) is deferred — the threat model does not justify the firmware complexity and OS compatibility issues.

### Platform Security Notes

| Platform       | Security Considerations                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| Web (Next.js)  | HTTPS via Vercel. HttpOnly cookies for session. CSP headers. No localStorage for tokens.  |
| Mobile (Expo)  | Secure storage via `expo-secure-store` for tokens. Certificate pinning deferred.          |
| iOS Widget     | Data via App Group (on-device transfer, not network). No additional concern.              |
| watchOS        | Data via WatchConnectivity (on-device transfer). No additional concern.                   |
| macOS menu bar | CoreBluetooth for BLE fallback. Keychain for token storage.                               |
| VS Code        | `SecretStorage` API for tokens. Extension sandbox provides isolation.                     |
| MCP Server     | Token stored via Claude Code's credential management. No browser context.                 |
| BLE Device     | LE Secure Connections + bonding. Session data in internal flash (not network-accessible). |

## Pros and Cons of the Options

### Option 1: Lean GDPR (Chosen)

- Good, because near-zero additional effort — Supabase handles encryption, existing ADRs cover access control
- Good, because GDPR compliance adds only 2 API endpoints and a privacy policy
- Good, because no third-party security SDKs or services ($0/month)
- Good, because hard deletes (ADR-005) naturally align with right to erasure
- Bad, because goal titles and reflections are plaintext in Supabase (mitigated by AES-256 at rest)
- Bad, because BLE passkey is only 6 digits of entropy (mitigated by bonding + low-value data)

### Option 2: Defense in Depth

- Good, because application-level encryption protects goals/reflections even against Supabase admin breach
- Bad, because key management adds significant complexity (rotation, recovery, per-user keys)
- Bad, because encrypted fields cannot be queried by SQL — breaks analytics and search ([Supabase encryption docs](https://supabase.com/docs/guides/database/secure-data))
- Bad, because over-engineered for productivity data — no regulatory requirement demands field-level encryption

### Option 3: Maximum BLE Security

- Good, because Secure Connections Only mode blocks BLE downgrade attacks ([USENIX Security 2020](https://www.usenix.org/conference/usenixsecurity20/presentation/zhang-yue))
- Good, because MAC rotation prevents device fingerprinting/tracking
- Bad, because SCO mode has inconsistent OS support across Android, iOS, and macOS
- Bad, because GATT-level encryption adds firmware complexity and battery drain
- Bad, because threat model is weak — intercepting timer data has negligible value

## Research Sources

- [Supabase Security](https://supabase.com/security) — AES-256 at rest, TLS in transit, shared responsibility model
- [Supabase Securing Your Data](https://supabase.com/docs/guides/database/secure-data) — RLS best practices, encryption guidance
- [Supabase Shared Responsibility Model](https://supabase.com/docs/guides/deployment/shared-responsibility-model) — what Supabase handles vs what developers handle
- [Auth0 GDPR Data Minimization](https://auth0.com/docs/secure/data-privacy-and-compliance/gdpr/gdpr-data-minimization) — OAuth data minimization guidance
- [Curity: Privacy and GDPR Using OAuth](https://curity.io/resources/learn/privacy-and-gdpr/) — OAuth GDPR compliance patterns
- [Apple Developer: Sign in with Apple](https://developer.apple.com/sign-in-with-apple/) — data returned, private relay email, name only on first login
- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes) — minimum scopes for authentication

## Related Decisions

- [ADR-002: Auth Architecture](./002-auth-architecture.md) — Supabase Auth as sole provider, auth confined to `data-access/`
- [ADR-005: Database Schema](./005-database-schema-data-model.md) — RLS on every table, hard deletes, `get_user_id()` helper
- [ADR-007: API Architecture](./007-api-architecture.md) — Hono API gateway hides Supabase, JWT forwarding
- [ADR-010: Physical Device Hardware](./010-physical-device-hardware-platform.md) — BLE 5.0, passkey pairing, phone-as-hub
- [ADR-011: Monitoring & Observability](./011-monitoring-observability.md) — Sentry for client-side error tracking (no PII in error reports)
- [ADR-017: iOS Widget Architecture](./017-ios-widget-architecture.md) — App Group UserDefaults for widget data sharing; no sensitive data in widget pipeline
- [ADR-018: Social Features Architecture](./018-social-features-architecture.md) — social privacy enforced via friendship JOINs in API queries; DB functions repurposed as integration test helpers
- [ADR-019: Notification Strategy](./019-notification-strategy.md) — push notification content minimization (no session details, goal content, or reflection text); push token storage in `devices` table
