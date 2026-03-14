import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@pomofocus/types';

/**
 * Environment bindings required by the Supabase client helper.
 * Matches the [vars] block in wrangler.toml.
 */
export type SupabaseEnv = {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
};

/**
 * Creates a typed Supabase client using the service_role key.
 *
 * Called per-request — never cached at module scope (API-004).
 * Uses service_role for server-side operations (API-005).
 * Phase 2 will add a separate helper that forwards user JWTs for RLS.
 */
export function createSupabaseClient(
  env: SupabaseEnv,
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
