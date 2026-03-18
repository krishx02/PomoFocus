import { describe, it, expect } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerMeRoute, MeResponseSchema } from './me.js';

function createTestApp(): OpenAPIHono {
  const app = new OpenAPIHono();
  registerMeRoute(app);
  return app;
}

describe('GET /v1/me', () => {
  it('returns 200 status', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me');

    expect(res.status).toBe(200);
  });

  it('returns JSON with id "anonymous"', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me');
    const body = MeResponseSchema.parse(await res.json());

    expect(body.id).toBe('anonymous');
  });

  it('returns a valid ISO 8601 created_at timestamp', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me');
    const body = MeResponseSchema.parse(await res.json());

    expect(body.created_at).toBeDefined();
    const parsed = new Date(body.created_at);
    expect(parsed.toISOString()).toBe(body.created_at);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('returns correct content-type header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me');

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns exactly the expected shape', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/me');
    const body = MeResponseSchema.parse(await res.json());

    expect(Object.keys(body).sort()).toEqual(['created_at', 'id']);
  });
});
