// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLoadedAndIdle } from "../use-loaded-and-idle";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useLoadedAndIdle", () => {
  it("turns true only once the page has loaded and the browser has then gone idle, and stays so", () => {
    const idle: IdleRequestCallback[] = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => idle.push(callback));
    vi.stubGlobal("cancelIdleCallback", () => undefined);
    const readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const goIdle = () =>
      act(() => idle.splice(0).forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 })));

    const { result, rerender } = renderHook(() => useLoadedAndIdle());
    goIdle();
    expect(result.current).toBe(false);

    act(() => {
      readyState.mockReturnValue("complete");
      window.dispatchEvent(new Event("load"));
    });
    expect(result.current).toBe(false);

    goIdle();
    expect(result.current).toBe(true);
    rerender();
    expect(result.current).toBe(true);
  });
});
