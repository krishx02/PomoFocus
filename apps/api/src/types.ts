import type { Env } from 'hono';

/**
 * Authenticated user object extracted from a verified Supabase JWT.
 * Set on the Hono context by the auth middleware.
 */
export type AuthUser = {
  readonly id: string;
  readonly email: string | undefined;
};

/**
 * Hono context variables set by middleware.
 * Route handlers access these via `c.get('user')`.
 */
export type AppVariables = {
  readonly user: AuthUser;
};

/**
 * Environment bindings expected by the Hono API.
 * Maps to [vars] in wrangler.toml.
 */
export type AppBindings = {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly ALLOWED_ORIGINS?: string;
};

/**
 * Combined Hono env type used across the app.
 * Pass this as the generic to OpenAPIHono / Hono.
 */
export type AppEnv = Env & {
  Bindings: AppBindings;
  Variables: AppVariables;
};
