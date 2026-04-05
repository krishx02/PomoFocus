import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Database } from '@pomofocus/types';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for the settings response.
 * Returns the mutable user preference fields — excludes id, user_id,
 * created_at, and updated_at (internal metadata).
 */
export const SettingsResponseSchema = z.object({
  work_duration_minutes: z.number().int(),
  short_break_minutes: z.number().int(),
  long_break_minutes: z.number().int(),
  sessions_before_long_break: z.number().int(),
  reflection_enabled: z.boolean(),
  timezone: z.string(),
});

/**
 * Zod schema for the PATCH /v1/settings request body.
 * All fields are optional — callers send only the fields they want to update.
 * Duration fields must be positive integers. Timezone must be a non-empty string
 * (IANA validity enforced by the database or downstream — Zod checks non-empty).
 */
export const UpdateSettingsBodySchema = z
  .object({
    work_duration_minutes: z.number().int().min(1).optional(),
    short_break_minutes: z.number().int().min(1).optional(),
    long_break_minutes: z.number().int().min(1).optional(),
    sessions_before_long_break: z.number().int().min(1).optional(),
    reflection_enabled: z.boolean().optional(),
    timezone: z.string().min(1).optional(),
  })
  .strict();

/**
 * OpenAPI route definition for GET /v1/settings.
 */
export const getSettingsRoute = createRoute({
  method: 'get',
  path: '/v1/settings',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SettingsResponseSchema,
        },
      },
      description: 'Current user preferences',
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
 * OpenAPI route definition for PATCH /v1/settings.
 */
export const updateSettingsRoute = createRoute({
  method: 'patch',
  path: '/v1/settings',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateSettingsBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SettingsResponseSchema,
        },
      },
      description: 'Updated user preferences',
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

type PreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

/**
 * Builds a Supabase-compatible update object from the validated request body.
 * Only includes keys that were actually sent (not undefined).
 * Uses JSON round-trip to strip undefined keys — this satisfies
 * exactOptionalPropertyTypes which requires absent keys rather than
 * undefined values.
 */
function toPreferencesUpdate(body: z.infer<typeof UpdateSettingsBodySchema>): PreferencesUpdate {
  return JSON.parse(JSON.stringify(body)) as PreferencesUpdate;
}

/**
 * Picks the settings fields from a user_preferences row.
 * Strips internal metadata (id, user_id, created_at, updated_at).
 */
function pickSettingsFields(row: {
  work_duration_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  sessions_before_long_break: number;
  reflection_enabled: boolean;
  timezone: string;
}): z.infer<typeof SettingsResponseSchema> {
  return {
    work_duration_minutes: row.work_duration_minutes,
    short_break_minutes: row.short_break_minutes,
    long_break_minutes: row.long_break_minutes,
    sessions_before_long_break: row.sessions_before_long_break,
    reflection_enabled: row.reflection_enabled,
    timezone: row.timezone,
  };
}

/**
 * Registers the GET /v1/settings and PATCH /v1/settings routes.
 *
 * Both routes require authentication. The user-scoped Supabase client
 * ensures RLS filters to the authenticated user's preferences row.
 *
 * GET: Returns the current user's preferences. The row is auto-created
 * by a database trigger on profile creation, so it always exists.
 *
 * PATCH: Updates one or more preference fields and returns the full
 * updated row. Uses `.select().single()` to return the result in one
 * round-trip.
 */
export function registerSettingsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(getSettingsRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return c.json(pickSettingsFields(data), 200);
  });

  app.openapi(updateSettingsRoute, async (c) => {
    const body = c.req.valid('json');
    const supabase = c.get('supabase');

    const updates = toPreferencesUpdate(body);

    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json(pickSettingsFields(data), 200);
  });
}
