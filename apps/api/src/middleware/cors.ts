import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

/**
 * Default allowed origins used when no ALLOWED_ORIGINS env var is set.
 * Covers common local development ports.
 */
const DEFAULT_DEV_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8787',
];

/**
 * Parses a comma-separated string of origins into an array.
 * Trims whitespace and filters out empty strings.
 */
export function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * Creates CORS middleware configured from environment bindings.
 *
 * Reads `ALLOWED_ORIGINS` from Cloudflare Workers env vars.
 * - If set: parses as comma-separated list of allowed origins.
 * - If empty/missing: falls back to localhost dev origins.
 *
 * Preflight OPTIONS requests return 204 (Hono default).
 * Standard CORS headers are added to all responses.
 */
export function createCorsMiddleware(allowedOrigins: string | undefined): MiddlewareHandler {
  const origins = allowedOrigins ? parseOrigins(allowedOrigins) : [...DEFAULT_DEV_ORIGINS];

  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });
}

/**
 * Environment bindings for CORS configuration.
 * Extends any existing env type with the optional ALLOWED_ORIGINS var.
 */
export type CorsEnv = {
  readonly ALLOWED_ORIGINS?: string;
};

/**
 * CORS middleware that reads allowed origins from Cloudflare Workers env
 * on each request. This is necessary because CF Workers env is only
 * available at request time, not at module scope.
 *
 * Wire into the app via `app.use('*', corsMiddleware)`.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: CorsEnv }> = async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS;
  const handler = createCorsMiddleware(allowedOrigins);
  return handler(c, next);
};
