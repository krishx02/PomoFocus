import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { errorHandler } from './error-handler.js';
import type { ErrorResponse } from './error-handler.js';

/**
 * Creates a fresh Hono app wired with the error handler for each test.
 * Routes are added per-test to throw specific errors.
 */
function createTestApp(): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  return app;
}

async function parseJsonBody(response: Response): Promise<ErrorResponse> {
  return await response.json();
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('HTTPException handling', () => {
    it('returns the HTTPException status and message', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new HTTPException(404, { message: 'Not found' });
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Not found', status: 404 });
    });

    it('returns default message when HTTPException has no message', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new HTTPException(400);
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: 'Request error', status: 400 });
    });

    it('handles 401 HTTPException', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new HTTPException(401, { message: 'Unauthorized' });
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: 'Unauthorized', status: 401 });
    });

    it('handles 403 HTTPException', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new HTTPException(403, { message: 'Forbidden' });
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: 'Forbidden', status: 403 });
    });
  });

  describe('Supabase error mapping', () => {
    it('maps JWT expired to 401', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('JWT expired');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: 'Authentication expired', status: 401 });
    });

    it('maps invalid token to 401', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('invalid claim: token is malformed');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(401);
      expect(body).toEqual({ error: 'Invalid authentication', status: 401 });
    });

    it('maps not authorized to 403', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('User is not authorized to perform this action');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: 'Not authorized', status: 403 });
    });

    it('maps row-level security violation to 403', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('new row violates row-level security policy');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: 'Access denied', status: 403 });
    });

    it('maps unique constraint violation to 409', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('violates unique constraint "profiles_pkey"');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(409);
      expect(body).toEqual({ error: 'Resource already exists', status: 409 });
    });

    it('maps foreign key violation to 422', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('violates foreign key constraint "sessions_user_id_fkey"');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(422);
      expect(body).toEqual({ error: 'Referenced resource not found', status: 422 });
    });

    it('maps not-null violation to 422', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('violates not-null constraint on column "user_id"');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(422);
      expect(body).toEqual({ error: 'Missing required field', status: 422 });
    });

    it('maps check constraint violation to 422', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('violates check constraint "positive_duration"');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(422);
      expect(body).toEqual({ error: 'Invalid field value', status: 422 });
    });

    it('maps PostgREST error codes to 400', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('PGRST204: Column not found');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(400);
      expect(body).toEqual({ error: 'Invalid request', status: 400 });
    });

    it('does not leak Supabase error details in the response', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('violates unique constraint "profiles_pkey" on table "profiles"');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      // Should NOT contain table name, constraint name, or raw message
      expect(body.error).not.toContain('profiles_pkey');
      expect(body.error).not.toContain('profiles');
      expect(body.error).toBe('Resource already exists');
    });

    it('logs Supabase error details server-side', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('JWT expired');
      });

      await app.request('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Supabase error mapped'),
      );
    });
  });

  describe('unknown error handling', () => {
    it('returns 500 for unknown Error instances', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('something unexpected happened');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: 'Internal server error', status: 500 });
    });

    it('does not leak error details in 500 responses', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('database connection string: postgres://user:pass@host/db');
      });

      const res = await app.request('/test');
      const body = await parseJsonBody(res);

      expect(body.error).not.toContain('postgres://');
      expect(body.error).not.toContain('database');
      expect(body.error).toBe('Internal server error');
    });

    it('logs full error details server-side for 500 errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const app = createTestApp();
      const thrownError = new Error('something broke internally');
      app.get('/test', () => {
        throw thrownError;
      });

      await app.request('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[API] Unhandled error:',
        thrownError,
      );
    });
  });

  describe('response format consistency', () => {
    it('always returns JSON content-type', async () => {
      const app = createTestApp();
      app.get('/test', () => {
        throw new Error('any error');
      });

      const res = await app.request('/test');

      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('response body always has error and status fields', async () => {
      const app = createTestApp();
      app.get('/test-http', () => {
        throw new HTTPException(422, { message: 'Validation failed' });
      });
      app.get('/test-supabase', () => {
        throw new Error('JWT expired');
      });
      app.get('/test-unknown', () => {
        throw new Error('unknown');
      });

      const scenarios = ['/test-http', '/test-supabase', '/test-unknown'];
      for (const path of scenarios) {
        const res = await app.request(path);
        const body = await parseJsonBody(res);

        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('status');
        expect(typeof body.error).toBe('string');
        expect(typeof body.status).toBe('number');
      }
    });
  });
});
