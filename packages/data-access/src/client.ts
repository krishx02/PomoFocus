import createClient from 'openapi-fetch';
import type { Client } from 'openapi-fetch';
import type { paths } from './generated/api-types';
import { createTokenProvider } from './auth/token-refresh';
import type { TokenRefreshDeps } from './auth/token-refresh';

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
  // ensuring the token is fresh. openapi-fetch expects the standard
  // (input: Request) => Promise<Response> signature.
  const authenticatedFetch = async (input: Request): Promise<Response> => {
    const token = await getToken();

    if (token === undefined) {
      return globalThis.fetch(input);
    }

    // Clone the request with the Authorization header injected
    const authenticatedRequest = new Request(input, {
      headers: new Headers(input.headers),
    });
    authenticatedRequest.headers.set('Authorization', `Bearer ${token}`);

    return globalThis.fetch(authenticatedRequest);
  };

  return createClient<paths>({ baseUrl, fetch: authenticatedFetch });
}

export { createApiClient };
export type { ApiClient, ApiClientOptions };
