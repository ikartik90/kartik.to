// @vitest-environment jsdom
import { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSheetDrag } from "../use-sheet-drag";

const SHEET_HEIGHT = 400;

/**
 * A clock the gesture is timed against, so "slow drag" and "flick" are stated
 * by the test rather than left to how fast the events happen to be dispatched.
 * jsdom stamps them microseconds apart, which reads as a flick every time.
 */
let clock = 0;
const elapse = (ms: number) => {
  clock += ms;
};

/** A sheet with a grabbable header, reporting how far it has been dragged. */
function Sheet({
  onDismiss,
  enabled = () => true,
}: {
  onDismiss: () => void;
  enabled?: () => boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { offset, dragHandlers } = useSheetDrag({
    sheetRef,
    onDismiss,
    enabled,
    now: () => clock,
  });
  return (
    <div
      ref={(node) => {
        sheetRef.current = node;
        if (node) {
          Object.defineProperty(node, "offsetHeight", {
            value: SHEET_HEIGHT,
            configurable: true,
          });
        }
      }}
      data-testid="sheet"
      data-offset={offset ?? "none"}
    >
      <header data-testid="grip" {...dragHandlers}>
        Properties
      </header>
    </div>
  );
}

const grip = () => screen.getByTestId("grip");
const offset = () => screen.getByTestId("sheet").getAttribute("data-offset");

// `pointerId` on every one of them, as a real pointer carries: the hook follows
// ONE finger, and a second landing mid-drag must not steer the sheet.
const grab = (y: number) =>
  fireEvent.pointerDown(grip(), { clientY: y, pointerId: 1 });
const dragTo = (y: number) =>
  fireEvent.pointerMove(grip(), { clientY: y, pointerId: 1 });
const release = (y: number) =>
  fireEvent.pointerUp(grip(), { clientY: y, pointerId: 1 });

describe("useSheetDrag", () => {
  beforeEach(() => {
    clock = 0;
  });
  afterEach(cleanup);

  it("follows the finger down the screen", () => {
    render(<Sheet onDismiss={vi.fn()} />);

    grab(100);
    dragTo(160);

    expect(offset()).toBe("60");
  });

  it("holds still against a drag upwards", () => {
    render(<Sheet onDismiss={vi.fn()} />);

    grab(100);
    dragTo(40);

    expect(offset()).toBe("0");
  });

  it("ignores movement that no press started", () => {
    render(<Sheet onDismiss={vi.fn()} />);

    dragTo(300);

    expect(offset()).toBe("none");
  });

  it("dismisses when the finger lets go past the threshold", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);

    grab(100);
    elapse(400);
    dragTo(100 + SHEET_HEIGHT / 2);
    release(100 + SHEET_HEIGHT / 2);

    expect(onDismiss).toHaveBeenCalledOnce();
    // The sheet stops carrying an offset of its own: where it goes now is the
    // dismissed state's business, and a stale inline transform would outrank it.
    expect(offset()).toBe("none");
  });

  it("puts the sheet back when the drag was too short", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);

    grab(100);
    elapse(200);
    dragTo(120);
    release(120);

    expect(onDismiss).not.toHaveBeenCalled();
    expect(offset()).toBe("none");
  });

  it("takes a flick as the same instruction, however short", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);

    // 40px in 10ms — a thumb throwing the sheet away rather than placing it.
    grab(100);
    elapse(10);
    dragTo(140);
    release(140);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("puts the sheet back when the gesture is cancelled", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);

    grab(100);
    dragTo(400);
    fireEvent.pointerCancel(grip());

    expect(onDismiss).not.toHaveBeenCalled();
    expect(offset()).toBe("none");
  });

  it("does not start where the sheet is not a sheet", () => {
    // Landscape, or a desktop: the panel is docked to the side and dragging its
    // header must do nothing at all.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} enabled={() => false} />);

    grab(100);
    dragTo(400);
    release(400);

    expect(offset()).toBe("none");
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe("useSheetDrag — text selection during the gesture", () => {
  const dragging = () =>
    document.documentElement.hasAttribute("data-control-dragging");

  beforeEach(() => {
    clock = 0;
  });
  afterEach(cleanup);

  it("suspends selection for the length of the drag", () => {
    // The grip IS the header, and the header is a line of text: without this a
    // downward pull anchors an iOS selection on the panel's own title.
    render(<Sheet onDismiss={vi.fn()} />);
    expect(dragging()).toBe(false);
    grab(100);
    expect(dragging()).toBe(true);
    dragTo(160);
    expect(dragging()).toBe(true);
    release(160);
    expect(dragging()).toBe(false);
  });

  it("hands it back when the gesture is cancelled", () => {
    render(<Sheet onDismiss={vi.fn()} />);
    grab(100);
    expect(dragging()).toBe(true);
    fireEvent.pointerCancel(grip(), { pointerId: 1 });
    expect(dragging()).toBe(false);
  });

  it("hands it back when the sheet unmounts mid-drag", () => {
    // A drag past the threshold dismisses the panel, which is exactly the
    // gesture that unmounts the grip before any release arrives.
    const { unmount } = render(<Sheet onDismiss={vi.fn()} />);
    grab(100);
    expect(dragging()).toBe(true);
    unmount();
    expect(dragging()).toBe(false);
  });

  it("takes nothing where the sheet is not a sheet", () => {
    // A docked rail's header is dragged by nobody, and must leave the page's
    // selection exactly as it found it.
    render(<Sheet onDismiss={vi.fn()} enabled={() => false} />);
    grab(100);
    expect(dragging()).toBe(false);
  });
});
