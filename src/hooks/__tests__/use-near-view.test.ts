// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNearView } from "../use-near-view";

// jsdom has no IntersectionObserver; the stub captures the callback and options so a case can drive them.
function mockIntersectionObserver() {
  let callback: IntersectionObserverCallback | null = null;
  let options: IntersectionObserverInit | undefined;
  let disconnects = 0;

  class MockObserver {
    constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
      callback = cb;
      options = init;
    }
    observe() {}
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
    emit: (isIntersecting: boolean) =>
      act(() => {
        callback?.(
          [{ isIntersecting } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }),
    options: () => options,
    disconnects: () => disconnects,
  };
}

const element = () => ({ current: document.createElement("div") });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useNearView", () => {
  it("is false until the element comes near the screen", () => {
    const io = mockIntersectionObserver();
    const { result } = renderHook(() => useNearView(element()));
    expect(result.current).toBe(false);

    io.emit(false);
    expect(result.current).toBe(false);

    io.emit(true);
    expect(result.current).toBe(true);
  });

  it("stays true once the element has come near", () => {
    const io = mockIntersectionObserver();
    const { result } = renderHook(() => useNearView(element()));
    io.emit(true);
    io.emit(false);
    expect(result.current).toBe(true);
  });

  it("stops watching once the element has come near", () => {
    const io = mockIntersectionObserver();
    renderHook(() => useNearView(element()));
    io.emit(true);
    expect(io.disconnects()).toBeGreaterThan(0);
  });

  it("counts an element a screen's height away as near", () => {
    const io = mockIntersectionObserver();
    renderHook(() => useNearView(element()));
    expect(io.options()?.rootMargin).toBe("100% 0px");
  });

  it("measures the distance inside the box the element scrolls in", () => {
    const io = mockIntersectionObserver();
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const ref = { current: document.createElement("div") };
    scroller.append(document.createElement("section"));
    scroller.firstElementChild!.append(ref.current);
    document.body.append(scroller);

    renderHook(() => useNearView(ref));
    expect(io.options()?.root).toBe(scroller);
    scroller.remove();
  });

  it("measures against the screen when nothing around the element scrolls", () => {
    const io = mockIntersectionObserver();
    renderHook(() => useNearView(element()));
    expect(io.options()?.root).toBeNull();
  });

  it("is true at once where nothing can watch the screen", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useNearView(element()));
    expect(result.current).toBe(true);
  });
});
