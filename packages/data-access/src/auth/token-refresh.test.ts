import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTokenProvider,
  isTokenExpiringSoon,
} from './token-refresh';
import type { TokenRefreshDeps } from './token-refresh';

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe('isTokenExpiringSoon', () => {
  it('returns true when expiresAt is in the past', () => {
    const pastTime = nowEpochSeconds() - 60;
    expect(isTokenExpiringSoon(pastTime, 300)).toBe(true);
  });

  it('returns true when expiresAt is within the buffer window', () => {
    const soonTime = nowEpochSeconds() + 120; // 2 minutes from now
    expect(isTokenExpiringSoon(soonTime, 300)).toBe(true); // 5 minute buffer
  });

  it('returns false when expiresAt is well in the future', () => {
    const futureTime = nowEpochSeconds() + 3600; // 1 hour from now
    expect(isTokenExpiringSoon(futureTime, 300)).toBe(false);
  });

  it('returns true when expiresAt is undefined', () => {
    expect(isTokenExpiringSoon(undefined, 300)).toBe(true);
  });
});

describe('createTokenProvider', () => {
  let getAccessToken: ReturnType<typeof vi.fn<() => Promise<string | undefined>>>;
  let getExpiresAt: ReturnType<typeof vi.fn<() => Promise<number | undefined>>>;
  let refreshSession: ReturnType<typeof vi.fn<() => Promise<string>>>;
  let onAuthError: ReturnType<typeof vi.fn<(error: Error) => void>>;
  let getToken: () => Promise<string | undefined>;

  beforeEach(() => {
    getAccessToken = vi.fn<() => Promise<string | undefined>>();
    getExpiresAt = vi.fn<() => Promise<number | undefined>>();
    refreshSession = vi.fn<() => Promise<string>>();
    onAuthError = vi.fn<(error: Error) => void>();

    const deps: TokenRefreshDeps = {
      getAccessToken,
      getExpiresAt,
      refreshSession,
      onAuthError,
    };

    getToken = createTokenProvider(deps);
  });

  it('returns valid token without refreshing when not near expiry', async () => {
    const futureTime = nowEpochSeconds() + 3600;
    getAccessToken.mockResolvedValue('valid-jwt-token');
    getExpiresAt.mockResolvedValue(futureTime);

    const token = await getToken();

    expect(token).toBe('valid-jwt-token');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes and returns new token when token is expired', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt-token');
    getExpiresAt.mockResolvedValue(pastTime);
    refreshSession.mockResolvedValue('new-jwt-token');

    const token = await getToken();

    expect(token).toBe('new-jwt-token');
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it('refreshes proactively when token is within 5 minutes of expiry', async () => {
    const nearExpiryTime = nowEpochSeconds() + 120; // 2 minutes from now
    getAccessToken.mockResolvedValue('near-expiry-jwt');
    getExpiresAt.mockResolvedValue(nearExpiryTime);
    refreshSession.mockResolvedValue('refreshed-jwt');

    const token = await getToken();

    expect(token).toBe('refreshed-jwt');
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it('queues concurrent callers behind a single refresh call', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt');
    getExpiresAt.mockResolvedValue(pastTime);

    // Simulate a slow refresh
    let resolveRefresh: ((token: string) => void) | undefined;
    refreshSession.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    // Fire three concurrent token requests
    const promise1 = getToken();
    const promise2 = getToken();
    const promise3 = getToken();

    // Flush microtasks so all three reach performRefresh()
    await Promise.resolve();
    await Promise.resolve();

    // Only one refresh should be in flight
    expect(refreshSession).toHaveBeenCalledOnce();

    // Resolve the refresh
    resolveRefresh?.('shared-refreshed-token');

    const [token1, token2, token3] = await Promise.all([promise1, promise2, promise3]);

    expect(token1).toBe('shared-refreshed-token');
    expect(token2).toBe('shared-refreshed-token');
    expect(token3).toBe('shared-refreshed-token');

    // Still only one refresh call total
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it('calls onAuthError and returns undefined when refresh fails', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt');
    getExpiresAt.mockResolvedValue(pastTime);
    refreshSession.mockRejectedValue(new Error('Refresh token expired'));

    const token = await getToken();

    expect(token).toBeUndefined();
    expect(onAuthError).toHaveBeenCalledOnce();
    expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Refresh token expired',
    }) as Error);
  });

  it('returns undefined when no session exists', async () => {
    getAccessToken.mockResolvedValue(undefined);

    const token = await getToken();

    expect(token).toBeUndefined();
    expect(refreshSession).not.toHaveBeenCalled();
    expect(onAuthError).not.toHaveBeenCalled();
    expect(getExpiresAt).not.toHaveBeenCalled();
  });

  it('resets refresh lock after successful refresh so subsequent calls can refresh again', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt');
    getExpiresAt.mockResolvedValue(pastTime);

    // First request: token expired, needs refresh
    refreshSession.mockResolvedValue('first-refresh-token');
    const token1 = await getToken();
    expect(token1).toBe('first-refresh-token');
    expect(refreshSession).toHaveBeenCalledOnce();

    // Second request: token expired again (simulating time passing)
    refreshSession.mockResolvedValue('second-refresh-token');
    const token2 = await getToken();

    expect(token2).toBe('second-refresh-token');
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('resets refresh lock after failed refresh so subsequent calls can retry', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt');
    getExpiresAt.mockResolvedValue(pastTime);

    // First attempt fails
    refreshSession.mockRejectedValue(new Error('Network error'));
    const token1 = await getToken();
    expect(token1).toBeUndefined();
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(onAuthError).toHaveBeenCalledOnce();

    // Second attempt can try refreshing again
    refreshSession.mockResolvedValue('recovered-token');
    const token2 = await getToken();

    expect(token2).toBe('recovered-token');
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('wraps non-Error rejections in an Error object for onAuthError', async () => {
    const pastTime = nowEpochSeconds() - 60;
    getAccessToken.mockResolvedValue('expired-jwt');
    getExpiresAt.mockResolvedValue(pastTime);
    refreshSession.mockRejectedValue('string rejection');

    await getToken();

    expect(onAuthError).toHaveBeenCalledOnce();
    const errorArg = onAuthError.mock.calls[0]?.[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg?.message).toBe('string rejection');
  });
});
