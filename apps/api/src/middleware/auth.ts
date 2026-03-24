import type { MiddlewareHandler } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@pomofocus/types';
import { HTTPException } from 'hono/http-exception';
import { createUserClient } from '../lib/supabase.js';
import type { SupabaseEnv } from '../lib/supabase.js';

/**
 * Hono context variables set by the auth middleware.
 * Routes access the user-scoped Supabase client via `c.get('supabase')`.
 */
export type AuthVariables = {
  supabase: SupabaseClient<Database>;
};

/**
 * Extracts a Bearer token from the Authorization header.
 * Returns undefined if the header is missing or malformed.
 */
export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return undefined;
  }

  const token = parts[1];
  if (!token || token.length === 0) {
    return undefined;
  }

  return token;
}

/**
 * Auth middleware that extracts the user's JWT from the Authorization header,
 * creates a user-scoped Supabase client, and attaches it to the Hono context.
 *
 * The user client forwards the JWT to Supabase so RLS policies apply
 * as if the client talked directly to Supabase (ADR-007, API-005).
 *
 * Routes access the client via `c.get('supabase')`.
 *
 * Throws 401 if:
 * - Authorization header is missing
 * - Authorization header is not a valid Bearer token
 */
export const authMiddleware: MiddlewareHandler<{
  Bindings: SupabaseEnv;
  Variables: AuthVariables;
}> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization token' });
  }

  const supabase = createUserClient(c.env, token);
  c.set('supabase', supabase);

  await next();
};
