// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inViewThreshold, useInView } from "../use-in-view";

// jsdom has no IntersectionObserver; the stub captures the callback so a case can emit any entry.
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

  it("holds its answer between the two lines, in both directions", () => {
    const observer = mockIntersectionObserver();
    const ref = stage();
    const { result } = renderHook(() => useInView(ref));

    observer.emit(0.5);
    expect(result.current).toBe(false);

    observer.emit(0.8);
    expect(result.current).toBe(true);

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
