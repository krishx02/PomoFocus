import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for the POST /v1/taps request body.
 */
export const SendTapBodySchema = z.object({
  recipient_id: z.string().uuid(),
});

/**
 * Zod schema for the POST /v1/taps path parameters.
 */
export const TapIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for the POST /v1/taps 201 response.
 */
export const SendTapResponseSchema = z.object({
  id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  created_at: z.string(),
});

/**
 * Zod schema for a single entry in the GET /v1/taps response.
 */
export const ReceivedTapSchema = z.object({
  id: z.string().uuid(),
  sender_display_name: z.string().nullable(),
  sender_avatar_url: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Zod schema for the GET /v1/taps 200 response.
 */
export const ListReceivedTapsResponseSchema = z.object({
  taps: z.array(ReceivedTapSchema),
});

/**
 * Standard error response shape for 4xx responses returned directly from
 * route handlers (bypassing the error-handler middleware).
 */
const ErrorResponseSchema = z.object({
  error: z.string(),
});

/**
 * OpenAPI route definition for POST /v1/taps.
 */
export const sendTapRoute = createRoute({
  method: 'post',
  path: '/v1/taps',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: SendTapBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SendTapResponseSchema,
        },
      },
      description: 'Tap sent successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request (e.g. tapping yourself)',
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
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Recipient is not a confirmed friend',
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
      description: 'Zod validation failed',
    },
    429: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Rate limit exceeded (max 3 taps per friend per day)',
    },
  },
});

/**
 * OpenAPI route definition for DELETE /v1/taps/:id.
 */
export const removeTapRoute = createRoute({
  method: 'delete',
  path: '/v1/taps/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: TapIdParamsSchema,
  },
  responses: {
    204: {
      description: 'Tap removed successfully',
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
          schema: ErrorResponseSchema,
        },
      },
      description: 'Tap not found or sender does not own it',
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
      description: 'Zod validation failed',
    },
  },
});

/**
 * OpenAPI route definition for GET /v1/taps.
 */
export const listReceivedTapsRoute = createRoute({
  method: 'get',
  path: '/v1/taps',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListReceivedTapsResponseSchema,
        },
      },
      description: 'Taps received in the last 24 hours',
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
 * Shape of a joined row returned by the GET /v1/taps query.
 * Supabase returns the joined profile as a nested object (or array when the
 * foreign key is ambiguous); we access it defensively.
 */
type TapWithSenderProfile = {
  id: string;
  created_at: string;
  sender: { display_name: string | null; avatar_url: string | null } | null;
};

/**
 * Registers the encouragement tap routes on the given OpenAPIHono app:
 *   - POST   /v1/taps         — send a tap (with friendship + rate limit checks)
 *   - DELETE /v1/taps/{id}    — remove a tap (sender only)
 *   - GET    /v1/taps         — list taps received in the last 24 hours
 *
 * Per ADR-018, friendship enforcement lives in the API layer (not RLS).
 * RLS on encouragement_taps only constrains the sender_id on INSERT and
 * SELECT visibility to sender/recipient.
 */
export function registerTapsRoute(app: OpenAPIHono<AppEnv>): void {
  // ---- POST /v1/taps ----
  app.openapi(sendTapRoute, async (c) => {
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const senderId = userData.user.id;
    const recipientId = body.recipient_id;

    // Guard: cannot tap yourself.
    if (senderId === recipientId) {
      return c.json({ error: 'Cannot tap yourself' }, 400);
    }

    // Guard: recipient must be a confirmed friend (friendships is a dual-row
    // table — a single direction lookup is sufficient).
    const { data: friendship, error: friendshipError } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', senderId)
      .eq('friend_id', recipientId)
      .maybeSingle();

    if (friendshipError) {
      throw friendshipError;
    }

    if (!friendship) {
      return c.json({ error: 'Recipient is not a confirmed friend' }, 403);
    }

    // Rate limit: max 3 taps per sender/recipient per calendar day (UTC).
    // CURRENT_DATE in the design doc maps to the start of today in UTC.
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const { count: todayCount, error: countError } = await supabase
      .from('encouragement_taps')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .eq('recipient_id', recipientId)
      .gte('created_at', startOfTodayUtc.toISOString());

    if (countError) {
      throw countError;
    }

    if ((todayCount ?? 0) >= 3) {
      return c.json({ error: 'Max 3 taps per friend per day' }, 429);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('encouragement_taps')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
      })
      .select('id, recipient_id, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    return c.json(
      {
        id: inserted.id,
        recipient_id: inserted.recipient_id,
        created_at: inserted.created_at,
      },
      201,
    );
  });

  // ---- DELETE /v1/taps/{id} ----
  app.openapi(removeTapRoute, async (c) => {
    const { id } = c.req.valid('param');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const senderId = userData.user.id;

    // Explicit sender_id filter ensures only the sender can delete their own
    // taps (defense-in-depth — RLS DELETE policy should also enforce this,
    // but per DB-011 we always add explicit WHERE filters).
    const { data: deleted, error: deleteError } = await supabase
      .from('encouragement_taps')
      .delete()
      .eq('id', id)
      .eq('sender_id', senderId)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      throw deleteError;
    }

    if (!deleted) {
      return c.json({ error: 'Tap not found' }, 404);
    }

    return c.body(null, 204);
  });

  // ---- GET /v1/taps ----
  app.openapi(listReceivedTapsRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const recipientId = userData.user.id;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('encouragement_taps')
      .select('id, created_at, sender:profiles!encouragement_taps_sender_id_fkey(display_name, avatar_url)')
      .eq('recipient_id', recipientId)
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = data as unknown as TapWithSenderProfile[];

    const taps = rows.map((row) => ({
      id: row.id,
      sender_display_name: row.sender?.display_name ?? null,
      sender_avatar_url: row.sender?.avatar_url ?? null,
      created_at: row.created_at,
    }));

    return c.json({ taps }, 200);
  });
}
