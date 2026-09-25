// Marks pointer events a demo fires itself, so "is the visitor's hand here?" listeners
// can ignore them. A property, not `isTrusted`: test-fired events are untrusted too.

const SYNTHETIC = "__demoCursorTour";

export function markSyntheticPointer<T extends Event>(event: T): T {
  Object.defineProperty(event, SYNTHETIC, { value: true });
  return event;
}

export function isSyntheticPointer(event: Event): boolean {
  return SYNTHETIC in event;
}
