// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inViewThreshold, useInView } from "../use-in-view";

// jsdom ships no IntersectionObserver, so the stub IS the test harness: it
// captures the callback and lets a case hand the hook any (ratio, element
// height, viewport height) triple it wants to reason about.
type Emit = (
  ratio: number,
  boxes?: { elementHeight?: number; rootHeight?: number },
) => void;

function mockIntersectionObserver(): {
  emit: Emit;
  observed: () => Element[];
  disconnected: () => number;
} {
  let callback: IntersectionObserverCallback | null = null;
  const observed: Element[] = [];
  let disconnects = 0;

  class MockObserver {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }
    observe(el: Element) {
      observed.push(el);
    }
    unobserve() {}
    disconnect() {
      disconnects += 1;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", MockObserver);

  return {
    emit: (ratio, { elementHeight = 400, rootHeight = 800 } = {}) =>
      act(() => {
        callback?.(
          [
            {
              intersectionRatio: ratio,
              isIntersecting: ratio > 0,
              boundingClientRect: { height: elementHeight } as DOMRectReadOnly,
              rootBounds: { height: rootHeight } as DOMRectReadOnly,
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        );
      }),
    observed: () => observed,
    disconnected: () => disconnects,
  };
}

function stage() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return { current: el };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("inViewThreshold", () => {
  it("asks for the full amount when the element fits the viewport", () => {
    expect(inViewThreshold(0.7, 400, 800)).toBe(0.7);
  });

  it("never asks for more of the element than can ever be on screen", () => {
    // 1600px tall in an 800px viewport: at most half of it is ever visible, so
    // a flat 0.7 would never fire. 0.5 × 0.9 leaves a little slack.
    expect(inViewThreshold(0.7, 1600, 800)).toBeCloseTo(0.45);
  });

  it("falls back to the amount when a box is missing", () => {
    expect(inViewThreshold(0.7, 0, 800)).toBe(0.7);
    expect(inViewThreshold(0.7, 400, 0)).toBe(0.7);
  });
});

describe("useInView", () => {
  it("stays false below the amount", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.5);
    expect(result.current).toBe(false);
  });

  it("flips true once the amount is on screen", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.7);
    expect(result.current).toBe(true);
  });

  it("closes again once the element has properly left", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.75);
    observer.emit(0);
    expect(result.current).toBe(false);
  });

  // The two lines are far apart on purpose: one threshold would chatter for any
  // scroll position parked on it, and what this gates is a performance.
  it("holds its answer between the two lines, in both directions", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    // Coming up from nothing, half on screen is not yet enough.
    observer.emit(0.5);
    expect(result.current).toBe(false);

    observer.emit(0.8);
    expect(result.current).toBe(true);

    // ...and going back down, half on screen is still plenty.
    observer.emit(0.5);
    expect(result.current).toBe(true);

    observer.emit(0.25);
    expect(result.current).toBe(false);
  });

  it("keeps watching, so it can open a second time", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.8);
    observer.emit(0);
    observer.emit(0.8);
    expect(result.current).toBe(true);
  });

  // A 1600px block in an 800px viewport can never show more than half of
  // itself, so the ask is capped at 45% — and a fixed 30% exit would then sit
  // dangerously close to it. Scaled, it lands at 45% × 3/7 ≈ 19%.
  it("scales the exit line with an entry line that had to be capped", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const tall = { elementHeight: 1600, rootHeight: 800 };
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.45, tall);
    expect(result.current).toBe(true);

    observer.emit(0.25, tall);
    expect(result.current).toBe(true);

    observer.emit(0.15, tall);
    expect(result.current).toBe(false);
  });

  it("fires for a tall element at the most of it that can be shown", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    // 45% of a 1600px block fills 90% of an 800px viewport — as good as it gets.
    observer.emit(0.45, { elementHeight: 1600, rootHeight: 800 });
    expect(result.current).toBe(true);
  });

  it("never fires where there is no observer to fire it", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));
    expect(result.current).toBe(false);
  });
});
