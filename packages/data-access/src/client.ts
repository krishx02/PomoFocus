import createClient from 'openapi-fetch';
import type { Client, Middleware } from 'openapi-fetch';
import type { paths } from './generated/api-types';
import { createTokenProvider } from './auth/token-refresh';
import type { TokenRefreshDeps } from './auth/token-refresh';

type ApiClient = Client<paths>;

type ApiClientOptions = {
  readonly baseUrl: string;
  readonly auth?: TokenRefreshDeps;
};

function createAuthMiddleware(auth: TokenRefreshDeps): Middleware {
  const getToken = createTokenProvider(auth);

  return {
    async onRequest({ request }) {
      const token = await getToken();

      if (token === undefined) {
        return undefined;
      }

      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
}

function createApiClient(baseUrl: string, auth?: TokenRefreshDeps): ApiClient {
  const client = createClient<paths>({ baseUrl });

  if (auth !== undefined) {
    client.use(createAuthMiddleware(auth));
  }

  return client;
}

export { createApiClient };
export type { ApiClient, ApiClientOptions };
