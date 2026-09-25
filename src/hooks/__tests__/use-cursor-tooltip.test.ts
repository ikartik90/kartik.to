// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
import { useCursorTooltip } from "../use-cursor-tooltip";

describe("useCursorTooltip", () => {
  beforeEach(() => {
    // Synchronous rAF, so a reposition is observable without waiting a frame.
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
      window.dispatchEvent(
        markSyntheticPointer(
          new MouseEvent("pointermove", { clientX: 900, clientY: 20 }),
        ),
      );
    });

    expect(el.style.left).toBe("115px");
    expect(el.style.top).toBe("217px");

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

  it("treats a docked panel's column as taken", () => {
    const el = document.createElement("div");
    // jsdom lays nothing out, so the label's width has to be stated.
    Object.defineProperty(el, "offsetWidth", { value: 73, configurable: true });
    document.body.setAttribute("data-properties-panel", "");
    document.body.style.paddingInlineEnd = "332px";

    const { result } = renderHook(() => useCursorTooltip(false));
    result.current.ref.current = el;

    act(() => result.current.seed(650, 200));

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

    expect(el.style.left).not.toBe("515px");
  });
});

describe("useCursorTooltip anchored to an element", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  function anchorAt(rect: { left: number; width: number; bottom: number }) {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ ...rect, right: rect.left + rect.width, top: rect.bottom - 40 }) as DOMRect;
    return el;
  }

  function tooltipOfWidth(width: number) {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
    return el;
  }

  it("seedAnchor hangs it centred under the element", () => {
    const el = tooltipOfWidth(60);
    const anchor = anchorAt({ left: 400, width: 100, bottom: 300 });

    const { result } = renderHook(() => useCursorTooltip(false, false, anchor));
    result.current.ref.current = el;

    act(() => result.current.seedAnchor(anchor));

    expect(el.style.left).toBe("420px");
    expect(el.style.top).toBe("302px");
  });

  it("does not follow the pointer while it is anchored", () => {
    const el = tooltipOfWidth(60);
    const anchor = anchorAt({ left: 400, width: 100, bottom: 300 });

    const { result } = renderHook(() => useCursorTooltip(true, false, anchor));
    result.current.ref.current = el;
    act(() => result.current.seedAnchor(anchor));

    act(() => {
      fireEvent.pointerMove(window, { clientX: 700, clientY: 800 });
    });

    expect(el.style.left).toBe("420px");
    expect(el.style.top).toBe("302px");
  });

  it("follows the anchor when the page scrolls under it", () => {
    const el = tooltipOfWidth(60);
    let bottom = 300;
    const anchor = document.createElement("div");
    anchor.getBoundingClientRect = () =>
      ({ left: 400, width: 100, bottom, right: 500, top: bottom - 40 }) as DOMRect;

    const { result } = renderHook(() => useCursorTooltip(true, false, anchor));
    result.current.ref.current = el;
    act(() => result.current.seedAnchor(anchor));

    bottom = 120;
    act(() => {
      fireEvent.scroll(window);
    });

    expect(el.style.top).toBe("122px");
  });

  it("goes back to the cursor when the anchor is taken away", () => {
    const el = tooltipOfWidth(60);
    const anchor = anchorAt({ left: 400, width: 100, bottom: 300 });

    const { result, rerender } = renderHook(
      ({ anchor }: { anchor: HTMLElement | null }) =>
        useCursorTooltip(true, false, anchor),
      { initialProps: { anchor: anchor as HTMLElement | null } },
    );
    result.current.ref.current = el;

    rerender({ anchor: null });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 300, clientY: 400 });
    });

    expect(el.style.left).toBe("315px");
    expect(el.style.top).toBe("417px");
  });

  it("keeps the pointer current while anchored, so it can go back to it", () => {
    const el = tooltipOfWidth(60);
    const anchor = anchorAt({ left: 400, width: 100, bottom: 300 });

    const { result, rerender } = renderHook(
      ({ anchor }: { anchor: HTMLElement | null }) =>
        useCursorTooltip(true, false, anchor),
      { initialProps: { anchor: anchor as HTMLElement | null } },
    );
    result.current.ref.current = el;
    act(() => result.current.seedAnchor(anchor));

    act(() => {
      fireEvent.pointerMove(window, { clientX: 500, clientY: 600 });
    });
    expect(el.style.left).toBe("420px");

    rerender({ anchor: null });

    expect(el.style.left).toBe("515px");
    expect(el.style.top).toBe("617px");
  });

  it("seed takes the anchor off, for a move onto an unanchored trigger", () => {
    const el = tooltipOfWidth(60);
    const anchor = anchorAt({ left: 400, width: 100, bottom: 300 });

    const { result } = renderHook(() => useCursorTooltip(true, false, anchor));
    result.current.ref.current = el;
    act(() => result.current.seedAnchor(anchor));
    act(() => result.current.seed(100, 200));

    expect(el.style.left).toBe("115px");
    expect(el.style.top).toBe("217px");
  });
});
