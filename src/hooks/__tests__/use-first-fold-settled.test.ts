// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { holdFirstFold } from "@/utils/first-fold";
import { useFirstFoldSettled } from "../use-first-fold-settled";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useFirstFoldSettled", () => {
  it("turns true once the page has loaded and gone idle and nothing holds the first fold", () => {
    const idle: IdleRequestCallback[] = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => idle.push(callback));
    vi.stubGlobal("cancelIdleCallback", () => undefined);
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    const release = holdFirstFold(10_000);

    const { result } = renderHook(() => useFirstFoldSettled());
    expect(result.current).toBe(false);
    act(() => idle.splice(0).forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 })));
    expect(result.current).toBe(false);

    act(release);
    expect(result.current).toBe(true);
  });
});
