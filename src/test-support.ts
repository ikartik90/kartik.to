import { act } from "@testing-library/react";
import { vi } from "vitest";

export interface InViewControl {
  /** Report how much of the observed element is on screen, 0 to 1. */
  (ratio?: number): void;
  /** Scrolled below the gate's closing fraction. */
  away: () => void;
}

/** Stubs IntersectionObserver in jsdom and returns a control; call `vi.unstubAllGlobals()` between tests. */
export function scrollIntoView(): InViewControl {
  let callback: IntersectionObserverCallback | null = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );

  const emit = (ratio = 1) =>
    act(() => {
      callback?.(
        [
          {
            intersectionRatio: ratio,
            isIntersecting: ratio > 0,
            // Shorter than the viewport, so the threshold is never capped and the ratio is taken at face value.
            boundingClientRect: { height: 300 } as DOMRectReadOnly,
            rootBounds: { height: 800 } as DOMRectReadOnly,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

  emit.away = () => emit(0.1);
  return emit;
}
