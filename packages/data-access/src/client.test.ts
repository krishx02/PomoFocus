import { describe, it, expect } from 'vitest';
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

  it('creates distinct clients for different base URLs', () => {
    const devClient = createApiClient('http://localhost:8787');
    const prodClient = createApiClient('https://api.pomofocus.com');

    // Both are valid clients — the type system ensures type safety
    expect(typeof devClient.GET).toBe('function');
    expect(typeof prodClient.GET).toBe('function');
    // Clients are distinct instances
    expect(devClient).not.toBe(prodClient);
  });

  it('satisfies the ApiClient type', () => {
    const client: ApiClient = createApiClient('https://api.example.com');
    expect(client).toBeDefined();
  });
});
