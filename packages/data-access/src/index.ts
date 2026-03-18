// Server interaction: OpenAPI client, auth token management, sync drivers.
// All auth imports live here. Core never imports this.
export { createApiClient } from './client';
export type { ApiClient } from './client';
export { isApiError, handleApiError } from './errors';
export type { ApiError, ErrorResponseInput } from './errors';
export { createSession, getSessions } from './sessions';
export type {
  CreateSessionBody,
  SessionResponse,
  SessionListResponse,
  SessionListParams,
  CreateSessionResult,
  GetSessionsResult,
} from './sessions';
