import type { FetchResponse } from 'openapi-fetch';
import type { ApiClient } from './client';
import type { paths } from './generated/api-types';

type CreateSessionBody =
  paths['/v1/sessions']['post']['requestBody']['content']['application/json'];

type CreateSessionResult = Promise<
  FetchResponse<paths['/v1/sessions']['post'], object, 'application/json'>
>;

type GetSessionsQuery = NonNullable<
  paths['/v1/sessions']['get']['parameters']['query']
>;

type GetSessionsResult = Promise<
  FetchResponse<paths['/v1/sessions']['get'], object, 'application/json'>
>;

export function createSession(
  client: ApiClient,
  data: CreateSessionBody,
): CreateSessionResult {
  return client.POST('/v1/sessions', {
    body: data,
  });
}

export function getSessions(
  client: ApiClient,
  params?: GetSessionsQuery,
): GetSessionsResult {
  return client.GET('/v1/sessions', params
    ? { params: { query: params } }
    : {},
  );
}
