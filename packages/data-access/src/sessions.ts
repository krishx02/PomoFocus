import type { ApiClient } from './client';
import type { paths } from './generated/api-types';

type CreateSessionBody =
  paths['/v1/sessions']['post']['requestBody']['content']['application/json'];

type SessionResponse =
  paths['/v1/sessions']['post']['responses']['201']['content']['application/json'];

type SessionListResponse =
  paths['/v1/sessions']['get']['responses']['200']['content']['application/json'];

type SessionListParams =
  paths['/v1/sessions']['get']['parameters']['query'];

type CreateSessionResult = {
  readonly data: SessionResponse | undefined;
  readonly error: unknown;
};

type GetSessionsResult = {
  readonly data: SessionListResponse | undefined;
  readonly error: unknown;
};

async function createSession(
  client: ApiClient,
  body: CreateSessionBody,
): Promise<CreateSessionResult> {
  const { data, error } = await client.POST('/v1/sessions', {
    body,
  });

  return { data, error };
}

async function getSessions(
  client: ApiClient,
  params?: SessionListParams,
): Promise<GetSessionsResult> {
  const options = params !== undefined
    ? { params: { query: params } }
    : undefined;

  const { data, error } = await client.GET('/v1/sessions', options);

  return { data, error };
}

export { createSession, getSessions };
export type {
  CreateSessionBody,
  SessionResponse,
  SessionListResponse,
  SessionListParams,
  CreateSessionResult,
  GetSessionsResult,
};
