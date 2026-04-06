import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';

/**
 * Maximum number of friends a single user may have at once.
 * Enforced in the accept handler before creating the friendship pair.
 */
const MAX_FRIENDS_PER_USER = 100;

/**
 * Zod schema for the POST /v1/friend-requests request body.
 */
export const SendFriendRequestBodySchema = z.object({
  recipient_username: z.string().min(1),
});

/**
 * Zod schema for the POST /v1/friend-requests response.
 * Returns the newly created pending friend request.
 */
export const SendFriendRequestResponseSchema = z.object({
  id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  status: z.literal('pending'),
  created_at: z.string(),
});

/**
 * Zod schema for a single pending incoming friend request
 * as returned by GET /v1/friend-requests.
 */
export const PendingFriendRequestSchema = z.object({
  id: z.string().uuid(),
  sender_id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Zod schema for the GET /v1/friend-requests response.
 */
export const ListFriendRequestsResponseSchema = z.object({
  requests: z.array(PendingFriendRequestSchema),
});

/**
 * Zod schema for URL params containing a friend_request id.
 */
export const FriendRequestParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Shared 400 response schema.
 */
const BadRequestResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 401 response schema.
 */
const UnauthorizedResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 403 response schema.
 */
const ForbiddenResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 404 response schema.
 */
const NotFoundResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 409 response schema (duplicate / already-friends conflicts).
 */
const ConflictResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 422 response schema for request-body validation failures.
 * Matches the global `defaultHook` response shape.
 */
const ValidationErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown(),
});

/**
 * 422 response schema used by the accept handler when the caller has hit
 * the friend limit. Distinct from `ValidationErrorResponseSchema` because
 * business-rule 422s don't carry a Zod `details` payload.
 */
const BusinessRuleErrorResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * OpenAPI route: POST /v1/friend-requests — send a friend request by username.
 */
export const sendFriendRequestRoute = createRoute({
  method: 'post',
  path: '/v1/friend-requests',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SendFriendRequestBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SendFriendRequestResponseSchema,
        },
      },
      description: 'Friend request created',
    },
    400: {
      content: {
        'application/json': {
          schema: BadRequestResponseSchema,
        },
      },
      description: 'Cannot send request to yourself',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema,
        },
      },
      description: 'Missing or invalid authorization token',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponseSchema,
        },
      },
      description: 'Recipient username not found',
    },
    409: {
      content: {
        'application/json': {
          schema: ConflictResponseSchema,
        },
      },
      description: 'Duplicate request or already friends',
    },
    422: {
      content: {
        'application/json': {
          schema: ValidationErrorResponseSchema,
        },
      },
      description: 'Validation failed',
    },
  },
});

/**
 * OpenAPI route: GET /v1/friend-requests — list pending incoming requests.
 */
export const listFriendRequestsRoute = createRoute({
  method: 'get',
  path: '/v1/friend-requests',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListFriendRequestsResponseSchema,
        },
      },
      description: 'Pending incoming friend requests',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema,
        },
      },
      description: 'Missing or invalid authorization token',
    },
  },
});

/**
 * OpenAPI route: POST /v1/friend-requests/:id/accept — accept a pending request.
 */
export const acceptFriendRequestRoute = createRoute({
  method: 'post',
  path: '/v1/friend-requests/{id}/accept',
  security: [{ Bearer: [] }],
  request: {
    params: FriendRequestParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
          }),
        },
      },
      description: 'Friend request accepted; friendship pair created',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema,
        },
      },
      description: 'Missing or invalid authorization token',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenResponseSchema,
        },
      },
      description: 'Current user is not the recipient of this request',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponseSchema,
        },
      },
      description: 'Friend request not found',
    },
    422: {
      content: {
        'application/json': {
          schema: BusinessRuleErrorResponseSchema,
        },
      },
      description: 'Friend limit reached (max 100)',
    },
  },
});

/**
 * OpenAPI route: DELETE /v1/friend-requests/:id — decline or cancel a pending request.
 */
export const declineFriendRequestRoute = createRoute({
  method: 'delete',
  path: '/v1/friend-requests/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: FriendRequestParamsSchema,
  },
  responses: {
    204: {
      description: 'Friend request deleted',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema,
        },
      },
      description: 'Missing or invalid authorization token',
    },
    403: {
      content: {
        'application/json': {
          schema: ForbiddenResponseSchema,
        },
      },
      description: 'Current user is neither sender nor recipient',
    },
    404: {
      content: {
        'application/json': {
          schema: NotFoundResponseSchema,
        },
      },
      description: 'Friend request not found',
    },
  },
});

/**
 * Looks up the authenticated user's profile id (`profiles.id`) from the
 * Supabase `auth.users.id` extracted from the verified JWT.
 *
 * Returns null if no matching profile row exists — handlers should treat
 * this as 401 (the JWT is valid but the user has no profile).
 */
async function resolveCurrentProfileId(
  supabase: ReturnType<typeof createAdminClient>,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.id ?? null;
}

/**
 * Registers the four friend-request routes on the given OpenAPIHono app.
 *
 * All routes require authentication (the auth middleware sets a user-scoped
 * Supabase client on the context). Business rules — self-request, already
 * friends, friend limit, recipient check — are enforced in the API layer
 * per ADR-018; friendships RLS blocks direct client INSERT/DELETE so the
 * accept/decline handlers use the admin client to mutate friendship rows.
 */
export function registerFriendRequestsRoute(app: OpenAPIHono<AppEnv>): void {
  // ---- POST /v1/friend-requests ----
  app.openapi(sendFriendRequestRoute, async (c) => {
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const senderId = await resolveCurrentProfileId(supabase, userData.user.id);
    if (!senderId) {
      return c.json({ error: 'Profile not found', status: 401 }, 401);
    }

    // Look up recipient profile by username.
    const { data: recipientProfile, error: recipientError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', body.recipient_username)
      .maybeSingle();

    if (recipientError) {
      throw recipientError;
    }
    if (!recipientProfile) {
      return c.json({ error: 'Recipient not found', status: 404 }, 404);
    }

    const recipientId = recipientProfile.id;

    // Cannot send request to yourself.
    if (senderId === recipientId) {
      return c.json({ error: 'Cannot send friend request to yourself', status: 400 }, 400);
    }

    // Cannot send request if already friends (either direction of the dual-row pattern).
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', senderId)
      .eq('friend_id', recipientId)
      .maybeSingle();

    if (friendshipError) {
      throw friendshipError;
    }
    if (existingFriendship) {
      return c.json({ error: 'Already friends', status: 409 }, 409);
    }

    // Insert the friend request. The UNIQUE (sender_id, recipient_id) constraint
    // deduplicates concurrent duplicates and is caught here via Postgres error code 23505.
    const { data: inserted, error: insertError } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
      })
      .select('id, recipient_id, status, created_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return c.json({ error: 'Friend request already exists', status: 409 }, 409);
      }
      throw insertError;
    }

    return c.json(
      {
        id: inserted.id,
        recipient_id: inserted.recipient_id,
        status: 'pending' as const,
        created_at: inserted.created_at,
      },
      201,
    );
  });

  // ---- GET /v1/friend-requests ----
  app.openapi(listFriendRequestsRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const currentProfileId = await resolveCurrentProfileId(supabase, userData.user.id);
    if (!currentProfileId) {
      return c.json({ requests: [] }, 200);
    }

    // Join friend_requests -> profiles (sender) to return display_name + avatar_url.
    // RLS on friend_requests restricts SELECT to rows where the caller is sender or
    // recipient; we additionally filter by recipient_id to return only incoming ones.
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, created_at, status, sender:profiles!friend_requests_sender_id_fkey(display_name, avatar_url)')
      .eq('recipient_id', currentProfileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    type JoinedRow = {
      id: string;
      sender_id: string;
      created_at: string;
      sender:
        | { display_name: string; avatar_url: string | null }
        | { display_name: string; avatar_url: string | null }[]
        | null;
    };

    // Supabase typegen can return the joined relation as either an object or an array
    // depending on the relationship shape — normalize to a single object.
    const rows = data as unknown as JoinedRow[];
    const requests = rows.map((row) => {
      const sender = Array.isArray(row.sender) ? row.sender[0] : row.sender;
      return {
        id: row.id,
        sender_id: row.sender_id,
        display_name: sender ? sender.display_name : '',
        avatar_url: sender ? sender.avatar_url : null,
        created_at: row.created_at,
      };
    });

    return c.json({ requests }, 200);
  });

  // ---- POST /v1/friend-requests/:id/accept ----
  app.openapi(acceptFriendRequestRoute, async (c) => {
    const { id } = c.req.valid('param');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const currentProfileId = await resolveCurrentProfileId(supabase, userData.user.id);
    if (!currentProfileId) {
      return c.json({ error: 'Profile not found', status: 401 }, 401);
    }

    // Fetch the request to verify existence + recipient.
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, recipient_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }
    if (!request) {
      return c.json({ error: 'Friend request not found', status: 404 }, 404);
    }
    if (request.recipient_id !== currentProfileId) {
      return c.json({ error: 'Not authorized to accept this request', status: 403 }, 403);
    }

    // Enforce the 100-friend limit on the accepting user's side.
    const { count: friendCount, error: countError } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentProfileId);

    if (countError) {
      throw countError;
    }
    if ((friendCount ?? 0) >= MAX_FRIENDS_PER_USER) {
      return c.json(
        {
          error: `Friend limit reached (max ${String(MAX_FRIENDS_PER_USER)})`,
          status: 422,
        },
        422,
      );
    }

    // Create the friendship pair and delete the request.
    // friendships RLS blocks direct INSERT from authenticated clients (managed by
    // server per ADR-018); use the admin client to bypass RLS. Likewise, the updated
    // fr_delete policy restricts DELETE to the sender, so the recipient-initiated
    // accept must use admin to clear the request.
    const admin = createAdminClient(c.env);

    const { error: insertError } = await admin.from('friendships').insert([
      { user_id: request.recipient_id, friend_id: request.sender_id },
      { user_id: request.sender_id, friend_id: request.recipient_id },
    ]);

    if (insertError) {
      throw insertError;
    }

    const { error: deleteError } = await admin
      .from('friend_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return c.json({ success: true as const }, 200);
  });

  // ---- DELETE /v1/friend-requests/:id ----
  app.openapi(declineFriendRequestRoute, async (c) => {
    const { id } = c.req.valid('param');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const currentProfileId = await resolveCurrentProfileId(supabase, userData.user.id);
    if (!currentProfileId) {
      return c.json({ error: 'Profile not found', status: 401 }, 401);
    }

    // Fetch the request first to determine authorization.
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, recipient_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }
    if (!request) {
      return c.json({ error: 'Friend request not found', status: 404 }, 404);
    }
    if (request.sender_id !== currentProfileId && request.recipient_id !== currentProfileId) {
      return c.json({ error: 'Not authorized to delete this request', status: 403 }, 403);
    }

    // RLS restricts DELETE on friend_requests to the sender only; use the admin client
    // so recipients can decline as well.
    const admin = createAdminClient(c.env);
    const { error: deleteError } = await admin
      .from('friend_requests')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return c.body(null, 204);
  });
}
