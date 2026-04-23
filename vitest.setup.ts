/**
 * Global test setup — polyfills for jsdom that browser-oriented libraries require.
 */

// ResizeObserver is not available in jsdom; provide a no-op polyfill.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// IntersectionObserver polyfill (used by some UI libs)
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
