// Network connectivity detector for sync queue drain (ADR-006).
// Uses navigator.onLine + online/offline events for web.
// No React imports (PKG-D04).
//
// Minimal global augmentation for browser APIs used by this module.
// The project uses lib: ["esnext"] without DOM, so navigator/addEventListener
// are not typed on globalThis. These declarations cover only what we use.

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    navigator?: { readonly onLine: boolean };
    addEventListener?(type: string, listener: () => void): void;
    removeEventListener?(type: string, listener: () => void): void;
  }

  // Augment globalThis with the same shape
  var navigator: { readonly onLine: boolean } | undefined;
  function addEventListener(type: string, listener: () => void): void;
  function removeEventListener(type: string, listener: () => void): void;
}

type NetworkCallback = () => void;

type Unsubscribe = () => void;

/**
 * Synchronous check for current network connectivity.
 * Returns true if navigator.onLine is true or navigator is unavailable
 * (assumes online in non-browser environments like Node.js).
 */
function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

/**
 * Registers a callback that fires when network connectivity is restored.
 * Uses the browser `online` event. In non-browser environments (Node.js,
 * tests), the callback is never automatically fired — callers must invoke
 * it manually or use platform-specific detection.
 *
 * Returns an unsubscribe function to remove the listener.
 */
function onNetworkAvailable(callback: NetworkCallback): Unsubscribe {
  if (typeof globalThis.addEventListener !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  globalThis.addEventListener('online', callback);

  return () => {
    globalThis.removeEventListener('online', callback);
  };
}

export { isOnline, onNetworkAvailable };
export type { NetworkCallback, Unsubscribe };
