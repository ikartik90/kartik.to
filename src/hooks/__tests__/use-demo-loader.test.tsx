// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDemoLoader, useTrickleProgress } from "../use-demo-loader";
import { __resetDemoAssetCache } from "@/utils/demo-assets";
import type { DemoComponentEntry } from "@/components/demo/registry";

beforeEach(() => {
  __resetDemoAssetCache();
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
});

function makeEntry(overrides: Partial<DemoComponentEntry> = {}): DemoComponentEntry {
  const Loaded = () => null;
  return {
    id: "demo",
    label: "Demo",
    load: vi.fn(async () => Loaded),
    ...overrides,
  };
}

describe("useDemoLoader", () => {
  it("loads the component and becomes ready after the page has loaded", async () => {
    const entry = makeEntry();
    const { result } = renderHook(() => useDemoLoader(entry));

    expect(result.current.ready).toBe(false);

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(entry.load).toHaveBeenCalledOnce();
    expect(result.current.Component).toBeTypeOf("function");
    expect(result.current.fraction).toBe(1);
  });

  it("waits for the page load event before loading", async () => {
    const readyState = vi
      .spyOn(document, "readyState", "get")
      .mockReturnValue("loading");
    const entry = makeEntry();
    renderHook(() => useDemoLoader(entry));

    // Not loaded yet — the effect is gated on page load.
    await Promise.resolve();
    expect(entry.load).not.toHaveBeenCalled();

    act(() => {
      readyState.mockReturnValue("complete");
      window.dispatchEvent(new Event("load"));
    });
    await waitFor(() => expect(entry.load).toHaveBeenCalledOnce());
  });

  it("reuses an already-loaded demo synchronously without reloading", async () => {
    const entry = makeEntry();
    const first = renderHook(() => useDemoLoader(entry));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    expect(entry.load).toHaveBeenCalledOnce();
    first.unmount();

    // A fresh instance of the same demo id is ready on the first render — no
    // loader (ready is true immediately) and no second load.
    const second = renderHook(() => useDemoLoader(entry));
    expect(second.result.current.ready).toBe(true);
    expect(second.result.current.Component).toBeTypeOf("function");
    expect(entry.load).toHaveBeenCalledOnce();
  });

  // Swapping the demo a LIVE instance is showing — what the editor's Replace
  // does to a component block. React reads a function handed to a state setter
  // as an updater, so parking a component in state has to go through
  // `setState(() => Component)`; passing it bare CALLS it, running its hooks
  // inside the state update ("Do not call Hooks inside useEffect(…)…") and
  // storing whatever it returned in place of the component.
  it("swaps to an already-loaded demo without calling it", async () => {
    const Second = vi.fn(() => null);
    const first = makeEntry({ id: "swap-a" });
    const second = makeEntry({ id: "swap-b", load: vi.fn(async () => Second) });

    // Warm the module cache for the demo being swapped IN — the case the
    // editor is always in, since the picker previews it before you commit.
    const warm = renderHook(() => useDemoLoader(second));
    await waitFor(() => expect(warm.result.current.ready).toBe(true));
    warm.unmount();
    Second.mockClear();

    const { result, rerender } = renderHook(
      (entry: DemoComponentEntry) => useDemoLoader(entry),
      { initialProps: first },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));

    rerender(second);

    expect(result.current.Component).toBe(Second);
    expect(Second).not.toHaveBeenCalled();
  });
});

describe("useTrickleProgress", () => {
  it("stays at zero while inactive", () => {
    const { result } = renderHook(() => useTrickleProgress(false));
    expect(result.current).toBe(0);
  });

  it("ramps up while active but never reaches 1", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTrickleProgress(true));
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current).toBeGreaterThan(0);
      expect(result.current).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
