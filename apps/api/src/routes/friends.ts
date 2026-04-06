import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';

/**
 * Four hours in milliseconds — stale session filter for Library Mode.
 * Catches crashed apps where `ended_at` stays NULL. 4 hours accommodates
 * sessions up to 2 hours with a 2x safety margin (ADR-018).
 */
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Zod schema for a single friend currently focusing.
 *
 * Privacy (ADR-018): contains ONLY display name, avatar, session start time,
 * and work duration. No goal names, no reflection data, no session quality.
 */
export const FocusingFriendSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  started_at: z.string(),
  work_duration: z.number().int(),
});

/**
 * Zod schema for the GET /v1/friends/focusing response.
 */
export const ListFocusingFriendsResponseSchema = z.object({
  friends: z.array(FocusingFriendSchema),
});

/**
 * OpenAPI route definition for GET /v1/friends/focusing.
 */
export const listFocusingFriendsRoute = createRoute({
  method: 'get',
  path: '/v1/friends/focusing',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListFocusingFriendsResponseSchema,
        },
      },
      description: 'List of friends with active focus sessions',
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
 * Registers the GET /v1/friends/focusing route on the given OpenAPIHono app.
 *
 * Library Mode API (ADR-018, Feature 1). Returns the authenticated user's
 * confirmed friends who currently have an active focus session (presence data).
 *
 * Privacy model (ADR-018, API-007): enforced via explicit friendship JOIN in
 * API code — NOT via RLS. Uses the admin (service_role) client to bypass the
 * `sessions_all_own` RLS policy, then restricts results to sessions whose
 * `user_id` is in the authenticated user's `friendships.friend_id` set.
 * Response contains only display name, avatar, start time, and work duration —
 * no goal names, quality, intention text, or reflection data.
 *
 * Stale session filter: `started_at > NOW() - INTERVAL '4 hours'` catches
 * crashed apps where `ended_at` stays NULL.
 *
 * The client computes approximate time remaining locally from `started_at +
 * work_duration` — v1 ignores pauses (adaptive polling + countdown live in
 * separate issues).
 */
export function registerFriendsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(listFocusingFriendsRoute, async (c) => {
    const supabase = c.get('supabase');

    // Resolve the authenticated auth.users.id from the JWT.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }
    const authUserId = userData.user.id;

    // Use admin client for the remainder: service_role bypasses RLS so the
    // friendship JOIN below can read friends' sessions. Privacy is enforced
    // in the query WHERE clauses, not via RLS (ADR-018, API-007).
    const admin = createAdminClient(c.env);

    // Step 1: resolve the user's profile id from auth_user_id. This is the
    // equivalent of `get_user_id()` in SQL.
    const profileRes = await admin
      .from('profiles')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single();
    if (profileRes.error) {
      throw profileRes.error;
    }
    const userProfileId = profileRes.data.id;

    // Step 2: fetch friend profile ids (friendships table uses dual-row pattern,
    // so querying by user_id returns everyone the authenticated user is friends with).
    const friendsRes = await admin
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userProfileId);
    if (friendsRes.error) {
      throw friendsRes.error;
    }
    const friendIds = friendsRes.data.map((row) => row.friend_id);
    if (friendIds.length === 0) {
      return c.json({ friends: [] }, 200);
    }

    // Step 3: find active sessions for those friends within the 4-hour window.
    const fourHoursAgo = new Date(Date.now() - FOUR_HOURS_MS).toISOString();
    const sessionsRes = await admin
      .from('sessions')
      .select('user_id, started_at')
      .in('user_id', friendIds)
      .is('ended_at', null)
      .gt('started_at', fourHoursAgo);
    if (sessionsRes.error) {
      throw sessionsRes.error;
    }
    const activeSessions = sessionsRes.data;
    if (activeSessions.length === 0) {
      return c.json({ friends: [] }, 200);
    }

    const focusingFriendIds = activeSessions.map((s) => s.user_id);

    // Step 4: fetch display_name + avatar_url for those friends.
    const profilesRes = await admin
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', focusingFriendIds);
    if (profilesRes.error) {
      throw profilesRes.error;
    }
    const profilesById = new Map(
      profilesRes.data.map((p) => [p.id, p] as const),
    );

    // Step 5: fetch work_duration_minutes for those friends.
    const prefsRes = await admin
      .from('user_preferences')
      .select('user_id, work_duration_minutes')
      .in('user_id', focusingFriendIds);
    if (prefsRes.error) {
      throw prefsRes.error;
    }
    const prefsByUserId = new Map(
      prefsRes.data.map((p) => [p.user_id, p] as const),
    );

    // Merge results. Drop any session whose friend lacks a profile or prefs row
    // (shouldn't happen in practice — both are created on signup).
    const friends = activeSessions.flatMap((session) => {
      const profile = profilesById.get(session.user_id);
      const prefs = prefsByUserId.get(session.user_id);
      if (!profile || !prefs) {
        return [];
      }
      return [
        {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          started_at: session.started_at,
          work_duration: prefs.work_duration_minutes,
        },
      ];
    });

    return c.json({ friends }, 200);
  });
}
