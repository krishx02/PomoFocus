import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createAdminClient } from '../lib/supabase.js';
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
 * OpenAPI route definition for DELETE /v1/me.
 * Cascade-deletes all user data and removes the auth record (GDPR Art. 17).
 */
export const deleteMeRoute = createRoute({
  method: 'delete',
  path: '/v1/me',
  security: [{ Bearer: [] }],
  responses: {
    204: {
      description: 'Account deleted successfully',
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
 * The 11 application tables referencing profiles, in cascade-delete order.
 * All have ON DELETE CASCADE on their user_id/sender_id/recipient_id FK.
 * Deleting the profiles row cascades to all of them.
 *
 * Listed for documentation:
 * encouragement_taps, friendships, friend_requests, device_sync_log,
 * devices, breaks, sessions, process_goals, long_term_goals,
 * user_preferences, profiles
 */

/**
 * Registers the GET /v1/me and DELETE /v1/me routes on the given OpenAPIHono app.
 *
 * GET: Uses the user-scoped Supabase client from auth middleware to resolve
 * the authenticated user's identity from the JWT.
 *
 * DELETE: Cascade-deletes all user data across all 11 application tables
 * by deleting the profiles row (ON DELETE CASCADE), then removes the
 * Supabase Auth record. Uses service_role key to bypass RLS (API-005).
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

  app.openapi(deleteMeRoute, async (c) => {
    const supabase = c.get('supabase');

    // Resolve auth user ID from JWT
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const authUserId = userData.user.id;

    // Admin client bypasses RLS for cross-table cascade delete (API-005)
    const admin = createAdminClient(c.env);

    // Delete profile row — ON DELETE CASCADE removes all child table data
    const { error: deleteError } = await admin
      .from('profiles')
      .delete()
      .eq('auth_user_id', authUserId);

    if (deleteError) {
      throw deleteError;
    }

    // Remove Supabase Auth record
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUserId);
    if (authDeleteError) {
      throw authDeleteError;
    }

    return c.body(null, 204);
  });
}
