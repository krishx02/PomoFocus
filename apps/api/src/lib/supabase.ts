import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@pomofocus/types';

/**
 * Environment bindings required by the Supabase client helpers.
 * Set via `wrangler secret put` — never stored in wrangler.toml.
 */
export type SupabaseEnv = {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
};

/**
 * Creates a typed Supabase client scoped to the authenticated user.
 *
 * The user's JWT is passed in the Authorization header so Supabase
 * resolves `auth.uid()` to the user's ID — RLS policies apply as if
 * the client talked directly to Supabase (ADR-007, API-005).
 *
 * Uses the anon key as the client key — the JWT provides the actual
 * authorization. Called per-request, never cached at module scope (API-004).
 */
export function createUserClient(
  env: SupabaseEnv,
  accessToken: string,
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a typed Supabase client using the service_role key.
 *
 * Bypasses RLS — use only for admin operations (e.g., DELETE /v1/me,
 * cross-user aggregations). Never use for user-scoped queries (API-005).
 *
 * Called per-request, never cached at module scope (API-004).
 */
export function createAdminClient(
  env: SupabaseEnv,
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a typed Supabase client using the service_role key.
 *
 * Called per-request — never cached at module scope (API-004).
 * Uses service_role for server-side operations (API-005).
 *
 * Prefer `createAdminClient` for new code. This function accepts
 * a narrower env type for backward compatibility with existing routes
 * that will be migrated to use `createUserClient` or `createAdminClient`.
 */
export function createSupabaseClient(
  env: Pick<SupabaseEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>,
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
