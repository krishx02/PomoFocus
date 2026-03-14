import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Standard error response shape returned to clients.
 * All error responses match this format — no exceptions.
 */
export type ErrorResponse = {
  readonly error: string;
  readonly status: number;
};

/**
 * Messages safe to return to clients for known Supabase error patterns.
 * Maps Supabase/PostgREST error indicators to generic client-facing messages.
 */
const SUPABASE_ERROR_MAP: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly status: number;
  readonly message: string;
}> = [
  { pattern: /JWT expired/i, status: 401, message: 'Authentication expired' },
  { pattern: /invalid.*token/i, status: 401, message: 'Invalid authentication' },
  { pattern: /not authorized/i, status: 403, message: 'Not authorized' },
  { pattern: /row-level security/i, status: 403, message: 'Access denied' },
  { pattern: /violates.*unique.*constraint/i, status: 409, message: 'Resource already exists' },
  { pattern: /violates.*foreign.*key/i, status: 422, message: 'Referenced resource not found' },
  { pattern: /violates.*not-null/i, status: 422, message: 'Missing required field' },
  { pattern: /violates.*check.*constraint/i, status: 422, message: 'Invalid field value' },
  { pattern: /PGRST\d{3}/i, status: 400, message: 'Invalid request' },
];

/**
 * Checks whether the error message matches a known Supabase error pattern.
 * Returns a safe client-facing response if matched, undefined otherwise.
 */
function matchSupabaseError(message: string): ErrorResponse | undefined {
  for (const entry of SUPABASE_ERROR_MAP) {
    if (entry.pattern.test(message)) {
      return { error: entry.message, status: entry.status };
    }
  }
  return undefined;
}

/**
 * Extracts the error message from an unknown thrown value.
 * Never returns Supabase internals to callers — this is for internal logging only.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Unknown error';
}

/**
 * Global error handler middleware for the Hono API.
 *
 * - Catches Hono HTTPExceptions and preserves their status + message.
 * - Catches Supabase/PostgREST errors and maps them to safe client messages.
 * - Catches all other errors and returns a generic 500.
 * - Logs full error details server-side for debugging.
 * - Never leaks Supabase internals, stack traces, or DB structure to clients.
 *
 * Wire this via `app.onError(errorHandler)`.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  // Hono's HTTPException carries an intentional status and message — trust it.
  if (err instanceof HTTPException) {
    const status = err.status;
    const message = err.message || 'Request error';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Hono c.json() return type is not resolvable by typescript-eslint
    return c.json({ error: message, status } satisfies ErrorResponse, status);
  }

  const rawMessage = extractErrorMessage(err);

  // Check for known Supabase/PostgREST error patterns.
  const supabaseMatch = matchSupabaseError(rawMessage);
  if (supabaseMatch) {
    console.error(`[API] Supabase error mapped: ${rawMessage}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Hono c.json() return type is not resolvable by typescript-eslint
    return c.json(
      { error: supabaseMatch.error, status: supabaseMatch.status } satisfies ErrorResponse,
      supabaseMatch.status as 400 | 401 | 403 | 409 | 422,
    );
  }

  // Unknown error — log full details server-side, return generic message to client.
  console.error('[API] Unhandled error:', err);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Hono c.json() return type is not resolvable by typescript-eslint
  return c.json(
    { error: 'Internal server error', status: 500 } satisfies ErrorResponse,
    500,
  );
};
