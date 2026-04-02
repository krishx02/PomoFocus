import createClient from 'openapi-fetch';
import type { Client } from 'openapi-fetch';
import type { paths } from './generated/api-types';
import { createTokenProvider } from './auth/token-refresh';
import type { TokenRefreshDeps } from './auth/token-refresh';

// Node 18+ provides globalThis.fetch at runtime, but the project's tsconfig
// uses lib:"esnext" without "dom", so the type is absent. Declare the minimal
// shape needed for the auth fetch wrapper.
declare const fetch: (
  input: unknown,
  init?: { headers?: Record<string, string> } & Record<string, unknown>,
) => Promise<unknown>;

type ApiClient = Client<paths>;

type ApiClientOptions = {
  readonly baseUrl: string;
  readonly auth?: TokenRefreshDeps;
};

function createApiClient(baseUrl: string, auth?: TokenRefreshDeps): ApiClient {
  if (auth === undefined) {
    return createClient<paths>({ baseUrl });
  }

  const getToken = createTokenProvider(auth);

  // Wrap the global fetch to inject the Authorization header after
  // ensuring the token is fresh. This is the boundary between our typed
  // token provider and the DOM fetch API. The wrapper is structurally
  // compatible with openapi-fetch's `fetch` option.
  const authenticatedFetch: NonNullable<Parameters<typeof createClient>[0]>['fetch'] =
    async (input: unknown, init?: Record<string, unknown>) => {
      const token = await getToken();

      if (token === undefined) {
        return fetch(input, init);
      }

      // Build headers with Authorization token injected
      const existingHeaders = (init?.['headers'] ?? {}) as Record<string, string>;
      const headers = { ...existingHeaders, Authorization: `Bearer ${token}` };

      return fetch(input, { ...init, headers });
    };

  return createClient<paths>({ baseUrl, fetch: authenticatedFetch });
}

export { createApiClient };
export type { ApiClient, ApiClientOptions };
