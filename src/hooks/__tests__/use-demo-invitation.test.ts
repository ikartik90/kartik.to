// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";
import { resetInputModality } from "../use-input-modality";
import { resetDemoInvitation, useDemoInvitation } from "../use-demo-invitation";

const mockPathname = vi.fn<() => string | null>(
  () => "/writing/shift-scheduling",
);
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

/** Answer `HAS_CURSOR_QUERY` the way the device in question would. */
function setHasCursor(hasCursor: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === HAS_CURSOR_QUERY ? hasCursor : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  resetInputModality();
  resetDemoInvitation();
  mockPathname.mockReturnValue("/writing/shift-scheduling");
  setHasCursor(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** Put a cursor on screen at a known place, the way a real visitor would. */
function movePointerTo(x: number, y: number) {
  // Twice: the first sighting only says where the pointer IS.
  fireEvent.pointerMove(document, { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(document, { clientX: x, clientY: y });
}

function setupStage() {
  const stage = document.createElement("div");
  document.body.appendChild(stage);
  return { current: stage } as const;
}

describe("useDemoInvitation", () => {
  it("opens at the visitor's own cursor when a demo finishes", () => {
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));
    const el = document.createElement("div");
    result.current.ref.current = el;

    expect(result.current.visible).toBe(false);
    act(() => result.current.offer());

    expect(result.current.visible).toBe(true);
    // CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } — it trails the cursor by it.
    expect(el.style.left).toBe("315px");
    expect(el.style.top).toBe("217px");
  });

  // The invitation is the page's, not the frame's: three demos in one article
  // make the offer once between them, on whichever finishes first.
  it("is offered once per page, whichever demo finishes first", () => {
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const first = renderHook(() => useDemoInvitation(stageRef));
    const second = renderHook(() => useDemoInvitation(stageRef));

    act(() => first.result.current.offer());
    act(() => second.result.current.offer());

    expect(first.result.current.visible).toBe(true);
    expect(second.result.current.visible).toBe(false);
  });

  // A cursor that has not been seen yet is no anchor — and no offer SPENT
  // either, so the demo that finishes after the visitor's pointer arrives still
  // gets to make it.
  it("declines when the cursor has not been seen, without spending the offer", () => {
    const stageRef = setupStage();
    const first = renderHook(() => useDemoInvitation(stageRef));

    act(() => first.result.current.offer());
    expect(first.result.current.visible).toBe(false);

    movePointerTo(80, 90);
    const second = renderHook(() => useDemoInvitation(stageRef));
    act(() => second.result.current.offer());

    expect(second.result.current.visible).toBe(true);
  });

  it("declines once the pointer has left the window", () => {
    movePointerTo(300, 200);
    fireEvent.pointerLeave(document.documentElement);
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));

    act(() => result.current.offer());

    expect(result.current.visible).toBe(false);
  });

  // A finger leaves no cursor behind, so there is no place on the page that is
  // where the visitor is looking. The offer docks instead — bottom centre,
  // placed by the stylesheet — rather than landing on whatever they last
  // tapped, which is where the tracked pointer position would have put it.
  it("docks the invitation on a device with no cursor", () => {
    setHasCursor(false);
    fireEvent.pointerDown(document, { clientX: 320, clientY: 40 });
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));
    const el = document.createElement("div");
    result.current.ref.current = el;

    act(() => result.current.offer());

    expect(result.current.visible).toBe(true);
    expect(result.current.docked).toBe(true);
    // No inline placement at all: an inline `left`/`top` outranks the rule
    // that centres it.
    expect(el.style.left).toBe("");
    expect(el.style.top).toBe("");
  });

  // Docked or not, it is the page's one offer, made once.
  it("spends the page's offer when it docks", () => {
    setHasCursor(false);
    const stageRef = setupStage();
    const first = renderHook(() => useDemoInvitation(stageRef));
    const second = renderHook(() => useDemoInvitation(stageRef));

    act(() => first.result.current.offer());
    act(() => second.result.current.offer());

    expect(first.result.current.visible).toBe(true);
    expect(second.result.current.visible).toBe(false);
  });

  // The docked box does not follow anything: a finger-scroll dispatches
  // `pointermove` like any other pointer, and the invitation must stay put.
  it("stays put while the visitor scrolls a touch device", () => {
    setHasCursor(false);
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));
    const el = document.createElement("div");
    result.current.ref.current = el;
    act(() => result.current.offer());

    act(() => {
      fireEvent.pointerMove(window, { clientX: 200, clientY: 500 });
    });

    expect(el.style.left).toBe("");
    expect(el.style.top).toBe("");
  });

  it("makes the offer again on a different page", () => {
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const first = renderHook(() => useDemoInvitation(stageRef));
    act(() => first.result.current.offer());
    expect(first.result.current.visible).toBe(true);

    mockPathname.mockReturnValue("/writing/something-else");
    const second = renderHook(() => useDemoInvitation(stageRef));
    act(() => second.result.current.offer());

    expect(second.result.current.visible).toBe(true);
  });

  // Rendered outside a router — a test harness, a storybook page — `usePathname`
  // answers null. "Which page am I on" being unanswerable must not read as "this
  // page has already had its invitation".
  it("still offers when there is no pathname to key on", () => {
    mockPathname.mockReturnValue(null);
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const first = renderHook(() => useDemoInvitation(stageRef));
    const second = renderHook(() => useDemoInvitation(stageRef));

    act(() => first.result.current.offer());
    act(() => second.result.current.offer());

    expect(first.result.current.visible).toBe(true);
    // ...and it is still only offered the once.
    expect(second.result.current.visible).toBe(false);
  });

  // Nobody needs to be told to try the thing they have just reached for.
  it("withdraws the moment the visitor reaches into the demo", () => {
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));
    act(() => result.current.offer());
    expect(result.current.visible).toBe(true);

    act(() => {
      fireEvent.pointerDown(stageRef.current, { clientX: 300, clientY: 200 });
    });

    expect(result.current.visible).toBe(false);
  });

  // A replay pressed while the invitation is still up performs with a stand-in
  // cursor that presses things. That is the show, not the visitor.
  it("stays up through a demo's own presses", () => {
    movePointerTo(300, 200);
    const stageRef = setupStage();
    const { result } = renderHook(() => useDemoInvitation(stageRef));
    act(() => result.current.offer());

    act(() => {
      stageRef.current.dispatchEvent(
        markSyntheticPointer(
          new MouseEvent("pointerdown", { bubbles: true, clientX: 1, clientY: 1 }),
        ),
      );
    });

    expect(result.current.visible).toBe(true);
  });
});
