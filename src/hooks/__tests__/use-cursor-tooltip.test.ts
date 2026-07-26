// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCursorTooltip } from "../use-cursor-tooltip";

// CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } — the tooltip trails the cursor by it.

describe("useCursorTooltip", () => {
  beforeEach(() => {
    // Run rAF callbacks synchronously so a pointermove's reposition is
    // observable without waiting a frame.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("seed writes the offset position onto the element", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useCursorTooltip(false));
    result.current.ref.current = el;

    act(() => result.current.seed(100, 200));

    expect(el.style.left).toBe("115px");
    expect(el.style.top).toBe("217px");
  });

  it("tracks the pointer while visible", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useCursorTooltip(true));
    result.current.ref.current = el;

    act(() => {
      fireEvent.pointerMove(window, { clientX: 300, clientY: 400 });
    });

    expect(el.style.left).toBe("315px");
    expect(el.style.top).toBe("417px");
  });

  it("does not track the pointer while hidden", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useCursorTooltip(false));
    result.current.ref.current = el;

    act(() => {
      fireEvent.pointerMove(window, { clientX: 300, clientY: 400 });
    });

    expect(el.style.left).toBe("");
    expect(el.style.top).toBe("");
  });

  it("stops tracking after it becomes hidden", () => {
    const el = document.createElement("div");
    const { result, rerender } = renderHook(
      ({ visible }) => useCursorTooltip(visible),
      { initialProps: { visible: true } },
    );
    result.current.ref.current = el;

    rerender({ visible: false });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 500, clientY: 600 });
    });

    // Never repositioned to the post-hide coordinates.
    expect(el.style.left).not.toBe("515px");
  });
});
