# Design: Social Features Architecture

**Date:** 2026-03-09
**Status:** Accepted
**Related ADR:** [ADR-018](../decisions/018-social-features-architecture.md)
**Platforms:** iOS app, Android app (Expo/React Native), web (Next.js)

## Context & Scope

PomoFocus includes six social features: Library Mode (see who's focusing), Quiet Feed (who focused today), encouragement taps (private kudos), friend management (add/remove), invite links (shareable URLs), and friend requests (pending approvals). The database schema (ADR-005) already defines the tables, RLS policies, and helper functions. This design covers the application layer: API endpoints, client-side data flow, polling strategy, and privacy enforcement.

Social features are limited to mobile + web for v1. iOS widget, Apple Watch, VS Code, MCP, and BLE device get no social surfaces. The API is platform-agnostic, so extending to other platforms later requires no architectural change.

## Goals & Non-Goals

**Goals:**
- Define all social API endpoints with request/response shapes
- Design efficient data flow for Library Mode (the only polling feature)
- Establish privacy enforcement strategy across API and database layers
- Specify client-side state management for social data
- Handle edge cases: session expiry, tap rate limiting, invite link resolution

**Non-Goals:**
- Push notifications for social events (deferred to Notification Strategy ADR)
- Background BLE sync of social data
- Social features on iOS widget, watchOS, macOS, VS Code, or MCP
- Real-time presence via WebSockets or Supabase Realtime
- Social analytics (e.g., "you focused with friends X times this week")

---

## The Design

### Data Flow Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile/Web  │────▶│  Hono API    │────▶│  Supabase    │
│  (React)     │◀────│  (CF Workers)│◀────│  (Postgres)  │
└─────────────┘     └──────────────┘     └──────────────┘
      │                                         │
      │  TanStack Query                         │  RLS + friendship
      │  screen-scoped polling                  │  JOINs enforce
      │  (Library Mode only)                    │  data boundaries
      │                                         │
      ▼                                         ▼
  Zustand store                           Sessions table
  (social UI state)                       = presence layer
```

### Feature 1: Library Mode (Who's Focusing)

**Concept:** When the user navigates to Library Mode, they see which friends are currently in a focus session with approximate time remaining.

**API:** `GET /v1/friends/focusing`

**Server query:**
```sql
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  s.started_at,
  up.work_duration
FROM friendships f
JOIN profiles p ON p.id = f.friend_id
JOIN sessions s ON s.user_id = f.friend_id
  AND s.ended_at IS NULL
  AND s.started_at > NOW() - INTERVAL '4 hours'
JOIN user_preferences up ON up.user_id = f.friend_id
WHERE f.user_id = get_user_id();
```

**Response shape:**
```json
{
  "friends": [
    {
      "id": "uuid",
      "display_name": "Sarah",
      "avatar_url": "https://...",
      "started_at": "2026-03-09T14:30:00Z",
      "work_duration": 25
    }
  ]
}
```

**Client behavior:**
1. Fetch on entering Library Mode screen
2. Compute time remaining locally: `remaining = workDuration - Math.floor((Date.now() - startedAt) / 60000)`
3. Update countdown display every 60 seconds (local, no server call)
4. Re-poll server using adaptive interval:
   - First 2 minutes on screen: every 30 seconds
   - After 2 minutes: every 60 seconds
5. Stop polling when user leaves Library Mode screen

**TanStack Query configuration:**
```ts
useQuery({
  queryKey: ['friends', 'focusing'],
  queryFn: () => api.GET('/v1/friends/focusing'),
  refetchInterval: (query) => {
    const age = Date.now() - query.state.dataUpdatedAt;
    return age > 2 * 60 * 1000 ? 60_000 : 30_000;
  },
  enabled: isLibraryModeActive, // screen-scoped
});
```

**Privacy:** Response contains display name, avatar, session start time, and work duration ONLY. No goal names, no reflection data, no session quality. Friends see "Sarah is focusing, ~12 min left" and nothing more.

**Edge case — stale sessions:** If a user's app crashes, `ended_at` stays NULL. The `started_at > NOW() - INTERVAL '4 hours'` filter ensures stale sessions don't appear in Library Mode indefinitely (4 hours accommodates sessions up to 2 hours with 2x safety margin). Application code in `core/` should also expire sessions after 2x configured work duration.

---

### Feature 2: Quiet Feed (Who Focused Today)

**Concept:** A simple daily summary showing which friends completed at least one focus session today. One entry per friend per day — not per session.

**API:** `GET /v1/feed/today`

**Server query:**
```sql
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  COUNT(s.id) AS sessions_today
FROM friendships f
JOIN profiles p ON p.id = f.friend_id
JOIN sessions s ON s.user_id = f.friend_id
  AND s.status = 'completed'
  AND s.ended_at >= CURRENT_DATE
WHERE f.user_id = get_user_id()
GROUP BY p.id, p.display_name, p.avatar_url
ORDER BY MAX(s.ended_at) DESC;
```

**Response shape:**
```json
{
  "entries": [
    {
      "friend_id": "uuid",
      "display_name": "Sarah",
      "avatar_url": "https://...",
      "sessions_today": 3
    }
  ]
}
```

**Client behavior:**
- Fetch on navigate to Feed screen
- **No polling.** Data changes at most every 25 minutes (session length). Pull-to-refresh is sufficient.
- TanStack Query `staleTime: 5 * 60 * 1000` (5 minutes)

**Privacy:** Friends see "Sarah focused today (3 sessions)." No goal names, no durations, no quality ratings.

---

### Feature 3: Encouragement Taps

**Concept:** Toggle-style kudos. When viewing a friend's Quiet Feed entry, the user can tap to encourage (and un-tap to remove). Max 3 taps per sender per recipient per day.

**Send tap:** `POST /v1/taps`
```json
{ "recipient_id": "friend-uuid" }
```

**Remove tap:** `DELETE /v1/taps/:id`

**Receive taps:** `GET /v1/taps`
```sql
SELECT et.id, et.created_at, p.display_name, p.avatar_url
FROM encouragement_taps et
JOIN profiles p ON p.id = et.sender_id
WHERE et.recipient_id = get_user_id()
  AND et.created_at > NOW() - INTERVAL '24 hours'
ORDER BY et.created_at DESC;
```

**Rate limiting (API level):**
```ts
// In Hono middleware for POST /v1/taps
const todayCount = await db.query(`
  SELECT COUNT(*) FROM encouragement_taps
  WHERE sender_id = $1 AND recipient_id = $2
    AND created_at >= CURRENT_DATE
`, [userId, recipientId]);

if (todayCount >= 3) {
  return c.json({ error: 'Max 3 taps per friend per day' }, 429);
}
```

**Client behavior:**
- **Sending:** Optimistic UI — tap button toggles immediately, POST fires in background
- **Receiving:** Fetch on app open. No polling. User sees "Sarah sent you encouragement" when they next open the app.
- TanStack Query invalidation: after sending/removing a tap, invalidate `['taps']` and `['feed', 'today']`

**Privacy:** Taps are private — only sender and recipient know. No public feed. No message content — just "someone cheered for you."

---

### Feature 4: Friend Requests

**Send request:** `POST /v1/friend-requests`
```json
{ "recipient_username": "sarah123" }
```

Server logic:
1. Look up recipient by username (`profiles.username`)
2. Verify no existing request or friendship
3. Insert into `friend_requests`

**List pending:** `GET /v1/friend-requests`

**Accept:** `POST /v1/friend-requests/:id/accept`
- Triggers `create_friendship_pair()` Postgres function (ADR-005)
- Creates dual friendship rows, deletes the request
- Checks friend count limit (max 100)

**Decline:** `DELETE /v1/friend-requests/:id`

**Client behavior:**
- Fetch pending requests on app open
- Show badge/count indicator if pending requests > 0
- No polling — pull-to-refresh
- After accept/decline, invalidate `['friend-requests']` and `['friends']`

---

### Feature 5: Friend List & Unfriending

**List friends:** `GET /v1/friends`
```sql
SELECT p.id, p.display_name, p.avatar_url, p.username
FROM friendships f
JOIN profiles p ON p.id = f.friend_id
WHERE f.user_id = get_user_id()
ORDER BY p.display_name;
```

**Unfriend:** `DELETE /v1/friends/:id`
- Deletes both friendship rows in a transaction (dual-row pattern)
- Server logic:
```sql
BEGIN;
  DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2;
  DELETE FROM friendships WHERE user_id = $2 AND friend_id = $1;
COMMIT;
```

**Client behavior:**
- Fetch on navigate to Friends screen
- Cache with long `staleTime` — friend list rarely changes
- Pull-to-refresh
- After unfriend, invalidate `['friends']`, `['friends', 'focusing']`, `['feed', 'today']`

**Friend limit:** Max 100 friends per user. Enforced at API level when accepting friend requests.

---

### Feature 6: Invite Links

**Format:** `pomofocus.app/invite/USERNAME` — stateless, no tokens, no expiry, no DB storage for the link itself.

**API:** `GET /v1/invite/:username`
```sql
SELECT p.id, p.display_name, p.avatar_url
FROM profiles p
WHERE p.username = $1;
```

**Flow:**
1. User A shares `pomofocus.app/invite/sarah123` (text, social media, anywhere)
2. User B clicks the link
3. **Has app:** Deep link opens app → shows Sarah's profile → "Add Friend" button → `POST /v1/friend-requests`
4. **No app:** Web page shows Sarah's profile + app store links
5. **Not logged in:** Redirect to signup, then back to invite page

**No tokens, no expiry, no invite table.** The link is just a username. The only DB hit is resolving the username to a profile.

---

## Client-Side State Management

Social data lives in TanStack Query (server state), not Zustand (local state). The only Zustand state is UI state like "is Library Mode screen active" (controls polling).

```
packages/state/src/social/
├── useFriends.ts              # GET /v1/friends
├── useFriendsFocusing.ts      # GET /v1/friends/focusing (adaptive polling)
├── useFeedToday.ts            # GET /v1/feed/today
├── useFriendRequests.ts       # GET /v1/friend-requests
├── useTaps.ts                 # GET /v1/taps
├── useSendFriendRequest.ts    # POST /v1/friend-requests (mutation)
├── useAcceptFriendRequest.ts  # POST /v1/friend-requests/:id/accept (mutation)
├── useUnfriend.ts             # DELETE /v1/friends/:id (mutation)
├── useSendTap.ts              # POST /v1/taps (mutation)
├── useRemoveTap.ts            # DELETE /v1/taps/:id (mutation)
└── useResolveInvite.ts        # GET /v1/invite/:username
```

Each mutation hook invalidates relevant query keys on success:

| Mutation | Invalidates |
|----------|-------------|
| Accept friend request | `['friend-requests']`, `['friends']` |
| Decline friend request | `['friend-requests']` |
| Unfriend | `['friends']`, `['friends', 'focusing']`, `['feed', 'today']` |
| Send/remove tap | `['taps']`, `['feed', 'today']` |

---

## Privacy Model

| Data | Who can see | Enforcement |
|------|-------------|-------------|
| Active session existence + time remaining | Confirmed friends only | Friendship JOIN in `/v1/friends/focusing` query |
| Session count today | Confirmed friends only | Friendship JOIN in `/v1/feed/today` query |
| Goal names, reflection data, quality ratings | User only | Not included in any social endpoint response |
| Encouragement taps | Sender + recipient only | RLS on `encouragement_taps` table |
| Friend list | User only | RLS on `friendships` table |
| Profile (name, avatar, username) | Friends + anyone with invite link | RLS + public username lookup for invites |

**Enforcement discipline:** All social API endpoints MUST include a `friendships` JOIN that verifies the requesting user is friends with the target. The DB functions `is_friend_focusing()` and `did_friend_focus_today()` are repurposed as integration test helpers — tests verify that API endpoint results match DB function results to catch missing friendship checks.

---

## Alternatives Considered

### Single composite endpoint (`GET /v1/social`)
Rejected because social features have fundamentally different refresh needs. Library Mode needs polling (session state changes in real-time), while Quiet Feed data changes at most every 25 minutes, and friend requests/taps are event-driven. A composite endpoint would either over-poll for slow-changing data or under-poll for Library Mode. Screen-scoped polling eliminates the DB load concern that motivated the composite approach.

### Supabase Realtime for presence
Rejected per ADR-003 (polling-first). WebSockets add infrastructure complexity and connection management. Polling at 30-60s is more than sufficient for 25-minute sessions. The user tolerates 30-60 seconds of staleness when someone starts or stops focusing.

### CF Workers KV cache for social data
Evaluated but deferred. KV's eventual consistency (up to 60s between regions) would be fine for social data, but at v1 scale, Postgres handles the query volume directly. KV adds a caching layer to maintain and invalidate. Can be added later if DB load becomes a concern (unlikely at v1 scale).

### Separate presence table or system
Rejected. The `sessions` table already tracks active sessions (`ended_at IS NULL`). A separate presence table would duplicate this information and create consistency challenges. "Is focusing" = "has an active session" — the sessions table IS the presence layer.

---

## Cross-Cutting Concerns

- **Security:** All social endpoints validate the user's Supabase JWT (ADR-007). Friendship JOINs prevent data access for non-friends. Invite link resolution is the only public query (username → profile). Rate limiting on taps (3/day/pair) and friend requests (no duplicate requests) prevents abuse.
- **Cost:** At v1 scale, social queries are negligible. Library Mode: ~3-33 queries/second depending on concurrent viewers (well within Postgres and CF Workers capacity). No additional infrastructure cost.
- **Observability:** Social endpoints use the same CF Workers dashboard metrics as other API routes (ADR-011). Sentry captures errors. No special observability needed for social features.
- **Migration path:** N/A — this is a new feature, not replacing anything. If presence needs become more demanding (sub-second), can add Durable Objects + WebSockets within CF Workers ecosystem without changing the API contract (just the internal implementation).

## Open Questions

1. **Push notifications for encouragement taps** — deferred to Notification Strategy ADR. For v1, taps are visible only in-app on next open.
2. **Tap association with sessions** — current design associates taps with sender + recipient + day. If we later want taps on specific sessions, add an optional `session_id` FK to `encouragement_taps`.
3. **Library Mode pauses** — v1 ignores pauses (shows approximate time remaining). If users want precise countdowns, add `total_paused_seconds` column to sessions and adjust the client-side calculation.
4. **Friend search** — current design uses exact username match for friend requests. If fuzzy search is needed, add a `profiles.username` trigram index and a search endpoint.
5. **Block/report** — not in v1 scope. When needed, add a `blocked_users` table and filter blocked users from all social queries.
