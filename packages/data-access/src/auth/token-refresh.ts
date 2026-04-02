type TokenRefreshDeps = {
  readonly getAccessToken: () => Promise<string | undefined>;
  readonly getExpiresAt: () => Promise<number | undefined>;
  readonly refreshSession: () => Promise<string>;
  readonly onAuthError: (error: Error) => void;
};

const REFRESH_BUFFER_SECONDS = 300; // 5 minutes

function isTokenExpiringSoon(
  expiresAt: number | undefined,
  bufferSeconds: number,
): boolean {
  if (expiresAt === undefined) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt - nowSeconds < bufferSeconds;
}

/**
 * Returns the current valid access token, refreshing if needed.
 * Concurrent callers share a single in-flight refresh.
 * Returns undefined when no session exists.
 */
function createTokenProvider(deps: TokenRefreshDeps): () => Promise<string | undefined> {
  let refreshPromise: Promise<string> | undefined;

  function performRefresh(): Promise<string> {
    if (refreshPromise !== undefined) {
      return refreshPromise;
    }

    refreshPromise = deps.refreshSession().finally(() => {
      refreshPromise = undefined;
    });

    return refreshPromise;
  }

  return async (): Promise<string | undefined> => {
    const accessToken = await deps.getAccessToken();

    if (accessToken === undefined) {
      return undefined;
    }

    const expiresAt = await deps.getExpiresAt();
    const needsRefresh = isTokenExpiringSoon(expiresAt, REFRESH_BUFFER_SECONDS);

    if (!needsRefresh) {
      return accessToken;
    }

    try {
      return await performRefresh();
    } catch (rawError: unknown) {
      const error = rawError instanceof Error
        ? rawError
        : new Error(String(rawError));
      deps.onAuthError(error);
      return undefined;
    }
  };
}

export { createTokenProvider, isTokenExpiringSoon, REFRESH_BUFFER_SECONDS };
export type { TokenRefreshDeps };
