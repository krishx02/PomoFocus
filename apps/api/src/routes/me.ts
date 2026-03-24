import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for the GET /v1/me response.
 * Returns the authenticated user's profile.
 */
export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  created_at: z.string(),
});

/**
 * OpenAPI route definition for GET /v1/me.
 */
export const meRoute = createRoute({
  method: 'get',
  path: '/v1/me',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
      description: 'Current user profile',
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
 * Registers the GET /v1/me route on the given OpenAPIHono app.
 *
 * Uses the user-scoped Supabase client from auth middleware to resolve
 * the authenticated user's identity from the JWT.
 */
export function registerMeRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(meRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }

    return c.json(
      {
        id: data.user.id,
        email: data.user.email ?? null,
        created_at: data.user.created_at,
      },
      200,
    );
  });
}
