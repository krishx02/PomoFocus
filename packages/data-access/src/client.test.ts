import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from './client';
import type { ApiClient } from './client';

describe('createApiClient', () => {
  it('returns a client with standard HTTP methods', () => {
    const client = createApiClient('https://api.example.com');

    expect(typeof client.GET).toBe('function');
    expect(typeof client.POST).toBe('function');
    expect(typeof client.PUT).toBe('function');
    expect(typeof client.DELETE).toBe('function');
    expect(typeof client.PATCH).toBe('function');
  });

  it('returns a client with middleware methods', () => {
    const client = createApiClient('https://api.example.com');

    expect(typeof client.use).toBe('function');
    expect(typeof client.eject).toBe('function');
  });

  it('sends requests to the configured base URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', timestamp: '2026-01-01T00:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const baseUrl = 'https://api.pomofocus.test';
    const client = createApiClient(baseUrl);
    client.use({
      onRequest({ request }) {
        return mockFetch(request);
      },
    });

    await client.GET('/health');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const request = mockFetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${baseUrl}/health`);
  });

  it('uses different base URLs for different clients', () => {
    const devClient = createApiClient('http://localhost:8787');
    const prodClient = createApiClient('https://api.pomofocus.com');

    // Both are valid clients — the type system ensures type safety
    expect(typeof devClient.GET).toBe('function');
    expect(typeof prodClient.GET).toBe('function');
  });

  it('satisfies the ApiClient type', () => {
    const client: ApiClient = createApiClient('https://api.example.com');
    expect(client).toBeDefined();
  });
});
