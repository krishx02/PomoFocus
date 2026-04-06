import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for a single Quiet Feed entry.
 *
 * Privacy (ADR-018, API-007): only identity + today's completed session count
 * is exposed. No goal names, durations, focus quality, or reflection data.
 */
export const FeedEntrySchema = z.object({
  friend_id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  sessions_today: z.number().int().nonnegative(),
});

/**
 * Zod schema for the GET /v1/feed/today response.
 */
export const FeedTodayResponseSchema = z.object({
  entries: z.array(FeedEntrySchema),
});

/**
 * OpenAPI route definition for GET /v1/feed/today.
 */
export const feedTodayRoute = createRoute({
  method: 'get',
  path: '/v1/feed/today',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FeedTodayResponseSchema,
        },
      },
      description: 'Friends who completed at least one focus session today',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            status: z.number(),
          }),
        },
      },
      description: 'Missing or invalid authorization token',
    },
  },
});

/**
 * Row shape returned by the friendships+profile nested select.
 * The nested FK join isn't inferred by the Supabase client, so we use
 * `.overrideTypes<FriendshipWithProfile[], { merge: false }>()` to supply it.
 */
type FriendshipWithProfile = {
  friend_id: string;
  friend: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

/**
 * Row shape returned by the today-sessions query.
 */
type FriendSessionRow = {
  user_id: string;
  ended_at: string | null;
};

/**
 * Returns midnight UTC for the current date as an ISO string.
 * Used to filter sessions with `ended_at >= today`.
 */
function todayMidnightUtc(now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

/**
 * Registers the GET /v1/feed/today route on the given OpenAPIHono app.
 *
 * Returns which friends completed at least one focus session today, with a
 * session count per friend. Privacy is enforced via the friendship JOIN
 * (ADR-018, API-007): only confirmed friends of the authenticated user are
 * included, and the response exposes no raw session data (no durations,
 * goal names, or reflection data).
 *
 * The route:
 *  1. Resolves the authenticated user from the user-scoped Supabase client.
 *  2. Fetches the user's confirmed friendships (RLS scopes to current user)
 *     with the friend's profile via a nested FK select.
 *  3. Uses the admin client (cross-user aggregation per API-005) to fetch
 *     today's completed sessions for those friend IDs only.
 *  4. Groups sessions by friend, counts them, picks max ended_at, and orders
 *     entries by most recent session descending.
 */
export function registerFeedRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(feedTodayRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userData.user.id;

    // Fetch the user's friendships with nested friend profile.
    // RLS on friendships scopes this to the authenticated user's rows.
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('friend_id, friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url)')
      .eq('user_id', userId)
      .overrideTypes<FriendshipWithProfile[], { merge: false }>();

    if (friendshipsError) {
      throw friendshipsError;
    }

    if (friendships.length === 0) {
      return c.json({ entries: [] }, 200);
    }

    const friendIds = friendships.map((f) => f.friend_id);

    // Cross-user aggregation: admin client bypasses RLS on sessions.
    // Privacy is enforced by the explicit `.in('user_id', friendIds)` filter
    // — sessions can only belong to confirmed friends of the current user.
    const admin = createAdminClient(c.env);

    const todayStart = todayMidnightUtc(new Date());

    const { data: sessionRows, error: sessionsError } = await admin
      .from('sessions')
      .select('user_id, ended_at')
      .in('user_id', friendIds)
      .eq('completed', true)
      .gte('ended_at', todayStart)
      .overrideTypes<FriendSessionRow[], { merge: false }>();

    if (sessionsError) {
      throw sessionsError;
    }

    // Aggregate in JS: group by user_id, count sessions, track max ended_at.
    const counts = new Map<string, { count: number; maxEndedAt: string }>();
    for (const row of sessionRows) {
      if (row.ended_at === null) {
        continue;
      }
      const existing = counts.get(row.user_id);
      if (existing) {
        existing.count += 1;
        if (row.ended_at > existing.maxEndedAt) {
          existing.maxEndedAt = row.ended_at;
        }
      } else {
        counts.set(row.user_id, { count: 1, maxEndedAt: row.ended_at });
      }
    }

    // Build entries only for friends who focused today (GROUP BY + HAVING COUNT > 0).
    type Entry = {
      friend_id: string;
      display_name: string;
      avatar_url: string | null;
      sessions_today: number;
      _maxEndedAt: string;
    };

    const entries: Entry[] = [];
    for (const f of friendships) {
      const agg = counts.get(f.friend_id);
      if (!agg || f.friend === null) {
        continue;
      }
      entries.push({
        friend_id: f.friend.id,
        display_name: f.friend.display_name,
        avatar_url: f.friend.avatar_url,
        sessions_today: agg.count,
        _maxEndedAt: agg.maxEndedAt,
      });
    }

    // Order by most recent session descending.
    entries.sort((a, b) => (a._maxEndedAt < b._maxEndedAt ? 1 : a._maxEndedAt > b._maxEndedAt ? -1 : 0));

    return c.json(
      {
        entries: entries.map((e) => ({
          friend_id: e.friend_id,
          display_name: e.display_name,
          avatar_url: e.avatar_url,
          sessions_today: e.sessions_today,
        })),
      },
      200,
    );
  });
}
