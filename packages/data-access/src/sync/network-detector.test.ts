import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOnline, onNetworkAvailable } from './network-detector';

describe('isOnline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true });

    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(isOnline()).toBe(false);
  });

  it('returns true when navigator is undefined (non-browser environment)', () => {
    vi.stubGlobal('navigator', undefined);

    expect(isOnline()).toBe(true);
  });
});

describe('onNetworkAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers an online event listener and fires callback on online event', () => {
    const listeners: { type: string; callback: () => void }[] = [];

    const addSpy = vi.fn((type: string, callback: () => void) => {
      listeners.push({ type, callback });
    });
    vi.stubGlobal('addEventListener', addSpy);
    vi.stubGlobal('removeEventListener', vi.fn());

    const callback = vi.fn();
    onNetworkAvailable(callback);

    expect(addSpy).toHaveBeenCalledWith('online', callback);

    const listener = listeners.find((l) => l.type === 'online');
    expect(listener).toBeDefined();
    listener?.callback();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('returns an unsubscribe function that removes the listener', () => {
    const addSpy = vi.fn();
    const removeSpy = vi.fn();
    vi.stubGlobal('addEventListener', addSpy);
    vi.stubGlobal('removeEventListener', removeSpy);

    const callback = vi.fn();
    const unsubscribe = onNetworkAvailable(callback);

    unsubscribe();

    expect(removeSpy).toHaveBeenCalledWith('online', callback);
  });

  it('returns a no-op unsubscribe when addEventListener is not available', () => {
    vi.stubGlobal('addEventListener', undefined);

    const callback = vi.fn();
    const unsubscribe = onNetworkAvailable(callback);

    // Should not throw
    unsubscribe();

    // Callback should never have been called
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not fire callback until online event occurs', () => {
    vi.stubGlobal('addEventListener', vi.fn());
    vi.stubGlobal('removeEventListener', vi.fn());

    const callback = vi.fn();
    onNetworkAvailable(callback);

    expect(callback).not.toHaveBeenCalled();
  });

  it('allows multiple callbacks to be registered independently', () => {
    const listeners: { type: string; callback: () => void }[] = [];

    const addSpy = vi.fn((type: string, callback: () => void) => {
      listeners.push({ type, callback });
    });
    vi.stubGlobal('addEventListener', addSpy);
    vi.stubGlobal('removeEventListener', vi.fn());

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    onNetworkAvailable(callback1);
    onNetworkAvailable(callback2);

    expect(addSpy).toHaveBeenCalledTimes(2);

    for (const listener of listeners) {
      listener.callback();
    }

    expect(callback1).toHaveBeenCalledOnce();
    expect(callback2).toHaveBeenCalledOnce();
  });

  it('unsubscribing one callback does not affect others', () => {
    const addSpy = vi.fn();
    const removeSpy = vi.fn();
    vi.stubGlobal('addEventListener', addSpy);
    vi.stubGlobal('removeEventListener', removeSpy);

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsubscribe1 = onNetworkAvailable(callback1);
    onNetworkAvailable(callback2);

    unsubscribe1();

    expect(removeSpy).toHaveBeenCalledWith('online', callback1);
    expect(removeSpy).not.toHaveBeenCalledWith('online', callback2);
  });
});
