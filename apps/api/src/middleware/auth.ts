import { createClient } from '@supabase/supabase-js';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

/**
 * Paths that are excluded from JWT authentication.
 * These endpoints must be accessible without a Bearer token.
 */
const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/health']);

/**
 * Extracts a Bearer token from the Authorization header value.
 * Returns undefined if the header is missing, empty, or not in "Bearer <token>" format.
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
  if (!token) {
    return undefined;
  }

  return token;
}

/**
 * JWT validation middleware for the Hono API.
 *
 * Extracts the Bearer token from the Authorization header, verifies it
 * with Supabase Auth admin API, and sets the authenticated user on the
 * Hono context. All routes except those in PUBLIC_PATHS require a valid JWT.
 *
 * - Missing Authorization header: 401 with `{ error: 'Missing authorization header' }`
 * - Invalid/expired token: 401 with `{ error: 'Invalid token' }`
 * - Valid token: `c.set('user', { id, email })` and continues to next handler
 *
 * Creates a Supabase admin client per-request (API-004: no expensive work at module scope).
 * Uses service_role key for token verification only — never for user data queries.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  c.set('user', {
    id: data.user.id,
    email: data.user.email,
  });

  return next();
};
