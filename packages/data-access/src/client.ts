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

      // openapi-fetch middleware types reference DOM Request/Headers which are
      // unresolvable without "dom" in tsconfig lib. The types are structurally
      // correct at runtime (Node 18+ globals).
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      request.headers.set('Authorization', `Bearer ${token}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
