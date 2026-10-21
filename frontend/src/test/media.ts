/**
 * jsdom has no `matchMedia`. The setup installs this stand-in (nothing matches); a test that needs a
 * wide screen calls `setMediaMatches(true)` before rendering.
 */
let matches = false;

export function setMediaMatches(value: boolean): void {
  matches = value;
}

export function installMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}
