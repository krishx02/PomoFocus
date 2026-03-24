import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, extractBearerToken } from './auth.js';
import type { AppEnv } from '../types.js';

/**
 * Mock Supabase auth.getUser to control test outcomes.
 */
const mockGetUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

/**
 * Fake environment bindings for test apps.
 */
const TEST_ENV: AppEnv['Bindings'] = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

/**
 * Creates a Hono app wired with auth middleware and test routes.
 * Includes /health (public) and /v1/me (protected).
 */
function createTestApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', authMiddleware);

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/v1/me', (c) => {
    const user = c.get('user');
    return c.json({ id: user.id, email: user.email });
  });

  return app;
}

/**
 * Helper to make requests against the test app with fake env bindings.
 */
function testRequest(
  app: Hono<AppEnv>,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return app.request(path, options, TEST_ENV);
}

describe('extractBearerToken', () => {
  it('extracts token from valid Bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns undefined for missing header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractBearerToken('')).toBeUndefined();
  });

  it('returns undefined for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeUndefined();
  });

  it('returns undefined for Bearer with no token', () => {
    expect(extractBearerToken('Bearer ')).toBeUndefined();
  });

  it('returns undefined for malformed header with extra parts', () => {
    expect(extractBearerToken('Bearer abc 123')).toBeUndefined();
  });

  it('returns undefined for just the word Bearer', () => {
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('authMiddleware', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  describe('public paths', () => {
    it('/health is accessible without a token', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/health');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('/health does not call Supabase auth', async () => {
      const app = createTestApp();
      await testRequest(app, '/health');

      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe('missing authorization header', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/v1/me');

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Missing authorization header' });
    });

    it('returns 401 for empty Authorization header', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: '' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Missing authorization header' });
    });
  });

  describe('malformed token', () => {
    it('returns 401 for non-Bearer scheme', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Basic abc123' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Missing authorization header' });
    });

    it('returns 401 for Bearer with no token value', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer ' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Missing authorization header' });
    });
  });

  describe('invalid/expired token', () => {
    it('returns 401 when Supabase rejects the token', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid claim: missing sub claim' },
      });

      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid token' });
    });

    it('returns 401 when token is expired', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'JWT expired' },
      });

      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer expired-token' },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid token' });
    });

});

  describe('valid token', () => {
    it('sets user on context and continues to handler', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ id: 'user-123', email: 'test@example.com' });
    });

    it('handles user with no email', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-456',
            email: undefined,
          },
        },
        error: null,
      });

      const app = createTestApp();
      const res = await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('user-456');
    });

    it('passes the token to Supabase getUser', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: { id: 'user-789', email: 'test@example.com' },
        },
        error: null,
      });

      const app = createTestApp();
      await testRequest(app, '/v1/me', {
        headers: { Authorization: 'Bearer my-jwt-token' },
      });

      expect(mockGetUser).toHaveBeenCalledWith('my-jwt-token');
    });
  });

  describe('response format', () => {
    it('401 responses have JSON content-type', async () => {
      const app = createTestApp();
      const res = await testRequest(app, '/v1/me');

      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });
});
