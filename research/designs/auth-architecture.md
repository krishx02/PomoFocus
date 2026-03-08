# Design: Auth Architecture

**Date:** 2026-03-06
**Status:** Accepted
**Related ADR:** [ADR-002: Auth Architecture](../decisions/002-auth-architecture.md)
**Platforms:** iOS app, iOS widget, Apple Watch, macOS menu bar, Android, web, VS Code extension, Claude Code MCP, BLE device

## Context & Scope

PomoFocus is a multi-platform Pomodoro app where every platform needs authenticated access to user data stored in Supabase. Auth must support deferred sign-up (users start anonymously, later create an account), Apple Sign-In (App Store requirement), and 9 different platforms with varying capabilities (some have browsers, some don't). Supabase's Row Level Security (RLS) is the primary access control mechanism, which depends on `auth.uid()` from Supabase-issued JWTs.

## Goals & Non-Goals

**Goals:**
- Single auth provider (Supabase Auth) across all 9 platforms
- Deferred sign-up with well-defined data merge during anonymous-to-authenticated promotion
- Per-platform token distribution that works for browser, native app, widget, watch, VS Code, CLI, and BLE device contexts
- GDPR compliance (account deletion, data export, EU region)
- Auth abstraction that confines Supabase Auth imports to `packages/data-access/`

**Non-Goals:**
- Building for a Better Auth migration now (noted as escape hatch, not planned)
- Multi-tenancy or organizations (social features will use friend-based model, not org-based)
- Enterprise SSO / SAML (consumer app, not B2B)
- Custom auth server or edge auth layer (defer until needed)

## The Design

### OAuth Providers

| Provider | Required? | Reason |
|----------|-----------|--------|
| Apple Sign-In | Yes | App Store requires it when any social login is offered |
| Google | Yes | Largest OAuth provider; expected by users |
| Email/password | Yes | Fallback for users who don't use social login |
| Magic links | Deferred | Nice-to-have; add if email/password friction is high |

### Per-Platform Auth Token Flow

#### Tier 1: Browser-Based OAuth (Web, Mobile, Android)

These platforms have a browser context for OAuth:

**Web (Next.js):**
- Supabase JS SDK handles OAuth redirect flow
- Server-side: `@supabase/ssr` package for cookie-based session management
- Client-side: `supabase.auth.getSession()` for client components
- Token stored in HTTP-only cookies (SSR) and localStorage (CSR fallback)

**Mobile (Expo / React Native):**
- OAuth via `expo-web-browser` (in-app browser)
- Deep link callback to return to app after OAuth
- Token stored in `expo-secure-store` (encrypted on-device storage)
- Supabase provides an official Expo quickstart for this flow

**Android:**
- Same as iOS mobile — Expo handles both platforms identically
- Token stored in Android EncryptedSharedPreferences (via expo-secure-store)

#### Tier 2: Token Sharing (Widgets, Watch)

These platforms don't have their own login UI — they share tokens from the main app:

**iOS Widget (SwiftUI + WidgetKit):**
- No login flow — the widget reads the auth token from the main Expo app
- Token shared via App Group (Keychain or UserDefaults)
- The Expo app writes the Supabase access token and refresh token to the shared App Group on login and token refresh
- Widget reads the token and uses Supabase Swift SDK or REST API

**macOS Menu Bar Widget (SwiftUI):**
- Same pattern as iOS widget — shares token via Keychain (App Group)
- If the macOS app is a separate install (not bundled with the Expo app), it may need its own OAuth login flow via `ASWebAuthenticationSession`

**Apple Watch (SwiftUI + WatchKit):**
- Shares auth state from the companion iPhone app
- Token transferred via `WatchConnectivity` (WCSession) or Keychain sharing
- Watch never shows a login screen — it requires the phone to be authenticated first

#### Tier 3: Stored Tokens (VS Code, MCP)

These platforms authenticate once and store a long-lived token:

**VS Code Extension:**
- Uses VS Code's built-in authentication provider API or opens a browser for OAuth
- Standard pattern: `vscode.authentication.getSession()` or custom `AuthenticationProvider`
- Token stored in VS Code's `SecretStorage` (OS keychain-backed)
- Supabase refresh token enables long-lived sessions without re-login

**Claude Code MCP Server:**
- User authenticates via web or mobile first
- MCP server receives the user's Supabase refresh token via environment variable or config file
- Server uses `supabase.auth.setSession()` with the refresh token
- Alternative: service role key for server-to-server access (but loses per-user RLS)

#### Tier 4: Device Proxy (BLE Device)

**BLE Device (ESP32):**
- The device does NOT authenticate to Supabase
- The phone app is the auth proxy — all data flows through the authenticated phone
- Device gets a "device pairing token" — a random UUID generated during BLE pairing, stored in the `devices` table with the user's `user_id`
- BLE communication is secured by BLE pairing (LESC / Passkey), not OAuth
- When the phone syncs session data from the device to Supabase, it uses its own auth token

### Deferred Sign-Up (Anonymous Auth) Data Merge Strategy

Supabase supports anonymous sign-in via `supabase.auth.signInAnonymously()`. This creates a real row in `auth.users` with `is_anonymous = true`. When the user later signs up, Supabase promotes the same user row — the `user_id` does not change.

#### Same-Device Flow (Happy Path)

1. User opens app for the first time → `signInAnonymously()` → gets a `user_id`
2. User creates sessions, sets goals — all stored with this `user_id`
3. User decides to sign up → `linkIdentity()` (Apple/Google) or `updateUser()` (email/password)
4. Supabase sets `is_anonymous = false` on the same `auth.users` row
5. **No data migration needed** — all data already belongs to this `user_id`

#### Cross-Device Conflict (Edge Case)

Scenario: User uses the app anonymously on their phone AND their laptop. Both devices have different anonymous `user_id`s. User signs up on their phone.

1. Phone's anonymous user is promoted to authenticated (phone data is preserved)
2. Laptop's anonymous user is a different `user_id` — its data is orphaned
3. **Resolution:** When the laptop detects that the user signed in elsewhere (via Supabase Realtime or next API call), it prompts: "Sign in to sync your data"
4. If the user signs in on the laptop, the laptop gets the phone's `user_id`
5. **Laptop's anonymous data is lost** unless we implement a merge

**Design decision:** For v1, accept that cross-device anonymous data is lost when signing up on a different device. This is acceptable because:
- Pre-signup anonymous usage is short-lived (minutes to hours, not weeks)
- Session data is low-value before the user commits to the app
- Implementing cross-device anonymous merge is complex and not worth it pre-product-market-fit

**Future improvement:** If analytics show significant cross-device anonymous usage, implement a merge endpoint that takes two `user_id`s and re-parents all data from the old anonymous user to the new authenticated user.

### Auth Abstraction Layer

```
packages/core/         → receives userId: string as parameter. No auth imports.
packages/data-access/  → owns all Supabase Auth imports. Exports:
                          - signInAnonymously()
                          - signInWithOAuth(provider)
                          - signInWithEmail(email, password)
                          - signUp(email, password)
                          - signOut()
                          - getSession(): Session | null
                          - onAuthStateChange(callback)
                          - getUser(): User | null
```

This ensures `packages/core/` is auth-provider-agnostic. If a Better Auth migration ever happens, only `packages/data-access/` changes.

### RLS Policy Pattern

All tables with user data include a `user_id UUID REFERENCES profiles(id) ON DELETE CASCADE` column. A `get_user_id()` helper function maps `auth.uid()` to the application-level `profiles.id`, decoupling RLS from the auth provider. Standard RLS policy:

```sql
CREATE POLICY "Users can only access their own data"
ON table_name
FOR ALL
USING (user_id = get_user_id());
```

Social features (Library Mode, Quiet Feed) use scoped helper functions — `is_friend_focusing()` and `did_friend_focus_today()` — rather than broad session access policies. Friends never see raw session data.

See [ADR-005: Database Schema & Data Model](../decisions/005-database-schema-data-model.md) for the complete RLS policy design.

### GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Right to deletion | `ON DELETE CASCADE` on all `user_id` foreign keys. Deleting the `auth.users` row cascades to all user data. Expose a "Delete my account" button. |
| Right to export | Supabase function or Edge Function that queries all tables for `user_id = auth.uid()` and returns JSON. |
| Data residency | Select EU region when creating the Supabase project. |
| Consent | Privacy policy page. Cookie consent banner for analytics (auth itself is "legitimate interest" under GDPR). |
| Data minimization | Only collect what's needed: email, display name, profile photo (from OAuth). No phone number unless user opts in. |

## Alternatives Considered

### Better Auth from Day One

Rejected because it requires solving the JWT exchange problem — minting Supabase-compatible JWTs from Better Auth sessions — which adds a server-side function to every auth flow. Better Auth is not in Supabase's 5 supported third-party providers, so there's no native integration. The upfront setup cost is not justified when Supabase Auth works out of the box for all 9 platforms.

### Supabase Auth Now, Better Auth Later

Rejected because the migration invalidates all sessions, doesn't cover RLS policy reconfiguration, and means learning and building with two auth systems. The "later" rarely comes, and meanwhile lock-in deepens with every table that gets RLS policies. Instead, we commit to Supabase Auth and note Better Auth as a documented escape hatch.

### Clerk

Not considered in depth because it's a paid SaaS ($0.02/MAU after free tier) and adds vendor lock-in without the benefit of Supabase RLS integration. Clerk is a supported Supabase third-party provider, but the pricing doesn't align with "zero-cost MVP."

## Cross-Cutting Concerns

- **Security:** Supabase Auth handles token issuance, verification, and refresh. PKCE is used for mobile OAuth. Tokens are stored in secure platform-specific storage (Keychain, SecretStorage, expo-secure-store). BLE device uses BLE-level pairing security, not OAuth.
- **Cost:** Free for up to 50k MAUs. Pro plan ($25/month) covers 100k MAUs. Beyond that, $0.00325/MAU. At scale, Better Auth migration could save costs but is not planned.
- **Observability:** Supabase dashboard shows auth events (sign-ups, sign-ins, failures). For deeper observability, Supabase Auth logs can be queried via the Management API.
- **Migration path:** Better Auth's official migration guide supports batch processing (5k users/batch). Migration would invalidate sessions and require RLS policy updates. No planned date — triggered only by vendor lock-in or cost concerns.

## Open Questions

1. **Supabase anonymous auth + RLS:** Do anonymous users get a valid `auth.uid()` that works in RLS policies? (Expected: yes, since they have a real `auth.users` row, but needs verification during implementation.)
2. **Token refresh on widgets:** How frequently can WidgetKit widgets refresh? If the Supabase access token expires (default 1 hour), can the widget refresh it, or does the main app need to write a fresh token to the App Group periodically?
3. **VS Code auth provider:** Should we use VS Code's built-in `AuthenticationProvider` API or roll a custom OAuth-in-browser flow? The built-in API is cleaner but may have limitations with Supabase's specific OAuth flow.
4. **macOS widget bundling:** Is the macOS menu bar widget bundled with the Expo app (same App Group) or a separate install? This affects whether it can share the auth token or needs its own login flow.
