# Design: Notification Strategy

**Date:** 2026-03-10
**Status:** Accepted
**Related ADR:** [ADR-019](../decisions/019-notification-strategy.md)
**Platforms:** iOS app, Android app (Expo/React Native), web (Next.js), BLE device

## Context & Scope

PomoFocus is a multi-platform Pomodoro productivity app that needs notifications for four purposes: alerting users when a focus session ends, delivering real-time encouragement from friends, surfacing weekly analytics summaries, and nudging users toward their own goals. The challenge is designing a notification system for a focus app — notifications are inherently interruptive, but the app's core value is helping users focus. The strategy must work across Expo mobile (primary), Next.js web (secondary), and BLE device (firmware-controlled), within a $0/month budget and the existing CF Workers + Supabase architecture.

## Goals & Non-Goals

**Goals:**
- Deliver timer end alerts reliably across all platforms (local notification on mobile, Notification API on web, vibration on BLE)
- Enable real-time encouragement taps on mobile via push notifications
- Provide opt-in goal-aware habit nudges that help users maintain their focus practice
- Surface weekly analytics summaries at a user-chosen time
- Respect the user's attention — never interrupt an active focus session with social notifications
- Maintain $0/month notification infrastructure cost

**Non-Goals:**
- Web push notifications — excluded due to ~6% opt-in rates and service worker complexity
- Marketing or re-engagement notifications — "we miss you" messages are antithetical to the app's values
- Streak-at-risk warnings — creates extrinsic pressure, undermines autonomy (consistent with ADR-014's rejection of composite Focus Score)
- Background BLE notifications — device only receives encouragement taps when phone app is open and connected (post-v1 enhancement)
- Notification analytics or A/B testing — premature optimization for v1
- Rich notifications with images or action buttons — plain text with deep link is sufficient

## The Design

### Notification Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MOBILE (Expo)                         │
│                                                         │
│  Timer Start ──→ Schedule local notification (25 min)   │
│  Goal Set    ──→ Schedule daily local nudge              │
│  App Install ──→ Schedule weekly summary (user config)   │
│                                                         │
│  expo-notifications handles all local scheduling        │
│  + receives Expo Push for encouragement taps            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    WEB (Next.js)                         │
│                                                         │
│  Timer End   ──→ Notification API (backgrounded tab)    │
│  Taps/Summary──→ In-app toast/banner on next visit      │
│  Goal Nudge  ──→ Not applicable (no local scheduling)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    BLE DEVICE                            │
│                                                         │
│  Timer End   ──→ Firmware vibration + LED                │
│  Other       ──→ Not applicable for v1                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               SERVER (Hono on CF Workers)                │
│                                                         │
│  POST /v1/taps                                          │
│    → Create tap in DB                                   │
│    → Look up recipient's expo_push_token                │
│    → Call Expo Push API                                 │
│    → Store push receipt                                 │
└─────────────────────────────────────────────────────────┘
```

### Notification Type Details

#### 1. Timer End (Local)

**Mobile:** When the user starts a focus session, `expo-notifications.scheduleNotificationAsync()` schedules an alert for `workDuration` seconds in the future. The notification fires even if the app is backgrounded or killed. Content: "Focus session complete! Time for a break." If the user pauses or abandons the session, the scheduled notification is cancelled via the notification identifier.

**Web:** Uses the browser `Notification` API (not Web Push). When the timer page is open and the tab is backgrounded, a `new Notification()` fires at timer end. Requires one-time permission grant. If the tab is active, the in-app UI handles the alert (sound + visual).

**BLE:** Firmware triggers vibration motor (300ms pulse × 3) and LED blink at timer completion. Fully self-contained — no phone involvement needed.

#### 2. Encouragement Tap (Push + In-App Fallback)

**Server flow:**
1. Sender calls `POST /v1/taps` (existing ADR-018 endpoint)
2. API creates the tap record in the database
3. API queries `devices` table for recipient's `expo_push_token`
4. If token exists, API calls Expo Push API: `{ to: token, title: "Encouragement!", body: "${senderName} is rooting for you!", data: { type: "tap", tapId } }`
5. API stores the Expo push receipt ID for delivery tracking
6. Returns tap response to sender

**Mobile (app foregrounded):** In-app toast notification. No OS notification — avoid duplicate alerts.

**Mobile (app backgrounded/closed):** OS push notification via Expo Push Service → APNs/FCM.

**Mobile (during active focus session):** Push arrives silently. `interruptionLevel: .passive` on iOS. Low-priority channel on Android. Notification appears in notification center but doesn't buzz/ring. Surfaced on the reflection screen after session ends.

**Web:** No push. Taps appear as in-app toast/banner when user next visits. Badge count on the social tab.

**Permission denied fallback:** Taps still appear in the in-app notification inbox (stored in TanStack Query cache from `GET /v1/taps`). User sees them on next app open. Push permission denial degrades the experience but doesn't break it.

#### 3. Weekly Summary (Local)

**Mobile:** Scheduled via `expo-notifications` with a weekly repeating trigger. Default: Sunday at 7:00 PM in the user's local timezone. User can configure day and time in settings. Content: "Your weekly focus summary is ready. Tap to see your progress." Deep links to the analytics screen.

**Web:** No local scheduling. When user visits and new weekly data is available (checked via TanStack Query staleTime), an in-app banner appears: "Your weekly summary is ready."

#### 4. Goal Nudge (Local)

**Mobile:** When a user creates or updates a process goal with a target frequency (e.g., "Study calculus 3x/week"), the app schedules daily local notifications at the user's preferred focus time. The nudge fires only on days relevant to the goal's schedule and only if no session has been started today (checked at notification handling time via `expo-notifications` background task).

Content: "You planned to [goal name] today. Ready to start?" — goal-aware, personal, not generic.

Self-cancellation logic: the notification is always scheduled, but the `handleNotification` callback checks whether a session exists for today. If yes, it suppresses the notification (returns `shouldShowAlert: false`).

**Web:** Not applicable — no local scheduling mechanism without service worker. Users who primarily use web see goal progress on the dashboard.

### Push Token Lifecycle

```
App Launch
  → Check if expo_push_token exists locally
  → If not: Notifications.getExpoPushTokenAsync()
  → Register/update token: PATCH /v1/devices/:id { expo_push_token }
  → Listen for token refresh events

Token Refresh (rare — Expo/APNs/FCM rolls token)
  → Notifications.addPushTokenListener(callback)
  → PATCH /v1/devices/:id { expo_push_token }

User Signs Out
  → PATCH /v1/devices/:id { expo_push_token: null }
  → Cancel all local scheduled notifications
```

Token storage: `expo_push_token TEXT` column on the existing `devices` table (ADR-005). One token per device. RLS ensures only the device owner can read/write their token.

### Permission Request Flow

**When:** After the user creates their first focus session and the timer starts for the first time.

**Why this moment:** The user just performed the core action — they understand they need timer alerts. Framing: "PomoFocus needs notifications to alert you when your focus session ends. Allow notifications?" This is a high-value, obvious permission ask. Research shows permission requests at the 3rd-4th app interaction have the highest acceptance rates.

**If denied:** Timer still works (the in-app UI shows timer end). Goal nudges and weekly summaries don't fire. Encouragement taps appear in-app on next open. A non-intrusive settings prompt appears occasionally: "Enable notifications to get timer alerts and encouragement from friends."

### Notification Philosophy: The "3+1 Rule"

PomoFocus sends exactly four types of notifications. No more. Ever.

1. **Timer end** — you asked for this (your action, your timer)
2. **Encouragement tap** — your friend is thinking of you (their action, max 3/day per friend)
3. **Weekly summary** — your data, your schedule (your configuration)
4. **Goal nudge** — your commitment, your time (your goal, self-cancelling)

Explicitly excluded:
- "You haven't focused in X days" — re-engagement guilt
- "Your streak is at risk!" — extrinsic pressure (anti-SDT, consistent with ADR-014)
- "New feature available!" — marketing
- "Your friend just finished a session" — noise (they can check Quiet Feed)
- Any notification not directly tied to the user's own goals or explicit social interaction

This is a **product constraint**, not just a v1 scope decision. If a proposed notification doesn't fit one of the four types, it requires a new ADR to justify adding it.

## Alternatives Considered

### Local-only (no push)

Rejected because encouragement taps become meaningless — the "tap" metaphor implies real-time feedback. ADR-018 designed the social feature around immediate encouragement. Delayed-by-hours taps are just a notification badge, not a tap. The marginal complexity of Expo Push (~10 lines of server code, one DB column) is worth preserving the feature's intent.

### Full push (mobile + web)

Rejected because web push has ~6% opt-in rates ([industry data](https://www.mobiloud.com/blog/push-notification-statistics)), requires a service worker in Next.js, creates two separate push code paths (Expo Push API + web-push/VAPID), and Safari doesn't support Web Push on iOS (those users have the native app). The complexity-to-value ratio is unfavorable for a mobile-first app.

### FCM unified (mobile + web)

Rejected because it introduces a Firebase dependency (project, service account, REST API since `firebase-admin` doesn't work on CF Workers), bypasses Expo Push Service (losing Expo's unified API and tooling), and adds Google vendor lock-in for marginal web push benefit.

## Cross-Cutting Concerns

- **Security:** Push tokens are device-specific identifiers stored server-side in the `devices` table with RLS. Notification content never includes session details, goal content, or reflection text — only names and generic messages ("Sarah is rooting for you!"). This aligns with ADR-018's privacy rules (friends never see raw session data) and ADR-012's data minimization principle.

- **Cost:** $0/month. Expo Push Service is free (bundled with Expo). Local notifications are device-side (free). No paid push providers. No FCM costs. The only server cost is the marginal CF Worker CPU time for calling Expo's Push API (~1ms per tap).

- **Observability:** Push delivery is tracked via Expo push receipts (returned by the Push API). Failed deliveries (invalid tokens, expired tokens) trigger token cleanup. Sentry (ADR-011) captures notification scheduling errors on the client. No custom notification analytics for v1 — Expo's push receipt API provides basic delivery confirmation.

- **Migration path:** If web push becomes necessary, it's additive — add a service worker to `apps/web/public/sw.js`, add `web_push_subscription` column to a new table, add a web push sending path alongside Expo Push in the taps endpoint. No changes to the mobile notification architecture. If Expo Push Service becomes a concern, the migration path is direct APNs + FCM calls from CF Workers (the `fcm-cloudflare-workers` library exists).

## Open Questions

- **iOS Focus Mode integration:** Should PomoFocus register as a Focus Mode-aware app? This would let users configure which PomoFocus notifications break through their system-level Focus Mode. Requires iOS 16+ API research. Low priority for v1.
- **Notification grouping:** If a user receives multiple encouragement taps while backgrounded, should they be grouped into one notification ("3 friends encouraged you") or shown individually? Expo supports notification categories. Decision can be made during implementation.
- **Goal nudge onboarding:** How does the user set their "preferred focus time" for goal nudges? During goal creation? In settings? A dedicated onboarding step? UX decision, not architecture.
- **BLE encouragement vibration (post-v1):** When the phone receives a tap push and the BLE device is connected and idle, the phone could send a BLE command to trigger device vibration. Requires a new BLE characteristic or repurposing the timer_command characteristic. Architecture is straightforward but deferred.
