// @vitest-environment jsdom
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { GridItem, type GridItemProps } from "../grid-item";

// ---------------------------------------------------------------------------
// The cell reserves the space the grid packs cards into, and the one thing it
// has to get right is that the space it reserves is the space the card
// actually takes. The shape is a FLOOR: a card whose content will not fit the
// shape at the width it landed at grows past it — which is the demo frame's
// own rule (it stops shrinking at its content's height plus padding) reaching
// the grid, and is the whole reason `--card-height` exists.
// ---------------------------------------------------------------------------

/** A stand-in ResizeObserver that hands every observed element to the callback. */
class StubResizeObserver {
  static callbacks = new Set<ResizeObserverCallback>();
  private targets = new Set<Element>();

  constructor(private callback: ResizeObserverCallback) {
    StubResizeObserver.callbacks.add(callback);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    StubResizeObserver.callbacks.delete(this.callback);
  }

  /** Re-run every live observer, as the browser would after a reflow. */
  static flush() {
    for (const callback of [...StubResizeObserver.callbacks]) {
      callback([], {} as ResizeObserver);
    }
  }
}

/** jsdom lays nothing out, so boxes are stated rather than measured. */
function stubRect({
  height = 0,
  left = 0,
  width = 0,
}: {
  height?: number;
  left?: number;
  width?: number;
}) {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      height,
      width,
      top: 0,
      left,
      right: left + width,
      bottom: height,
    }),
  });
}

const stubHeight = (height: number) => stubRect({ height });

const props: Omit<GridItemProps, "children"> = {
  aspect: "3/2",
  editing: false,
  pinned: false,
  canMoveBack: false,
  canMoveForward: false,
  onTogglePin: () => {},
  onMoveBack: () => {},
  onMoveForward: () => {},
  canAddColumn: false,
  canRemoveColumn: false,
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAspectChange: () => {},
  onInsertBefore: () => {},
  onInsertAfter: () => {},
  label: "A card",
};

function renderCell() {
  const { container } = render(
    <GridItem {...props}>
      <div>Card</div>
    </GridItem>,
  );
  return container.querySelector("[data-grid-cell]") as HTMLElement;
}

describe("GridItem", () => {
  const realObserver = global.ResizeObserver;

  beforeEach(() => {
    global.ResizeObserver =
      StubResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    cleanup();
    global.ResizeObserver = realObserver;
    StubResizeObserver.callbacks.clear();
  });

  it("publishes the height the card actually took as --card-height", () => {
    stubHeight(717);
    const cell = renderCell();
    expect(cell.style.getPropertyValue("--card-height")).toBe("717px");
  });

  // The span is a whole number of 1px rows, so a fraction has to round UP —
  // rounded down, the last row of the card is one the grid never reserved and
  // the next card packs into it.
  it("rounds a fractional height up to a whole reserved row", () => {
    stubHeight(233.328125);
    const cell = renderCell();
    expect(cell.style.getPropertyValue("--card-height")).toBe("234px");
  });

  it("republishes the height when the card is remeasured", () => {
    stubHeight(200);
    const cell = renderCell();
    expect(cell.style.getPropertyValue("--card-height")).toBe("200px");

    stubHeight(640);
    StubResizeObserver.flush();
    expect(cell.style.getPropertyValue("--card-height")).toBe("640px");
  });

  // A cell that has not been measured yet must say nothing rather than say
  // zero: `--card-height` is one half of a `max()` against the shape's own
  // height, and a literal `0px` published before the first layout is the
  // answer that would lose to it anyway — but a card measured AT zero (an
  // unmounted or display:none grid) publishing `0px` is how a real height
  // gets forgotten on the next remeasure.
  it("publishes nothing until the card has a height", () => {
    stubHeight(0);
    const cell = renderCell();
    expect(cell.style.getPropertyValue("--card-height")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Edit mode hangs an [+] in the gutter on BOTH sides of every card. Only the
// one the cursor is already next to is worth showing — the other is a second
// identical button in the corner of the eye. The cell publishes which side that
// is as `data-near-side`, which is what the stylesheet hides the far rail on.
// ---------------------------------------------------------------------------
describe("GridItem insertion rails", () => {
  const realObserver = global.ResizeObserver;

  beforeEach(() => {
    global.ResizeObserver =
      StubResizeObserver as unknown as typeof ResizeObserver;
    stubRect({ height: 200, left: 100, width: 200 });
  });

  afterEach(() => {
    cleanup();
    global.ResizeObserver = realObserver;
    StubResizeObserver.callbacks.clear();
  });

  function renderEditingCell() {
    const { container } = render(
      <GridItem {...props} editing>
        <div>Card</div>
      </GridItem>,
    );
    return container.querySelector("[data-grid-cell]") as HTMLElement;
  }

  it("names the gutter the cursor is nearest as the pointer moves", () => {
    const cell = renderEditingCell();

    fireEvent.pointerMove(cell, { clientX: 120 });
    expect(cell.dataset.nearSide).toBe("before");

    fireEvent.pointerMove(cell, { clientX: 280 });
    expect(cell.dataset.nearSide).toBe("after");
  });

  // With the pointer gone the card has no near side, and saying it still has
  // one would leave a card the cursor has left holding half its controls open
  // for a keyboard user who tabs into it next.
  it("forgets the near side when the pointer leaves", () => {
    const cell = renderEditingCell();

    fireEvent.pointerMove(cell, { clientX: 120 });
    fireEvent.pointerLeave(cell);
    expect(cell.dataset.nearSide).toBeUndefined();
  });

  // Both rails stay in the DOM: hiding the far one is the stylesheet's job, so
  // that a keyboard user — who has no cursor and so no near side — can still
  // reach either insertion point.
  it("keeps both insertion points mounted", () => {
    renderEditingCell();
    expect(screen.getByRole("button", { name: "Add before A card" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add after A card" })).toBeTruthy();
  });

  it("tracks nothing when the grid is not being edited", () => {
    stubRect({ height: 200, left: 100, width: 200 });
    const { container } = render(
      <GridItem {...props}>
        <div>Card</div>
      </GridItem>,
    );
    const cell = container.querySelector("[data-grid-cell]") as HTMLElement;
    fireEvent.pointerMove(cell, { clientX: 120 });
    expect(cell.dataset.nearSide).toBeUndefined();
  });
});
