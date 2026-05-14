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
