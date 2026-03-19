import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { createSession } from '@pomofocus/data-access';
import type { ApiClient, CreateSessionBody, SessionResponse } from '@pomofocus/data-access';

/**
 * Creates a new session via the API and invalidates the sessions cache (PKG-S07).
 * Server data stays in TanStack Query cache — not stored in Zustand (PKG-S01).
 */
function useCreateSession(
  client: ApiClient,
): UseMutationResult<SessionResponse, Error, CreateSessionBody> {
  const queryClient = useQueryClient();

  return useMutation<SessionResponse, Error, CreateSessionBody>({
    mutationFn: async (body: CreateSessionBody): Promise<SessionResponse> => {
      const result = await createSession(client, body);

      if (result.error !== undefined) {
        if (result.error instanceof Error) {
          throw result.error;
        }
        throw new Error(
          typeof result.error === 'string' ? result.error : 'Failed to create session',
        );
      }

      if (result.data === undefined) {
        throw new Error('No data returned from createSession');
      }

      return result.data;
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export { useCreateSession };
