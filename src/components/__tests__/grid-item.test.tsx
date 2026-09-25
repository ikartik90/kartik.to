// @vitest-environment jsdom
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { GridItem, type GridItemProps } from "../grid-item";

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

  it("publishes nothing until the card has a height", () => {
    stubHeight(0);
    const cell = renderCell();
    expect(cell.style.getPropertyValue("--card-height")).toBe("");
  });
});

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

  it("forgets the near side when the pointer leaves", () => {
    const cell = renderEditingCell();

    fireEvent.pointerMove(cell, { clientX: 120 });
    fireEvent.pointerLeave(cell);
    expect(cell.dataset.nearSide).toBeUndefined();
  });

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
