import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createCorsMiddleware, parseOrigins } from './cors.js';

/**
 * Creates a test app with CORS middleware and a simple route.
 */
function createTestApp(allowedOrigins?: string): Hono {
  const app = new Hono();
  app.use('*', createCorsMiddleware(allowedOrigins));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  return app;
}

describe('parseOrigins', () => {
  it('parses comma-separated origins', () => {
    expect(parseOrigins('https://app.pomofocus.dev,https://pomofocus.dev')).toEqual([
      'https://app.pomofocus.dev',
      'https://pomofocus.dev',
    ]);
  });

  it('trims whitespace around origins', () => {
    expect(parseOrigins('  https://a.com , https://b.com  ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('filters out empty strings from trailing commas', () => {
    expect(parseOrigins('https://a.com,,https://b.com,')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseOrigins('')).toEqual([]);
  });
});

describe('createCorsMiddleware', () => {
  describe('preflight requests', () => {
    it('returns 204 for OPTIONS preflight', async () => {
      const app = createTestApp();
      const res = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(res.status).toBe(204);
    });

    it('includes CORS headers on preflight response', async () => {
      const app = createTestApp();
      const res = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });
  });

  describe('default dev origins', () => {
    it('allows localhost:3000 when no ALLOWED_ORIGINS set', async () => {
      const app = createTestApp(undefined);
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('allows localhost:5173 when no ALLOWED_ORIGINS set', async () => {
      const app = createTestApp(undefined);
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:5173' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });

    it('rejects unknown origins when no ALLOWED_ORIGINS set', async () => {
      const app = createTestApp(undefined);
      const res = await app.request('/health', {
        headers: { Origin: 'https://evil.com' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('configured origins', () => {
    it('allows configured production origin', async () => {
      const app = createTestApp('https://app.pomofocus.dev,https://pomofocus.dev');
      const res = await app.request('/health', {
        headers: { Origin: 'https://app.pomofocus.dev' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.pomofocus.dev');
    });

    it('rejects origins not in the configured list', async () => {
      const app = createTestApp('https://app.pomofocus.dev');
      const res = await app.request('/health', {
        headers: { Origin: 'https://evil.com' },
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('CORS headers on regular responses', () => {
    it('includes CORS headers on GET response', async () => {
      const app = createTestApp();
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('includes credentials header', async () => {
      const app = createTestApp();
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });
});
