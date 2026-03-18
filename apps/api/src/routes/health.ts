import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Zod schema for the health check response.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

/**
 * OpenAPI route definition for GET /health.
 */
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'API is healthy',
    },
  },
});

/**
 * Registers the health route on the given OpenAPIHono app.
 */
export function registerHealthRoute(app: OpenAPIHono): void {
  app.openapi(healthRoute, (c) => {
    return c.json(
      {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
      },
      200,
    );
  });
}
