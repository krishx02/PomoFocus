import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for the GET /v1/invite/:username path parameters.
 */
export const InviteParamsSchema = z.object({
  username: z.string().min(1),
});

/**
 * Zod schema for the GET /v1/invite/:username response.
 *
 * Intentionally minimal — only the public-facing fields needed to render
 * an invite landing page. No email, no session data, no friend count
 * (ADR-018: stateless invite links, minimal data returned).
 */
export const InviteResponseSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
});

/**
 * Zod schema for the 404 error response when the username is not found.
 */
export const InviteNotFoundSchema = z.object({
  error: z.string(),
});

/**
 * OpenAPI route definition for GET /v1/invite/:username.
 *
 * Public endpoint — no Bearer security. Anyone with an invite link can
 * resolve the username to a public profile (ADR-018).
 */
export const getInviteRoute = createRoute({
  method: 'get',
  path: '/v1/invite/{username}',
  request: {
    params: InviteParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: InviteResponseSchema,
        },
      },
      description: 'Public profile for the invite link',
    },
    404: {
      content: {
        'application/json': {
          schema: InviteNotFoundSchema,
        },
      },
      description: 'Username does not exist',
    },
  },
});

/**
 * Registers the GET /v1/invite/:username route on the given OpenAPIHono app.
 *
 * This is the only public social endpoint (ADR-018). No JWT required.
 *
 * Uses the admin Supabase client to bypass RLS — the profiles table only
 * permits authenticated users to read their own row, but invite resolution
 * needs to read any user's minimal public profile by username. The handler
 * selects only `id`, `display_name`, `avatar_url` to avoid exposing
 * sensitive fields (API-005).
 */
export function registerInviteRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(getInviteRoute, async (c) => {
    const { username } = c.req.valid('param');

    const supabase = createAdminClient(c.env);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(
      {
        id: data.id,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
      },
      200,
    );
  });
}
