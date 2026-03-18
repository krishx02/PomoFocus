import { describe, it, expect } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { registerHealthRoute } from './health.js';
import { registerMeRoute } from './me.js';
import { registerSessionsRoute } from './sessions.js';

function createTestApp(): OpenAPIHono {
  const app = new OpenAPIHono();
  registerHealthRoute(app);
  registerMeRoute(app);
  registerSessionsRoute(app);
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'PomoFocus API',
      version: '0.1.0',
    },
  });
  return app;
}

describe('GET /openapi.json', () => {
  it('returns 200 status', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');

    expect(res.status).toBe(200);
  });

  it('returns valid OpenAPI 3.1.0 spec', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: Record<string, unknown> = await res.json();

    expect(body.openapi).toBe('3.1.0');
  });

  it('includes correct info block', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { info: { title: string; version: string } } = await res.json();

    expect(body.info.title).toBe('PomoFocus API');
    expect(body.info.version).toBe('0.1.0');
  });

  it('includes all 4 routes', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { paths: Record<string, unknown> } = await res.json();
    const paths = Object.keys(body.paths).sort();

    expect(paths).toContain('/health');
    expect(paths).toContain('/v1/me');
    expect(paths).toContain('/v1/sessions');
  });

  it('includes GET /health', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { paths: Record<string, Record<string, unknown>> } = await res.json();

    expect(body.paths['/health']?.['get']).toBeDefined();
  });

  it('includes GET /v1/me', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { paths: Record<string, Record<string, unknown>> } = await res.json();

    expect(body.paths['/v1/me']?.['get']).toBeDefined();
  });

  it('includes POST /v1/sessions', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { paths: Record<string, Record<string, unknown>> } = await res.json();

    expect(body.paths['/v1/sessions']?.['post']).toBeDefined();
  });

  it('includes GET /v1/sessions', async () => {
    const app = createTestApp();
    const res = await app.request('/openapi.json');
    const body: { paths: Record<string, Record<string, unknown>> } = await res.json();

    expect(body.paths['/v1/sessions']?.['get']).toBeDefined();
  });
});
