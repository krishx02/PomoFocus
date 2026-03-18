import { describe, it, expect } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerHealthRoute } from './health.js';

function createTestApp(): OpenAPIHono {
  const app = new OpenAPIHono();
  registerHealthRoute(app);
  return app;
}

describe('GET /health', () => {
  it('returns 200 status', async () => {
    const app = createTestApp();
    const res = await app.request('/health');

    expect(res.status).toBe(200);
  });

  it('returns JSON with status "ok"', async () => {
    const app = createTestApp();
    const res = await app.request('/health');
    const body = await res.json();

    expect(body.status).toBe('ok');
  });

  it('returns a valid ISO 8601 timestamp', async () => {
    const app = createTestApp();
    const res = await app.request('/health');
    const body = await res.json();

    expect(body.timestamp).toBeDefined();
    // Verify it's a valid ISO 8601 date string
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('returns correct content-type header', async () => {
    const app = createTestApp();
    const res = await app.request('/health');

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns exactly the expected shape', async () => {
    const app = createTestApp();
    const res = await app.request('/health');
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
  });
});
