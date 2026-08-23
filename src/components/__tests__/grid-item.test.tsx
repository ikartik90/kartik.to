// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
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

/** jsdom lays nothing out, so heights are stated rather than measured. */
function stubHeight(height: number) {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ height, width: 0, top: 0, left: 0, right: 0, bottom: 0 }),
  });
}

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
  propertiesOpen: false,
  onToggleProperties: () => {},
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
