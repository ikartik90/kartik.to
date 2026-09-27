// @vitest-environment jsdom
import { useRef, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveItem } from "@/utils/collection-items";
import { BlockReorder } from "../block-reorder";

// jsdom lays nothing out, so the geometry is stated: blocks 100px tall and 20px apart in a column
// running from x 100 to 740, the first at the article's top.
const LEFT = 100;
const WIDTH = 640;
const HEIGHT = 100;
const GAP = 20;
const topOf = (index: number) => index * (HEIGHT + GAP);

const blocks = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-block]"));

function box(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => "",
  } as DOMRect;
}

const originalGetComputedStyle = window.getComputedStyle;

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.matches("article")) return box(0, 0, 1000, 1000);
    const block = this.closest("[data-block]");
    const index = block ? blocks().indexOf(block as HTMLElement) : -1;
    return index < 0 ? box(0, 0, 0, 0) : box(LEFT, topOf(index), WIDTH, HEIGHT);
  };
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = originalGetComputedStyle(element, pseudo);
    if (!element.matches("article")) return style;
    return new Proxy(style, {
      get: (target, key) =>
        key === "rowGap" ? `${GAP}px` : Reflect.get(target, key, target),
    });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(ids: string[], lastSlot?: number) {
  const onMove = vi.fn();
  function Harness() {
    const [order, setOrder] = useState(ids);
    const refs = useRef<(HTMLElement | null)[]>([]);
    return (
      <article>
        {order.map((id, index) => (
          <p
            key={index}
            data-block=""
            tabIndex={0}
            ref={(element) => {
              refs.current[index] = element;
            }}
          >
            {id}
          </p>
        ))}
        <BlockReorder
          blocks={() => refs.current.slice(0, order.length)}
          lastSlot={lastSlot ?? order.length}
          onMove={(from, to) => {
            onMove(from, to);
            setOrder((was) => moveItem(was, from, to));
          }}
        />
      </article>
    );
  }
  render(<Harness />);
  return onMove;
}

// jsdom has no PointerEvent, so a MouseEvent carries the pointer fields. Moves and releases go to
// the handle, as pointer capture would send them.
function pointer(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: Element | Document,
  clientX: number,
  clientY: number,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    clientY,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  fireEvent(target, event);
  return event;
}

const handles = () =>
  screen.queryAllByRole("button", { name: "Reorder block" });
const line = () => document.querySelector<HTMLElement>("[data-drop-line]");
const hover = (index: number) =>
  pointer("pointermove", document, LEFT + 20, topOf(index) + HEIGHT / 2);

/** Presses block `index`'s handle and carries it to `y`. */
function carry(index: number, y: number) {
  hover(index);
  const handle = handles()[0];
  pointer("pointerdown", handle, LEFT - 20, topOf(index) + 10);
  pointer("pointermove", handle, LEFT - 20, y);
  return handle;
}

describe("BlockReorder", () => {
  it("shows no handle while no block is hovered or focused", () => {
    setup(["a", "b", "c"]);
    expect(handles()).toHaveLength(0);
  });

  it("shows the hovered block's handle, level with the block's top-left", () => {
    setup(["a", "b", "c"]);
    hover(1);
    const [handle] = handles();
    expect(handle.style.top).toBe(`${topOf(1)}px`);
    expect(handle.style.left).toBe(`${LEFT}px`);
  });

  it("levels a carousel's handle with its slides, below the room kept for their toolbars", () => {
    setup(["a", "b", "c"]);
    blocks()[1].innerHTML =
      '<div data-carousel-scroller><div style="padding-top: 20px"></div></div>';
    hover(1);
    const [handle] = handles();
    expect(handle.style.top).toBe(`${topOf(1) + 20}px`);
    expect(handle.style.left).toBe(`${LEFT}px`);
  });

  it("keeps the handle while the pointer crosses the gap to it", () => {
    setup(["a", "b", "c"]);
    hover(1);
    pointer("pointermove", document, LEFT - 30, topOf(1) + 10);
    expect(handles()).toHaveLength(1);
  });

  it("hides it once the pointer leaves the block", () => {
    setup(["a", "b", "c"]);
    hover(1);
    pointer("pointermove", document, LEFT + WIDTH + 50, topOf(1) + 10);
    expect(handles()).toHaveLength(0);
  });

  it("shows the focused block's handle", () => {
    setup(["a", "b", "c"]);
    act(() => blocks()[2].focus());
    const [handle] = handles();
    expect(handle.style.top).toBe(`${topOf(2)}px`);
  });

  it("shows both when one block is hovered and another focused", () => {
    setup(["a", "b", "c"]);
    act(() => blocks()[2].focus());
    hover(0);
    expect(handles()).toHaveLength(2);
  });

  it("keeps the caret where it is when the handle is pressed", () => {
    setup(["a", "b", "c"]);
    hover(1);
    const event = pointer("pointerdown", handles()[0], LEFT - 20, topOf(1));
    expect(event.defaultPrevented).toBe(true);
  });

  it("moves a block to where it is dropped", () => {
    const onMove = setup(["a", "b", "c"]);
    const handle = carry(0, topOf(2) + 10);
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 10);

    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(blocks().map((block) => block.textContent)).toEqual(["b", "a", "c"]);
  });

  it("draws a line in the gap the block will drop into, as wide as the block", () => {
    setup(["a", "b", "c"]);
    carry(0, topOf(2) + 10);
    expect(line()?.style.top).toBe(`${topOf(2) - GAP / 2}px`);
    expect(line()?.style.left).toBe(`${LEFT}px`);
    expect(line()?.style.width).toBe(`${WIDTH}px`);
  });

  it("dims the carried block until it is dropped", () => {
    setup(["a", "b", "c"]);
    const handle = carry(0, topOf(2) + 10);
    expect(blocks()[0].hasAttribute("data-reorder-source")).toBe(true);
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 10);
    expect(document.querySelector("[data-reorder-source]")).toBeNull();
  });

  it("shows only the carried block's handle while it is carried", () => {
    setup(["a", "b", "c"]);
    act(() => blocks()[2].focus());
    carry(0, topOf(1) + 80);
    expect(handles()).toHaveLength(1);
    expect(handles()[0].style.top).toBe(`${topOf(0)}px`);
  });

  it("draws no line and moves nothing over the block's own place", () => {
    const onMove = setup(["a", "b", "c"]);
    const handle = carry(1, topOf(1) + 60);
    expect(line()).toBeNull();
    pointer("pointerup", handle, LEFT - 20, topOf(1) + 60);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves nothing on a press that doesn't travel", () => {
    const onMove = setup(["a", "b", "c"]);
    hover(0);
    const handle = handles()[0];
    pointer("pointerdown", handle, LEFT - 20, topOf(0) + 10);
    pointer("pointerup", handle, LEFT - 20, topOf(0) + 10);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("shows the handle of the block under the pointer once the dropped block lands", async () => {
    setup(["a", "b", "c"]);
    const handle = carry(0, topOf(2) + 10);
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 10);
    await act(async () => {});

    expect(handles().map((each) => each.style.top)).toEqual([`${topOf(2)}px`]);
  });

  it("shows the handle of the block under the pointer after a cancel", () => {
    setup(["a", "b", "c"]);
    carry(0, topOf(2) + 10);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(handles().map((each) => each.style.top)).toEqual([`${topOf(2)}px`]);
  });

  it("puts the block back on Escape", () => {
    const onMove = setup(["a", "b", "c"]);
    const handle = carry(0, topOf(2) + 80);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(line()).toBeNull();
    expect(document.querySelector("[data-reorder-source]")).toBeNull();
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 80);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("drops no further down than the last slot it is given", () => {
    const onMove = setup(["a", "b", "c"], 2);
    const handle = carry(0, topOf(2) + 90);
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 90);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });
});
