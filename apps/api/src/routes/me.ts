import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Zod schema for the GET /v1/me response.
 * Phase 1 stub — returns anonymous placeholder.
 * Phase 2 will derive user identity from auth middleware.
 */
export const MeResponseSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
});

/**
 * OpenAPI route definition for GET /v1/me.
 */
export const meRoute = createRoute({
  method: 'get',
  path: '/v1/me',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
      description: 'Current user profile',
    },
  },
});

/**
 * Registers the GET /v1/me stub route on the given OpenAPIHono app.
 *
 * Phase 1 stub: returns anonymous placeholder. Phase 2 will derive
 * user identity from the Supabase JWT via auth middleware.
 */
export function registerMeRoute(app: OpenAPIHono): void {
  app.openapi(meRoute, (c) => {
    return c.json(
      {
        id: 'anonymous',
        created_at: new Date().toISOString(),
      },
      200,
    );
  });
}
