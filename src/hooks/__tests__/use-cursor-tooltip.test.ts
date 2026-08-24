// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
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
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.removeAttribute("data-properties-panel");
    document.body.style.paddingInlineEnd = "";
  });

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

  it("ignores the moves a self-playing demo dispatches", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useCursorTooltip(true));
    result.current.ref.current = el;

    act(() => result.current.seed(100, 200));
    act(() => {
      // The demo's stand-in cursor sweeping across its own stage. This tooltip
      // is labelling whatever the REAL pointer is resting on — the Replay
      // control that started the walkthrough — so it must not follow.
      window.dispatchEvent(
        markSyntheticPointer(
          new MouseEvent("pointermove", { clientX: 900, clientY: 20 }),
        ),
      );
    });

    expect(el.style.left).toBe("115px");
    expect(el.style.top).toBe("217px");

    // Still listening, though: the visitor's own pointer moves it as ever.
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

  // The page reserves a docked panel's column as `padding-inline-end` on the
  // body (globals.css, keyed off `data-properties-panel`), which is the app's
  // one answer to how much of the right edge is already spoken for. The
  // positioner has to read it, or a label near the panel is placed on screen
  // and painted underneath it — which is what the cover playground's theme
  // toggle did.
  it("treats a docked panel's column as taken", () => {
    const el = document.createElement("div");
    // jsdom lays nothing out, so the label's width has to be stated.
    Object.defineProperty(el, "offsetWidth", { value: 73, configurable: true });
    document.body.setAttribute("data-properties-panel", "");
    document.body.style.paddingInlineEnd = "332px";

    const { result } = renderHook(() => useCursorTooltip(false));
    result.current.ref.current = el;

    // window.innerWidth is 1024 in jsdom, so the usable edge is 692 and the
    // label may start no further right than 692 - 4 - 73. Anchored at 915 it
    // slides back to exactly that, and drops the 2px a shifted label drops.
    act(() => result.current.seed(900, 200));

    expect(el.style.left).toBe("615px");
    expect(el.style.top).toBe("219px");
  });

  it("takes the whole viewport back when no panel is docked", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetWidth", { value: 73, configurable: true });

    const { result } = renderHook(() => useCursorTooltip(false));
    result.current.ref.current = el;

    act(() => result.current.seed(900, 200));

    expect(el.style.left).toBe("915px");
    // Never shifted, so never dropped either.
    expect(el.style.top).toBe("217px");
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
