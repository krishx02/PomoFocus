import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { tierOneMetrics } from '@pomofocus/analytics';
import type { SessionData } from '@pomofocus/core';
import type { ProcessGoal } from '@pomofocus/core';
import type { Session, ProcessGoal as DBProcessGoal } from '@pomofocus/types';
import type { AppEnv } from '../types.js';

/**
 * Zod schema for a single goal progress entry.
 */
export const GoalProgressSchema = z.object({
  goalId: z.string(),
  goalTitle: z.string(),
  completedToday: z.number(),
  targetToday: z.number(),
});

/**
 * Zod schema for the GET /v1/analytics/glanceable response.
 * Matches TierOneResult from @pomofocus/analytics.
 */
export const GlanceableResponseSchema = z.object({
  goalProgress: z.array(GoalProgressSchema),
  weeklyDots: z.tuple([
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
  ]),
  currentStreak: z.number(),
});

/**
 * OpenAPI route definition for GET /v1/analytics/glanceable.
 */
export const glanceableRoute = createRoute({
  method: 'get',
  path: '/v1/analytics/glanceable',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlanceableResponseSchema,
        },
      },
      description: 'Tier 1 glanceable analytics: goal progress, weekly dots, streak',
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
 * Converts a Supabase session row (snake_case) to the domain SessionData type (camelCase).
 */
function toSessionData(row: Session): SessionData {
  return {
    id: row.id,
    userId: row.user_id,
    processGoalId: row.process_goal_id,
    intentionText: row.intention_text,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    completed: row.completed,
    abandonmentReason: row.abandonment_reason,
    deviceId: row.device_id,
  };
}

/**
 * Converts a Supabase process_goals row (snake_case) to the domain ProcessGoal type (camelCase).
 */
function toProcessGoal(row: DBProcessGoal): ProcessGoal {
  return {
    id: row.id,
    longTermGoalId: row.long_term_goal_id,
    userId: row.user_id,
    title: row.title,
    targetSessionsPerDay: row.target_sessions_per_day,
    recurrence: row.recurrence,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Registers the GET /v1/analytics/glanceable route on the given OpenAPIHono app.
 *
 * Queries the user's sessions, process goals, and timezone preference via the
 * user-scoped Supabase client, then delegates to tierOneMetrics() from
 * @pomofocus/analytics for pure computation. RLS scopes all queries to the
 * authenticated user.
 */
export function registerAnalyticsRoute(app: OpenAPIHono<AppEnv>): void {
  app.openapi(glanceableRoute, async (c) => {
    const supabase = c.get('supabase');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const userId = userData.user.id;

    // Fetch user timezone (defaults to UTC if no preference row exists)
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsError) {
      throw prefsError;
    }

    const timezone = prefs?.timezone ?? 'UTC';

    // Fetch all user sessions (RLS scopes to current user)
    const { data: sessionRows, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (sessionsError) {
      throw sessionsError;
    }

    // Fetch active process goals (RLS scopes to current user)
    const { data: goalRows, error: goalsError } = await supabase
      .from('process_goals')
      .select('*')
      .eq('status', 'active');

    if (goalsError) {
      throw goalsError;
    }

    const sessions = sessionRows.map(toSessionData);
    const goals = goalRows.map(toProcessGoal);
    const now = Date.now();

    const result = tierOneMetrics(sessions, goals, timezone, now);

    return c.json(
      {
        goalProgress: result.goalProgress.map((g) => ({ ...g })),
        weeklyDots: [...result.weeklyDots],
        currentStreak: result.currentStreak,
      },
      200,
    );
  });
}
