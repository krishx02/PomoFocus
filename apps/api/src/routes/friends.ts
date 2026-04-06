import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for a single friend in the friend list response.
 *
 * Exposes only the public profile fields required by the UI — never
 * session or preference data (ADR-018: friends never see raw session data).
 */
export const FriendSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  username: z.string(),
});

/**
 * Zod schema for the GET /v1/friends response.
 */
export const ListFriendsResponseSchema = z.object({
  friends: z.array(FriendSchema),
});

/**
 * Zod schema for the DELETE /v1/friends/:id path parameter.
 */
export const DeleteFriendParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * OpenAPI route definition for GET /v1/friends.
 */
export const listFriendsRoute = createRoute({
  method: 'get',
  path: '/v1/friends',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListFriendsResponseSchema,
        },
      },
      description: 'List of confirmed friends ordered by display_name',
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
 * OpenAPI route definition for DELETE /v1/friends/:id.
 */
export const deleteFriendRoute = createRoute({
  method: 'delete',
  path: '/v1/friends/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: DeleteFriendParamsSchema,
  },
  responses: {
    204: {
      description: 'Friendship deleted (both directions)',
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
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            status: z.number(),
          }),
        },
      },
      description: 'Friendship not found',
    },
    422: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.unknown(),
          }),
        },
      },
      description: 'Invalid path parameter',
    },
  },
});

/**
 * Row shape returned by the GET /v1/friends Supabase JOIN query.
 * The `friend` relation resolves via the `friendships_friend_id_fkey`
 * foreign key declared in the schema.
 */
type FriendshipWithProfileRow = {
  readonly friend:
    | {
        readonly id: string;
        readonly display_name: string;
        readonly avatar_url: string | null;
        readonly username: string;
      }
    | null;
};

/**
 * Registers the GET /v1/friends and DELETE /v1/friends/:id routes
 * on the given OpenAPIHono app.
 *
 * Both routes require authentication — the auth middleware sets a
 * user-scoped Supabase client on the context. RLS on `friendships`
 * allows SELECT of the user's own friendship rows (ADR-018).
 *
 * GET: Joins `friendships` to `profiles` via the `friend_id` foreign
 * key and returns public profile fields ordered by `display_name`.
 * Ordering is performed in the API after the join — friend lists are
 * capped at 100 per user (ADR-018) so in-memory sort is trivial.
 *
 * DELETE: Implements the dual-row unfriend pattern. Because migration
 * `20260322000006_rls_social.sql` removed direct DELETE RLS on
 * `friendships` (managed by server logic per ADR-018), the route:
 *
 *   1. Verifies the friendship exists for the authenticated user via
 *      the user-scoped client (SELECT is still allowed by RLS). If no
 *      row matches, returns 404.
 *   2. Uses the admin (service_role) client to delete both friendship
 *      rows — `(user_id = me, friend_id = them)` and its inverse.
 *
 * The two DELETEs are issued sequentially. True SQL transaction
 * atomicity is not available through the Supabase JS SDK, but the API
 * is the sole writer of `friendships` rows (INSERT/DELETE RLS is
 * closed) so there is no concurrent path that could observe a
 * half-deleted friendship.
 */
export function registerFriendsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(listFriendsRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data, error } = await supabase
      .from('friendships')
      .select(
        'friend:profiles!friendships_friend_id_fkey(id, display_name, avatar_url, username)',
      )
      .overrideTypes<FriendshipWithProfileRow[], { merge: false }>();

    if (error) {
      throw error;
    }

    const friends = data
      .map((row) => row.friend)
      .filter((friend): friend is NonNullable<FriendshipWithProfileRow['friend']> => friend !== null)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    return c.json({ friends }, 200);
  });

  app.openapi(deleteFriendRoute, async (c) => {
    const { id: friendId } = c.req.valid('param');
    const supabase = c.get('supabase');

    // Resolve the authenticated user's profile id. The JWT `sub` is the
    // auth user id, which must be mapped to the profile row via
    // `profiles.auth_user_id`.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const myProfileId = profile.id;

    // Step 1: verify the friendship exists for the authenticated user.
    // RLS on `friendships_select_own` restricts this to rows where
    // `user_id = get_user_id()`, which is already the correct scope.
    const { data: existing, error: selectError } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', myProfileId)
      .eq('friend_id', friendId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (!existing) {
      return c.json({ error: 'Friendship not found', status: 404 }, 404);
    }

    // Step 2: delete both directions via the admin client. RLS
    // INSERT/DELETE on `friendships` was intentionally removed
    // (20260322000006_rls_social.sql) — writes are server-only.
    const admin = createAdminClient(c.env);

    const { error: deleteForwardError } = await admin
      .from('friendships')
      .delete()
      .eq('user_id', myProfileId)
      .eq('friend_id', friendId);

    if (deleteForwardError) {
      throw deleteForwardError;
    }

    const { error: deleteReverseError } = await admin
      .from('friendships')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', myProfileId);

    if (deleteReverseError) {
      throw deleteReverseError;
    }

    return c.body(null, 204);
  });
}
