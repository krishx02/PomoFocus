// Network connectivity detector for sync queue drain (ADR-006).
// Uses navigator.onLine + online/offline events for web.
// No React imports (PKG-D04).
//
// Runtime feature-detection only — no `declare global` augmentation.
// The data-access package uses lib: ["esnext"] without DOM types, but
// downstream consumers (apps/web, packages/state) include DOM. A global
// augmentation that narrows `navigator` to `{ readonly onLine: boolean }`
// conflicts with the full `Navigator` type from lib.dom.d.ts, breaking
// type-check in those packages. Instead we access browser globals through
// `globalThis` cast to `unknown` and use runtime typeof guards.

type NetworkCallback = () => void;

type Unsubscribe = () => void;

// Typed accessor for globalThis in environments that may or may not have DOM.
// Cast through `unknown` avoids conflict with both DOM and non-DOM tsconfigs.
const _global = globalThis as unknown as {
  navigator?: { readonly onLine: boolean };
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

/**
 * Synchronous check for current network connectivity.
 * Returns true if navigator.onLine is true or navigator is unavailable
 * (assumes online in non-browser environments like Node.js).
 */
function isOnline(): boolean {
  if (typeof _global.navigator === 'undefined') {
    return true;
  }

  return _global.navigator.onLine;
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
  if (typeof _global.addEventListener !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  _global.addEventListener('online', callback);

  return () => {
    if (typeof _global.removeEventListener === 'function') {
      _global.removeEventListener('online', callback);
    }
  };
}

export { isOnline, onNetworkAvailable };
export type { NetworkCallback, Unsubscribe };
