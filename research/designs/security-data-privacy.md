# Design: Security & Data Privacy

**Date:** 2026-03-09
**Status:** Accepted
**Related ADR:** [ADR-012](../decisions/012-security-data-privacy.md)
**Platforms:** All (iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device)

## Context & Scope

PomoFocus is a multi-platform Pomodoro productivity app that collects timer sessions, user-written goals, self-reported focus quality, and friendship connections. The data is low-to-moderate sensitivity — not health, financial, or credential data, but users may write personal aspirations in goal titles and reflections. The app targets a global audience (EU users from day one), uses OAuth sign-in (Apple + Google + email), and includes a BLE device that syncs through the phone. Existing architecture decisions already provide a strong security foundation: Supabase with RLS (ADR-005), an API gateway that hides Supabase from clients (ADR-007), and auth confined to `data-access/` (ADR-002).

## Goals & Non-Goals

**Goals:**
- GDPR compliance from launch (right to erasure, data portability, data minimization, consent)
- Leverage existing platform security (Supabase encryption, RLS, CF Workers TLS) rather than building custom solutions
- Secure BLE pairing between phone and physical device
- Store minimum OAuth data needed for the app to function

**Non-Goals:**
- Application-level field encryption (not warranted for productivity data)
- Advanced BLE hardening (SCO mode, GATT-level encryption, MAC rotation)
- SOC 2 or HIPAA compliance (not a health or enterprise app)
- Cookie consent banners (no tracking, no ads, no third-party analytics)
- Certificate pinning on mobile (defer until post-v1)
- WAF or DDoS protection beyond what Cloudflare provides by default

## The Design

### Security Architecture Overview

```
User Device                         Cloud
┌─────────────────┐               ┌──────────────────────┐
│  App / Browser   │──── TLS ────▶│  Cloudflare Workers   │
│                  │               │  (Hono API Gateway)   │
│  Token stored in │               │                       │
│  platform-secure │               │  - JWT validation     │
│  storage         │               │  - Rate limiting      │
│                  │               │  - Route auth check   │
└─────────────────┘               └──────────┬───────────┘
                                              │ JWT forwarded
                                              ▼
                                   ┌──────────────────────┐
                                   │  Supabase             │
                                   │  - AES-256 at rest    │
                                   │  - TLS in transit     │
                                   │  - RLS on every table │
                                   │  - get_user_id()      │
                                   └──────────────────────┘
```

```
Phone                              BLE Device
┌─────────────────┐               ┌──────────────────────┐
│  Expo App        │◄── BLE ─────▶│  nRF52840 (EN04)     │
│                  │   Encrypted   │                       │
│  react-native-   │   AES-CCM    │  - Passkey displayed  │
│  ble-plx         │   128-bit    │    on e-ink screen    │
│                  │              │  - LTK bonded after   │
│  Syncs to cloud  │              │    initial pairing    │
│  via API gateway │              │  - Sessions in flash  │
└─────────────────┘              └──────────────────────┘
```

### GDPR Endpoints

Two new routes in the Hono API (`apps/api/`):

#### `DELETE /v1/me` — Account Deletion

1. Validate JWT, extract `userId`
2. Cascade delete all user data: `profiles`, `user_preferences`, `long_term_goals`, `process_goals`, `sessions`, `breaks`, `devices`, `device_sync_log`, `friend_requests`, `friendships`, `encouragement_taps`
3. Delete Supabase Auth user via `auth.admin.deleteUser(userId)` (service_role key, server-side only)
4. Return `204 No Content`
5. Data retained in Supabase backups for 30 days (Supabase default), then purged

Implementation note: For power users with thousands of sessions, this cascade could be slow. If latency becomes an issue post-launch, migrate to async deletion via CF Workers queue (accept request immediately, process in background, confirm via email).

#### `GET /v1/me/export` — Data Export

1. Validate JWT, extract `userId`
2. Query all user data across all tables
3. Return as JSON with `Content-Disposition: attachment; filename="pomofocus-data-export.json"`
4. Format: flat structure with one key per table (`{ "profile": {...}, "goals": [...], "sessions": [...], ... }`)
5. No rate limit needed — users rarely export data

### OAuth Data Storage

Supabase Auth manages all OAuth complexity (tokens, refresh, sessions). PomoFocus stores only:

| Field | Table | Purpose | Legal Basis (GDPR) |
|-------|-------|---------|-------------------|
| `auth_id` (provider `sub`) | `auth.users` (Supabase-managed) | Unique identity | Contractual necessity |
| `email` | `auth.users` | Account recovery, notifications | Contractual necessity |
| `display_name` | `profiles` | Social features (Quiet Feed, Library Mode) | Legitimate interest |

**Apple Sign-In special handling:** Apple returns `given_name` and `family_name` only on the first authorization. The API must cache the display name in `profiles` immediately on first sign-in — it will not be available again.

### Token Storage per Platform

| Platform | Storage Mechanism | Notes |
|----------|-------------------|-------|
| Web (Next.js) | HttpOnly cookie (set by API) | Not accessible to JavaScript — XSS-safe |
| Mobile (Expo) | `expo-secure-store` | Encrypted keychain (iOS) / keystore (Android) |
| iOS Widget | App Group `UserDefaults` | Shared with Expo app via native module |
| watchOS | WatchConnectivity transfer | Received from paired iPhone |
| macOS menu bar | Keychain Services | Standard macOS credential storage |
| VS Code | `SecretStorage` API | Extension-scoped encrypted storage |
| MCP Server | Claude Code credential management | Managed by Claude Code runtime |
| BLE Device | N/A | No auth tokens — syncs through phone |

### BLE Pairing Flow

1. User initiates pairing from phone app
2. Device enters pairing mode, generates 6-digit passkey
3. Passkey displayed on e-ink screen
4. User enters passkey on phone
5. LE Secure Connections handshake with AES-CCM 128-bit encryption
6. Long Term Key (LTK) exchanged and bonded
7. Subsequent connections auto-authenticate via bonded LTK
8. If user wants to pair a different phone, they reset the device (long-press 10s), which clears the bond

### Privacy Policy Requirements

The privacy policy (static page at `/privacy`) must include:
- What data is collected (sessions, goals, focus quality, friendships)
- Why it's collected (core app functionality, social features)
- How it's stored (Supabase, encrypted at rest and in transit)
- Who has access (only the user; friends see limited presence/activity via scoped functions)
- Data retention (active account: indefinite; deleted account: 30 days in backups)
- User rights (export, deletion, correction)
- Contact information for data requests
- No third-party data sharing, no ads, no tracking

## Alternatives Considered

### Application-Level Encryption (Rejected)

Encrypting goal titles and reflection notes before storing in Supabase would protect against a Supabase admin breach. Rejected because: (1) key management (per-user keys, rotation, recovery) adds significant complexity; (2) encrypted fields cannot be queried via SQL, breaking analytics and search; (3) Supabase's AES-256 at-rest encryption already protects against physical storage theft; (4) the data is not sensitive enough to justify the trade-offs.

### Advanced BLE Security (Rejected)

Secure Connections Only mode, GATT-level encryption, and MAC rotation would harden the BLE link against sophisticated attacks. Rejected because: (1) SCO mode has inconsistent OS support across Android, iOS, and macOS; (2) GATT-level encryption adds firmware complexity and battery drain; (3) the threat model is weak — intercepting timer/goal data has negligible value to an attacker.

### Self-Hosted Supabase (Not Considered for v1)

Self-hosting would eliminate the risk of Supabase employees accessing data. Not considered because: (1) solo developer with $0 budget; (2) Supabase's shared responsibility model is appropriate for non-sensitive data; (3) self-hosting introduces infrastructure management burden.

## Cross-Cutting Concerns

- **Security:** The main attack surface is the Hono API on CF Workers. JWT validation must be strict — verify signature against Supabase's JWKS endpoint, check expiration, and reject malformed tokens. RLS provides defense-in-depth even if the API has a bug.
- **Cost:** $0/month. All security is provided by platform defaults (Supabase encryption, CF Workers TLS, Vercel HTTPS). GDPR endpoints are standard Hono routes.
- **Observability:** Failed auth attempts and data deletion events should be logged (CF Workers dashboard). Sentry (ADR-011) captures client-side errors but must not include PII in error reports — strip user data from Sentry breadcrumbs.
- **Migration path:** If application-level encryption becomes necessary later (e.g., regulatory change, enterprise customers), it can be added to specific fields without changing the overall architecture. Existing data would need a one-time migration to encrypt in place.

## Open Questions

- **Rate limiting specifics:** How aggressive should rate limiting be on auth endpoints? (Cloudflare's default DDoS protection may be sufficient for v1.)
- **Token refresh strategy:** How does the web app handle token refresh for long sessions? (Supabase Auth handles this automatically, but the HttpOnly cookie approach needs careful design.)
- **GDPR DPA:** Does Supabase's Data Processing Agreement (DPA) need to be signed before launch? (Yes — available at supabase.com/legal/dpa, self-service.)
