import { beforeEach } from "vitest";
import { __resetDemoAssetCache } from "./utils/demo-assets";
import { __resetDemoLoadCache } from "./hooks/use-demo-loader";

// Polyfill ResizeObserver for JSDOM — used by cmdk internally
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill scrollIntoView for JSDOM — used by cmdk to scroll selected items into view
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// Polyfill matchMedia for JSDOM — `resolveTheme` asks it what `system` means,
// so ANY component that reads the theme hits this. Answering "not dark" makes
// the default light, which is what every fixture in the suite assumes; a test
// that needs the other answer overrides this on `window` itself.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
}

// Polyfill localStorage for JSDOM — used by the editor autosave
if (typeof window !== "undefined" && typeof window.localStorage?.clear !== "function") {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}

// Isolate tests from each other's persisted editor autosave state.
beforeEach(() => {
  window.localStorage?.clear();
  // Demo module + asset caches are module-level; reset so cases start cold.
  __resetDemoAssetCache();
  __resetDemoLoadCache();
});
