import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * Valid goal_status enum values matching the Postgres enum.
 */
const GOAL_STATUS_VALUES = ['active', 'completed', 'retired'] as const;

/**
 * Zod schema for the POST /v1/goals request body.
 */
export const CreateGoalBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(GOAL_STATUS_VALUES).optional(),
  sort_order: z.number().int().optional(),
});

/**
 * Zod schema for the PATCH /v1/goals/:id request body.
 * All fields are optional — only provided fields are updated.
 */
export const UpdateGoalBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(GOAL_STATUS_VALUES).optional(),
  sort_order: z.number().int().optional(),
});

/**
 * Zod schema for route params containing a goal id.
 */
export const GoalParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for the goal response object.
 */
export const GoalResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(GOAL_STATUS_VALUES),
  sort_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Zod schema for the paginated goals list response.
 */
export const ListGoalsResponseSchema = z.object({
  data: z.array(GoalResponseSchema),
  total: z.number(),
});

/**
 * Shared 401 response schema used across all goal routes.
 */
const UnauthorizedResponseSchema = z.object({
  error: z.string(),
  status: z.number(),
});

/**
 * Shared 422 response schema used across goal routes.
 */
const ValidationErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown(),
});

/**
 * OpenAPI route definition for POST /v1/goals.
 */
export const createGoalRoute = createRoute({
  method: 'post',
  path: '/v1/goals',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateGoalBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: GoalResponseSchema,
        },
      },
      description: 'Goal created successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: UnauthorizedResponseSchema,
        },
      },
      description: 'Missing or invalid authorization token',
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
 * OpenAPI route definition for GET /v1/goals.
 */
export const listGoalsRoute = createRoute({
  method: 'get',
  path: '/v1/goals',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListGoalsResponseSchema,
        },
      },
      description: 'List of long-term goals',
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
 * OpenAPI route definition for GET /v1/goals/:id.
 */
export const getGoalRoute = createRoute({
  method: 'get',
  path: '/v1/goals/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: GoalParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GoalResponseSchema,
        },
      },
      description: 'Single long-term goal',
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
          schema: z.object({
            error: z.string(),
            status: z.number(),
          }),
        },
      },
      description: 'Goal not found',
    },
  },
});

/**
 * OpenAPI route definition for PATCH /v1/goals/:id.
 */
export const updateGoalRoute = createRoute({
  method: 'patch',
  path: '/v1/goals/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: GoalParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateGoalBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GoalResponseSchema,
        },
      },
      description: 'Goal updated successfully',
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
          schema: z.object({
            error: z.string(),
            status: z.number(),
          }),
        },
      },
      description: 'Goal not found',
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
 * OpenAPI route definition for DELETE /v1/goals/:id.
 */
export const deleteGoalRoute = createRoute({
  method: 'delete',
  path: '/v1/goals/{id}',
  security: [{ Bearer: [] }],
  request: {
    params: GoalParamsSchema,
  },
  responses: {
    204: {
      description: 'Goal deleted successfully',
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
          schema: z.object({
            error: z.string(),
            status: z.number(),
          }),
        },
      },
      description: 'Goal not found',
    },
  },
});

/**
 * Registers all long-term goal CRUD routes on the given OpenAPIHono app.
 *
 * All routes require authentication — the auth middleware sets a user-scoped
 * Supabase client on the context. RLS policies scope queries to the authenticated user.
 *
 * POST /v1/goals — Create a long-term goal (title required, description optional)
 * GET /v1/goals — List the authenticated user's long-term goals
 * GET /v1/goals/:id — Get a single goal by ID
 * PATCH /v1/goals/:id — Update goal fields (title, description, status, sort_order)
 * DELETE /v1/goals/:id — Hard-delete a goal
 */
export function registerGoalsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(createGoalRoute, async (c) => {
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userData.user.id;

    const { data, error } = await supabase
      .from('long_term_goals')
      .insert({
        user_id: userId,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'active',
        sort_order: body.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json(data, 201);
  });

  app.openapi(listGoalsRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data, error, count } = await supabase
      .from('long_term_goals')
      .select('*', { count: 'exact' })
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return c.json({ data, total: count ?? 0 }, 200);
  });

  app.openapi(getGoalRoute, async (c) => {
    const { id } = c.req.valid('param');
    const supabase = c.get('supabase');

    const { data, error } = await supabase
      .from('long_term_goals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Goal not found', status: 404 }, 404);
      }
      throw error;
    }

    return c.json(data, 200);
  });

  app.openapi(updateGoalRoute, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    // Build update payload with only defined keys to satisfy exactOptionalPropertyTypes.
    const updatePayload: Record<string, unknown> = {};
    if (body.title !== undefined) {
      updatePayload['title'] = body.title;
    }
    if (body.description !== undefined) {
      updatePayload['description'] = body.description;
    }
    if (body.status !== undefined) {
      updatePayload['status'] = body.status;
    }
    if (body.sort_order !== undefined) {
      updatePayload['sort_order'] = body.sort_order;
    }

    const { data, error } = await supabase
      .from('long_term_goals')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Goal not found', status: 404 }, 404);
      }
      throw error;
    }

    return c.json(data, 200);
  });

  app.openapi(deleteGoalRoute, async (c) => {
    const { id } = c.req.valid('param');
    const supabase = c.get('supabase');

    const { error, count } = await supabase
      .from('long_term_goals')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    if (count === 0) {
      return c.json({ error: 'Goal not found', status: 404 }, 404);
    }

    return c.body(null, 204);
  });
}
