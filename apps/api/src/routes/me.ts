import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../types.js';

/**
 * Row type used throughout the export response.
 * Matches what Supabase returns: objects with string keys and JSON-serializable values.
 */
type Row = Record<string, unknown>;

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
 * Zod schema for the GET /v1/me/export response.
 * Returns all user data grouped by entity type for GDPR data portability (ADR-012).
 * Uses z.record() for row objects since Supabase returns typed rows with varying shapes.
 */
export const MeExportResponseSchema = z.object({
  profile: z.record(z.string(), z.unknown()).nullable(),
  preferences: z.record(z.string(), z.unknown()).nullable(),
  long_term_goals: z.array(z.record(z.string(), z.unknown())),
  process_goals: z.array(z.record(z.string(), z.unknown())),
  sessions: z.array(z.record(z.string(), z.unknown())),
  breaks: z.array(z.record(z.string(), z.unknown())),
  devices: z.array(z.record(z.string(), z.unknown())),
  device_sync_log: z.array(z.record(z.string(), z.unknown())),
  friend_requests: z.array(z.record(z.string(), z.unknown())),
  friendships: z.array(z.record(z.string(), z.unknown())),
  encouragement_taps: z.array(z.record(z.string(), z.unknown())),
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
 * OpenAPI route definition for GET /v1/me/export.
 * Returns all user data as a JSON download for GDPR data portability.
 */
export const meExportRoute = createRoute({
  method: 'get',
  path: '/v1/me/export',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeExportResponseSchema,
        },
      },
      description: 'Full user data export (GDPR Art. 20)',
      headers: z.object({
        'Content-Disposition': z.string(),
      }),
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
 * Table names scoped by user_id for the data export.
 * Each entry maps to a Supabase table where the user's data lives.
 */
const USER_TABLES = [
  'long_term_goals',
  'process_goals',
  'sessions',
  'breaks',
  'devices',
  'device_sync_log',
  'friendships',
  'encouragement_taps',
] as const;

/**
 * Registers the GET /v1/me and GET /v1/me/export routes on the given OpenAPIHono app.
 *
 * GET /v1/me: Returns the authenticated user's identity from the JWT.
 *
 * GET /v1/me/export: Returns all user data as a JSON download.
 * Uses the user-scoped Supabase client so RLS filters to own data only.
 * Queries all 11 application tables and returns a nested structure.
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

  app.openapi(meExportRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userData.user.id;

    // Fetch profile (single row via auth_user_id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    // Fetch preferences (single row via user_id -> profiles.id)
    let preferences: Row | null = null;
    if (profile) {
      const { data: prefs, error: prefsError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (prefsError) {
        throw prefsError;
      }

      preferences = prefs;
    }

    // Fetch friend_requests where user is sender or recipient (uses profile.id)
    let friendRequests: Row[] = [];
    if (profile) {
      const { data: sentRequests, error: sentError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', profile.id);

      if (sentError) {
        throw sentError;
      }

      const { data: receivedRequests, error: receivedError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('recipient_id', profile.id);

      if (receivedError) {
        throw receivedError;
      }

      friendRequests = [...sentRequests, ...receivedRequests];
    }

    // Fetch all user_id-scoped tables in parallel.
    // RLS ensures only the user's own rows are returned.
    // device_sync_log is scoped via device_id, so we fetch it after devices.
    const profileId = profile?.id;
    const tableResults = await Promise.all(
      USER_TABLES.filter((t) => t !== 'device_sync_log').map(async (table) => {
        if (!profileId) {
          return { table, data: [] as Row[] };
        }
        const { data: rows, error: tableError } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', profileId);

        if (tableError) {
          throw tableError;
        }

        return { table, data: rows as Row[] };
      }),
    );

    const tableData: Record<string, Row[]> = {};
    for (const result of tableResults) {
      tableData[result.table] = result.data;
    }

    // Fetch device_sync_log scoped by the user's device IDs
    let deviceSyncLog: Row[] = [];
    const devices = tableData['devices'] as { id: string }[] | undefined;
    if (devices && devices.length > 0) {
      const deviceIds = devices.map((d) => d.id);
      const { data: syncRows, error: syncError } = await supabase
        .from('device_sync_log')
        .select('*')
        .in('device_id', deviceIds);

      if (syncError) {
        throw syncError;
      }

      deviceSyncLog = syncRows;
    }

    const exportData = {
      profile,
      preferences,
      long_term_goals: tableData['long_term_goals'] ?? [],
      process_goals: tableData['process_goals'] ?? [],
      sessions: tableData['sessions'] ?? [],
      breaks: tableData['breaks'] ?? [],
      devices: tableData['devices'] ?? [],
      device_sync_log: deviceSyncLog,
      friend_requests: friendRequests,
      friendships: tableData['friendships'] ?? [],
      encouragement_taps: tableData['encouragement_taps'] ?? [],
    };

    c.header('Content-Disposition', 'attachment; filename="pomofocus-export.json"');

    return c.json(exportData, 200);
  });
}
