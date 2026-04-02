import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { AuthSession, AuthUser, AuthResult, AuthStateChangeCallback } from '@pomofocus/data-access';
import { createAuthStore } from './store.js';
import type { AuthOperations, AuthStoreInstance } from './store.js';
import { AuthProvider } from './provider.js';
import { useAuth, useUser, useIsAuthenticated } from './hooks.js';

// -- Test Fixtures --

const mockUser: AuthUser = {
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  provider: undefined,
};

const mockSession: AuthSession = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-123',
  expiresAt: 9999999999,
  user: mockUser,
};

function createMockOps(overrides?: Partial<AuthOperations>): AuthOperations {
  return {
    signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
      .mockResolvedValue({ data: undefined, error: undefined }),
    signUp: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
      .mockResolvedValue({ data: undefined, error: undefined }),
    signOut: vi.fn<() => Promise<AuthResult<undefined>>>()
      .mockResolvedValue({ data: undefined, error: undefined }),
    getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
      .mockResolvedValue({ data: undefined, error: undefined }),
    onAuthStateChange: vi.fn<
      (callback: (event: string, session: AuthSession | undefined) => void) => { unsubscribe: () => void }
    >()
      .mockReturnValue({ unsubscribe: vi.fn() }),
    ...overrides,
  };
}

function createStore(ops: AuthOperations): AuthStoreInstance {
  return createAuthStore(ops);
}

describe('auth store', () => {
  it('initializes with isLoading: true', () => {
    const ops = createMockOps();
    const store = createStore(ops);
    const state = store.getState();

    expect(state.isLoading).toBe(true);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  describe('signIn', () => {
    it('updates user and isAuthenticated on successful login', async () => {
      const ops = createMockOps({
        signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });
      const store = createStore(ops);

      await store.getState().signIn('test@example.com', 'password');

      const state = store.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(ops.signIn).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('sets error state on failed login', async () => {
      const authError = { message: 'Invalid credentials', status: 401 };
      const ops = createMockOps({
        signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: undefined, error: authError }),
      });
      const store = createStore(ops);

      await store.getState().signIn('test@example.com', 'wrong');

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toEqual(authError);
    });

    it('sets isLoading: true during login', async () => {
      let resolveSignIn!: (value: AuthResult<AuthSession>) => void;
      const ops = createMockOps({
        signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockReturnValue(
            new Promise((resolve) => {
              resolveSignIn = resolve;
            }),
          ),
      });
      const store = createStore(ops);

      const signInPromise = store.getState().signIn('test@example.com', 'password');

      // While in-flight, isLoading should be true
      expect(store.getState().isLoading).toBe(true);

      resolveSignIn({ data: mockSession, error: undefined });
      await signInPromise;

      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe('signUp', () => {
    it('updates user and isAuthenticated on successful signup with session', async () => {
      const ops = createMockOps({
        signUp: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });
      const store = createStore(ops);

      await store.getState().signUp('new@example.com', 'password');

      const state = store.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles signup pending email confirmation (no session returned)', async () => {
      const ops = createMockOps();
      const store = createStore(ops);

      await store.getState().signUp('new@example.com', 'password');

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error state on failed signup', async () => {
      const authError = { message: 'Email already registered', status: 422 };
      const ops = createMockOps({
        signUp: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: undefined, error: authError }),
      });
      const store = createStore(ops);

      await store.getState().signUp('existing@example.com', 'password');

      const state = store.getState();
      expect(state.error).toEqual(authError);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signOut', () => {
    it('clears user and sets isAuthenticated to false', async () => {
      // First sign in
      const ops = createMockOps({
        signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
        signOut: vi.fn<() => Promise<AuthResult<undefined>>>()
          .mockResolvedValue({ data: undefined, error: undefined }),
      });
      const store = createStore(ops);

      await store.getState().signIn('test@example.com', 'password');
      expect(store.getState().isAuthenticated).toBe(true);

      // Then sign out
      await store.getState().signOut();

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error state on failed signout', async () => {
      const authError = { message: 'Network error', status: undefined };
      const ops = createMockOps({
        signOut: vi.fn<() => Promise<AuthResult<undefined>>>()
          .mockResolvedValue({ data: undefined, error: authError }),
      });
      const store = createStore(ops);

      await store.getState().signOut();

      expect(store.getState().error).toEqual(authError);
      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe('initialize', () => {
    it('restores session from existing auth on initialize', async () => {
      const ops = createMockOps({
        getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });
      const store = createStore(ops);

      store.getState().initialize();

      await waitFor(() => {
        expect(store.getState().isLoading).toBe(false);
      });

      const state = store.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('sets isLoading false when no existing session', async () => {
      const ops = createMockOps();
      const store = createStore(ops);

      store.getState().initialize();

      await waitFor(() => {
        expect(store.getState().isLoading).toBe(false);
      });

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('subscribes to onAuthStateChange', () => {
      const ops = createMockOps();
      const store = createStore(ops);

      store.getState().initialize();

      expect(ops.onAuthStateChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('returns unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      const ops = createMockOps({
        onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe }),
      });
      const store = createStore(ops);

      const subscription = store.getState().initialize();

      subscription.unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('auth state change subscription', () => {
    it('updates store when user signs in via auth state change', async () => {
      let capturedCallback: AuthStateChangeCallback | undefined;
      const ops = createMockOps({
        onAuthStateChange: vi.fn().mockImplementation(
          (callback: AuthStateChangeCallback) => {
            capturedCallback = callback;
            return { unsubscribe: vi.fn() };
          },
        ),
      });
      const store = createStore(ops);

      store.getState().initialize();

      // Wait for initial session check to complete
      await waitFor(() => {
        expect(store.getState().isLoading).toBe(false);
      });

      expect(capturedCallback).toBeDefined();

      // Simulate auth state change to signed in
      act(() => {
        if (capturedCallback !== undefined) {
          capturedCallback('SIGNED_IN', mockSession);
        }
      });

      const state = store.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('clears user when auth state change indicates sign out', async () => {
      // Start with a user signed in
      let capturedCallback: AuthStateChangeCallback | undefined;
      const ops = createMockOps({
        getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
        onAuthStateChange: vi.fn().mockImplementation(
          (callback: AuthStateChangeCallback) => {
            capturedCallback = callback;
            return { unsubscribe: vi.fn() };
          },
        ),
      });
      const store = createStore(ops);

      store.getState().initialize();

      await waitFor(() => {
        expect(store.getState().isAuthenticated).toBe(true);
      });

      // Simulate sign out via auth state change
      act(() => {
        if (capturedCallback !== undefined) {
          capturedCallback('SIGNED_OUT', undefined);
        }
      });

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      const authError = { message: 'Some error', status: 500 };
      const ops = createMockOps({
        signIn: vi.fn<(email: string, password: string) => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: undefined, error: authError }),
      });
      const store = createStore(ops);

      await store.getState().signIn('test@example.com', 'wrong');
      expect(store.getState().error).toEqual(authError);

      store.getState().clearError();
      expect(store.getState().error).toBeNull();
    });
  });
});

describe('AuthProvider', () => {
  let mockOps: AuthOperations;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockOps = createMockOps({
      onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: mockUnsubscribe }),
    });
  });

  it('subscribes on mount and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => null, {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AuthProvider, { ops: mockOps, children }),
    });

    // onAuthStateChange should have been called (subscribed)
    expect(mockOps.onAuthStateChange).toHaveBeenCalledTimes(1);

    // Unmount triggers cleanup
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('auth hooks', () => {
  function createWrapper(ops: AuthOperations): (props: { children: ReactNode }) => ReactNode {
    return function Wrapper({ children }: { children: ReactNode }): ReactNode {
      return createElement(AuthProvider, { ops, children });
    };
  }

  describe('useAuth', () => {
    it('returns auth state with actions', async () => {
      const ops = createMockOps({
        getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(ops),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.signIn).toBe('function');
      expect(typeof result.current.signUp).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
    });
  });

  describe('useUser', () => {
    it('returns current user', async () => {
      const ops = createMockOps({
        getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(ops),
      });

      await waitFor(() => {
        expect(result.current).toEqual(mockUser);
      });
    });

    it('returns null when no user', () => {
      const ops = createMockOps();

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(ops),
      });

      expect(result.current).toBeNull();
    });
  });

  describe('useIsAuthenticated', () => {
    it('returns true when authenticated', async () => {
      const ops = createMockOps({
        getSession: vi.fn<() => Promise<AuthResult<AuthSession>>>()
          .mockResolvedValue({ data: mockSession, error: undefined }),
      });

      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(ops),
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('returns false when not authenticated', () => {
      const ops = createMockOps();

      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(ops),
      });

      // Initial value is false (default state)
      expect(result.current).toBe(false);
    });
  });
});
