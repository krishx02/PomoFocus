# ADR-019: Notification Strategy

**Status:** Accepted
**Date:** 2026-03-10
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container)
**Platforms:** iOS app, Android app (Expo/React Native), web (Next.js), BLE device

## Context and Problem Statement

PomoFocus needs a notification strategy that covers timer completion alerts, social encouragement taps, weekly insight summaries, and goal-based habit nudges — across mobile, web, and BLE device. The core tension: a focus app that spam-notifies is a contradiction. The strategy must balance user retention (research shows productivity apps see 49% higher retention with push opt-in) against the calm technology principle that notifications should help users accomplish their goals, not interrupt them. Constraints include $0/month budget, no always-on server (ADR-008), polling-first architecture (ADR-003), and all traffic through the Hono API (ADR-007).

## Decision Drivers

- **Calm technology philosophy** — notifications must help users achieve their goals, never distract from them. A focus app that over-notifies undermines its own value proposition.
- **Simplicity** — minimize infrastructure. Local notifications require zero server infrastructure. Push adds token management and API calls.
- **Cost** — $0/month. Expo Push Service is free. Local notifications are free. No paid push providers.
- **User experience** — encouragement taps must feel real-time on mobile to justify the "tap" metaphor. Goal nudges must be goal-aware, not generic "come back!" messages.
- **Cross-platform consistency** — mobile is the primary notification platform. Web is notification-light. BLE device uses firmware-controlled vibration + LED.

## Considered Options

1. **Local-only** — all notifications are local scheduled. No push infrastructure. Encouragement taps show on next app open.
2. **Local + Expo Push for mobile social** — timer/summary/nudge are local. Encouragement taps use Expo Push Service on mobile. Web gets in-app notifications only.
3. **Local + Expo Push (mobile) + Web Push (web)** — full push coverage across all platforms.
4. **Local + FCM unified** — Firebase Cloud Messaging as single push provider for mobile + web.

## Decision Outcome

Chosen option: **"Local + Expo Push for mobile social"** (Option 2), because it delivers real-time encouragement taps on mobile (where users actually are) with minimal infrastructure, while keeping timer/summary/nudge as zero-cost local notifications. Web push is excluded — ~6% opt-in rates and service worker complexity don't justify the investment for a mobile-first app.

### Notification Types

| Notification      | Mechanism                                  | Trigger                                                               | Frequency                  | Platform                                                                                         |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Timer end         | Local scheduled                            | User starts focus session                                             | Per session                | Mobile: `expo-notifications`. Web: Notification API (backgrounded tab). BLE: vibration + LED.    |
| Encouragement tap | Push (Expo Push Service) + in-app fallback | Friend sends tap                                                      | Max 3/day/friend (ADR-018) | Mobile: push when backgrounded, in-app toast when foregrounded. Web: in-app toast on next visit. |
| Weekly summary    | Local scheduled                            | User-configured day/time (default: Sunday 7pm)                        | 1/week                     | Mobile: `expo-notifications`. Web: banner on next visit.                                         |
| Goal nudge        | Local scheduled                            | User's preferred focus time, skipped if session already started today | Max 1/day                  | Mobile: `expo-notifications`. Web: not applicable (no local scheduling).                         |

### Key Architecture Decisions

| Decision                     | Choice                                                                         | Why                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push provider                | **Expo Push Service** (free)                                                   | Wraps APNs + FCM with one unified API. Cross-platform. No vendor lock-in — APNs/FCM are the real transport.                                                                                 |
| Push scope                   | **Mobile only**                                                                | Web push has ~6% opt-in rates, requires service worker, two code paths. Not worth the complexity.                                                                                           |
| Push token storage           | **`expo_push_token` column on `devices` table** (ADR-005)                      | Natural extension of existing schema. One token per device.                                                                                                                                 |
| Push sending                 | **Hono API endpoint** (`apps/api/`)                                            | When `POST /v1/taps` creates a tap, look up recipient's push token, call Expo Push API. ~10 lines of server code.                                                                           |
| Permission timing            | **Request at first timer creation**                                            | High-value moment — "PomoFocus needs notifications to alert you when your focus session ends." Timer apps have high opt-in rates. Not at app launch.                                        |
| During active session        | **Silent delivery**                                                            | Encouragement taps received during `focusing` state arrive silently (no sound, no vibration). Surfaced in reflection screen after session ends or in notification center.                   |
| In-app fallback              | **Always show in-app toast/banner**                                            | Works even if push permission denied. Badge count for unread taps.                                                                                                                          |
| Goal nudge content           | **Goal-aware**                                                                 | "You planned to study calculus today. Ready?" — not "We miss you!" Backed by 2024 CHI research showing 4x engagement for goal-relevant notifications.                                       |
| Goal nudge self-cancellation | **Skip if session started today**                                              | If user already focused today, no nudge fires. Avoids nagging.                                                                                                                              |
| Web notifications            | **Notification API for timer (backgrounded tab) + in-app for everything else** | No service worker, no Web Push API. Minimal web notification surface.                                                                                                                       |
| BLE device                   | **Firmware-controlled vibration + LED for timer end only**                     | Encouragement tap vibration via BLE command is a post-v1 enhancement.                                                                                                                       |
| Notification philosophy      | **"3+1 rule"**                                                                 | Timer end (your action), encouragement tap (friend's action), weekly summary (your schedule), goal nudge (your commitment). Nothing else. No marketing, no "come back," no streaks-at-risk. |

### Server-Side Components

```
POST /v1/taps (existing ADR-018 endpoint)
  → Create tap in database
  → Look up recipient's expo_push_token from devices table
  → If token exists: call Expo Push API with notification payload
  → Store push receipt for delivery tracking
  → Return tap response to sender
```

No new CF Cron Triggers. No new Workers. No new tables. One new column (`expo_push_token` on `devices`) and ~10 lines of push-sending logic in the existing taps endpoint.

### Consequences

- **Good:** Real-time encouragement taps on mobile — the "tap" metaphor works as intended. Goal nudges backed by behavioral research (2024 CHI, JMIR studies). Zero ongoing cost. In-app fallback means denied permissions don't break the experience completely. Calm notification philosophy prevents feature creep into spam territory. Only one push code path (Expo Push), not two (Expo + web-push).
- **Bad:** Web users don't receive push notifications — encouragement taps are delayed until next visit. iOS notification permission denial blocks both local and push (single permission for both). If the app isn't open, BLE device doesn't receive encouragement tap vibrations. Goal nudge requires user to configure preferred focus time (onboarding friction).
- **Neutral:** Web Push can be added later as a clean addition — no rearchitecture needed. BLE encouragement vibration is a natural post-v1 enhancement via a new BLE characteristic. Expo Push Service is a dependency, but it's free and the underlying transport is APNs/FCM.

## Pros and Cons of the Options

### Local-only (no push)

- Good, because zero server infrastructure for notifications — simplest possible implementation
- Good, because no push token management, no APNs/FCM certificates, no device registration
- Good, because works offline, no network dependency for any notification
- Bad, because encouragement taps are invisible until app open — defeats the "tap" metaphor
- Bad, because web has no viable local notification mechanism (requires service worker or tab open)
- Bad, because research shows productivity apps see 49% higher retention with push opt-in ([Airship 2024](https://grow.urbanairship.com/rs/313-QPJ-195/images/airship-how-push-notifications-impact-mobile-app-retention-rates.pdf))

### Local + Expo Push for mobile social (chosen)

- Good, because encouragement taps arrive in real-time on mobile — feels like a real nudge
- Good, because Expo Push Service is free, handles APNs + FCM with one unified API
- Good, because only one new server component (~10 lines in taps endpoint)
- Good, because push token storage is one column in existing `devices` table
- Good, because in-app fallback works even if push permission denied
- Bad, because web users don't get push notifications — feature parity gap
- Bad, because iOS permission denial blocks all notification types (local + push share one permission)
- Bad, because Expo Push Service is a vendor dependency (mitigated: APNs/FCM are the real transport)

### Local + Expo Push (mobile) + Web Push (web)

- Good, because feature parity across all platforms
- Good, because Web Push uses standard VAPID keys — self-hosted, no vendor dependency
- Bad, because ~6% web push opt-in rate — builds infrastructure for very few users
- Bad, because service worker complexity in Next.js (separate code path from mobile)
- Bad, because two push code paths to maintain (Expo Push API + web-push library)
- Bad, because Safari doesn't support Web Push on iOS (those users have the native app)

### Local + FCM unified (mobile + web)

- Good, because one push API for all platforms (FCM wraps APNs for iOS)
- Good, because FCM is free with no message limits
- Bad, because Firebase dependency — need Firebase project, service account credentials
- Bad, because `firebase-admin` doesn't work on CF Workers (must use REST API)
- Bad, because bypasses Expo Push Service — loses Expo's unified API and tooling
- Bad, because Google vendor lock-in for a core feature

## Research Sources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) — `expo-notifications` API for local and push
- [Expo Push Notification Guide](https://docs.expo.dev/push-notifications/what-you-need-to-know/) — push vs local, Expo Push Service architecture
- [2024 CHI Conference: Contextual Notifications in mHealth](https://dl.acm.org/doi/10.1145/3613904.3641993) — goal-relevant, contextual notifications get faster and more frequent responses
- [JMIR: Notifications and Behavior Change App Engagement](https://mhealth.jmir.org/2023/1/e38342) — perceived usefulness (goal-relevance) drives notification engagement
- [Airship 2024 Push Notification Benchmark Report](https://grow.urbanairship.com/rs/313-QPJ-195/images/airship-how-push-notifications-impact-mobile-app-retention-rates.pdf) — productivity apps see 49% higher retention with push; personalized push drives 400% more engagement
- [MobileLoud: 50+ Push Notification Statistics 2025](https://www.mobiloud.com/blog/push-notification-statistics) — 46% of users disable after 2-5 weekly pushes
- [MagicBell: Mindful Messaging](https://www.magicbell.com/blog/mindful-messaging-how-apps-can-make-their-notifications-more-meaningful) — notifications should help users achieve goals
- [Android Police: Calm Technology Replacing Notification Overload](https://www.androidpolice.com/say-goodbye-to-pings/) — calm technology design philosophy
- [Push Notifications in Next.js with Web-Push (Designly)](https://blog.designly.biz/push-notifications-in-next-js-with-web-push-a-provider-free-solution) — VAPID-based web push implementation
- [fcm-cloudflare-workers (GitHub)](https://github.com/celestifyhq/fcm-cloudflare-workers) — FCM from CF Workers (evaluated, not chosen)
- [Business of Apps: Push Notification Statistics](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/) — 95% churn if opt-in but zero pushes in 90 days

## Related Decisions

- [ADR-003: Client State Management](./003-client-state-management.md) — polling-first architecture. Notifications are event-driven, orthogonal to polling.
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — timer states determine when notifications fire (timer end) and when to suppress them (silent delivery during `focusing`).
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — `devices` table stores `expo_push_token`. `sessions` table drives goal nudge logic.
- [ADR-007: API Architecture](./007-api-architecture.md) — push sending goes through Hono API on CF Workers. `POST /v1/taps` calls Expo Push API.
- [ADR-013: BLE GATT Protocol Design](./013-ble-gatt-protocol-design.md) — BLE device timer end is firmware-controlled vibration. Encouragement tap vibration via BLE is post-v1.
- [ADR-014: Analytics & Insights Architecture](./014-analytics-insights-architecture.md) — weekly summary notification links to Tier 2 analytics.
- [ADR-018: Social Features Architecture](./018-social-features-architecture.md) — encouragement taps (max 3/day/pair) are the only push notification trigger. `POST /v1/taps` endpoint extended with push sending.
