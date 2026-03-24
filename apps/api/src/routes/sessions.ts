import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * Valid focus_quality enum values matching the Postgres enum.
 */
const FOCUS_QUALITY_VALUES = ['locked_in', 'decent', 'struggled'] as const;

/**
 * Valid distraction_type enum values matching the Postgres enum.
 */
const DISTRACTION_TYPE_VALUES = [
  'phone',
  'people',
  'thoughts_wandering',
  'got_stuck',
  'other',
] as const;

/**
 * Zod schema for the POST /v1/sessions request body.
 */
export const CreateSessionBodySchema = z.object({
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  focus_quality: z.enum(FOCUS_QUALITY_VALUES).optional(),
  distraction_type: z.enum(DISTRACTION_TYPE_VALUES).optional(),
});

/**
 * Zod schema for the session response object.
 */
export const SessionResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  process_goal_id: z.string(),
  intention_text: z.string().nullable(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  completed: z.boolean(),
  abandonment_reason: z.string().nullable(),
  focus_quality: z.enum(FOCUS_QUALITY_VALUES).nullable(),
  distraction_type: z.enum(DISTRACTION_TYPE_VALUES).nullable(),
  device_id: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Zod schema for GET /v1/sessions query parameters.
 */
export const ListSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Zod schema for the paginated sessions response.
 */
export const ListSessionsResponseSchema = z.object({
  data: z.array(SessionResponseSchema),
  total: z.number(),
});

/**
 * OpenAPI route definition for POST /v1/sessions.
 */
export const createSessionRoute = createRoute({
  method: 'post',
  path: '/v1/sessions',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSessionBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SessionResponseSchema,
        },
      },
      description: 'Session created successfully',
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
    422: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.unknown(),
          }),
        },
      },
      description: 'Validation failed',
    },
  },
});

/**
 * OpenAPI route definition for GET /v1/sessions.
 */
export const listSessionsRoute = createRoute({
  method: 'get',
  path: '/v1/sessions',
  security: [{ Bearer: [] }],
  request: {
    query: ListSessionsQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListSessionsResponseSchema,
        },
      },
      description: 'Paginated list of sessions',
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
    422: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.unknown(),
          }),
        },
      },
      description: 'Validation failed',
    },
  },
});

/**
 * Registers the POST /v1/sessions and GET /v1/sessions routes on the given OpenAPIHono app.
 *
 * Both routes require authentication — the auth middleware sets a user-scoped
 * Supabase client on the context. RLS policies scope queries to the authenticated user.
 *
 * POST: Validates request body with Zod, derives user_id from the authenticated
 * Supabase client, inserts a session, and returns the created row.
 *
 * GET: Returns a paginated list of the authenticated user's sessions
 * ordered by started_at descending. RLS filters to the current user.
 */
export function registerSessionsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(createSessionRoute, async (c) => {
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userData.user.id;

    // process_goal_id still uses a placeholder — goal selection is a future feature.
    // Must match seed.sql rows — Alice's first process goal.
    const PLACEHOLDER_PROCESS_GOAL_ID = 'eeee0001-0000-0000-0000-000000000001';

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        process_goal_id: PLACEHOLDER_PROCESS_GOAL_ID,
        started_at: body.started_at,
        ended_at: body.ended_at,
        focus_quality: body.focus_quality ?? null,
        distraction_type: body.distraction_type ?? null,
        completed: true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json(data, 201);
  });

  app.openapi(listSessionsRoute, async (c) => {
    const { limit, offset } = c.req.valid('query');
    const supabase = c.get('supabase');

    const { data, error, count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return c.json({ data, total: count ?? 0 }, 200);
  });
}
