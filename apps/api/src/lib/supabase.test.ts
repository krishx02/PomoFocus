import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Captures the arguments passed to `createClient` for each call.
 * Uses vi.hoisted() because vi.mock factories are hoisted above imports —
 * regular `const` would not be initialized yet when the factory executes.
 */
const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { createUserClient, createAdminClient, createSupabaseClient } from './supabase.js';
import type { SupabaseEnv } from './supabase.js';

const FAKE_ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUserClient', () => {
  it('passes the Supabase URL and anon key', () => {
    createUserClient(FAKE_ENV, FAKE_JWT);

    expect(mockCreateClient).toHaveBeenCalledWith(
      FAKE_ENV.SUPABASE_URL,
      FAKE_ENV.SUPABASE_ANON_KEY,
      expect.objectContaining({
        global: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_JWT}`,
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('sets the Authorization header with the user JWT', () => {
    createUserClient(FAKE_ENV, FAKE_JWT);

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        global: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_JWT}`,
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('disables auto-refresh and session persistence', () => {
    createUserClient(FAKE_ENV, FAKE_JWT);

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }) as unknown,
      }),
    );
  });

  it('does not use the service_role key', () => {
    createUserClient(FAKE_ENV, FAKE_JWT);

    expect(mockCreateClient).toHaveBeenCalledWith(
      FAKE_ENV.SUPABASE_URL,
      FAKE_ENV.SUPABASE_ANON_KEY,
      expect.anything(),
    );
    expect(mockCreateClient).not.toHaveBeenCalledWith(
      expect.anything(),
      FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY,
      expect.anything(),
    );
  });
});

describe('createAdminClient', () => {
  it('passes the Supabase URL and service_role key', () => {
    createAdminClient(FAKE_ENV);

    expect(mockCreateClient).toHaveBeenCalledWith(
      FAKE_ENV.SUPABASE_URL,
      FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY,
      expect.objectContaining({}),
    );
  });

  it('does not set a user Authorization header', () => {
    createAdminClient(FAKE_ENV);

    expect(mockCreateClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        global: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.anything() as unknown,
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('disables auto-refresh and session persistence', () => {
    createAdminClient(FAKE_ENV);

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }) as unknown,
      }),
    );
  });

  it('uses service_role key, not anon key', () => {
    createAdminClient(FAKE_ENV);

    expect(mockCreateClient).toHaveBeenCalledWith(
      FAKE_ENV.SUPABASE_URL,
      FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY,
      expect.anything(),
    );
    expect(mockCreateClient).not.toHaveBeenCalledWith(
      expect.anything(),
      FAKE_ENV.SUPABASE_ANON_KEY,
      expect.anything(),
    );
  });
});

describe('createSupabaseClient (backward-compat)', () => {
  it('creates a client with the service_role key for backward compatibility', () => {
    createSupabaseClient({
      SUPABASE_URL: FAKE_ENV.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY,
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      FAKE_ENV.SUPABASE_URL,
      FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY,
    );
  });
});
