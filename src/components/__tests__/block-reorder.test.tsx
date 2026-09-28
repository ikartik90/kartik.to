// @vitest-environment jsdom
import { useRef, useState, type ReactNode } from "react";
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
// running from x 100 to 740, the first at the article's top. Anything in a block shares its box,
// but for a `data-height` of its own.
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
    const height = Number((this as HTMLElement).dataset.height) || HEIGHT;
    return index < 0 ? box(0, 0, 0, 0) : box(LEFT, topOf(index), WIDTH, height);
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

function setup(ids: string[], lastSlot?: number, onPress = vi.fn()) {
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
          onPress={onPress}
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

  describe("beside a text block", () => {
    // jsdom's ranges have no rects: a character's line box is the `data-line-top` of its element, 20px tall.
    beforeEach(() => {
      Object.defineProperty(Range.prototype, "getClientRects", {
        configurable: true,
        value(this: Range) {
          const element = this.startContainer.parentElement!;
          return [box(LEFT, topOf(1) + Number(element.dataset.lineTop), 8, 20)];
        },
      });
    });
    afterEach(() => {
      delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    });

    /** Block 1 is `second`, drawn with a ref for the block's own element. */
    function setupSecond(
      second: (ref: (element: HTMLElement | null) => void) => ReactNode,
    ) {
      function Harness() {
        const refs = useRef<(HTMLElement | null)[]>([]);
        return (
          <article>
            <p
              data-block=""
              ref={(element) => {
                refs.current[0] = element;
              }}
            >
              a
            </p>
            {second((element) => {
              refs.current[1] = element;
            })}
            <BlockReorder
              blocks={() => refs.current.slice(0, 2)}
              lastSlot={2}
              onMove={vi.fn()}
              onPress={vi.fn()}
            />
          </article>
        );
      }
      render(<Harness />);
      hover(1);
      return handles()[0].style.top;
    }

    it("centres the 28px handle on the block's first line", () => {
      const top = setupSecond((ref) => (
        <p data-block="" contentEditable data-line-top="16" ref={ref}>
          A paragraph long enough to wrap
        </p>
      ));
      expect(top).toBe(`${topOf(1) + 26 - 14}px`);
    });

    it("centres it on the eyebrow's line when one sits above the text", () => {
      const top = setupSecond((ref) => (
        <div data-block="">
          <span contentEditable data-line-top="0">
            Part one
          </span>
          <h2 contentEditable data-line-top="40" ref={ref}>
            A heading
          </h2>
        </div>
      ));
      expect(top).toBe(`${topOf(1) + 10 - 14}px`);
    });

    it("centres it on an empty eyebrow, whose one line is its placeholder", () => {
      const top = setupSecond((ref) => (
        <div data-block="">
          <span contentEditable data-height="20" />
          <h2 contentEditable data-line-top="40" ref={ref}>
            A heading
          </h2>
        </div>
      ));
      expect(top).toBe(`${topOf(1) + 10 - 14}px`);
    });

    it("centres it on a button's label, which its row holds", () => {
      const top = setupSecond((ref) => (
        <div data-block="" ref={ref}>
          <span contentEditable="plaintext-only" data-line-top="10">
            Book a call
          </span>
        </div>
      ));
      expect(top).toBe(`${topOf(1) + 20 - 14}px`);
    });

    it("centres it on an empty field's box inside its padding", () => {
      const top = setupSecond((ref) => (
        <div data-block="">
          <p
            contentEditable
            data-height="40"
            style={{ paddingTop: "8px" }}
            ref={ref}
          />
        </div>
      ));
      expect(top).toBe(`${topOf(1) + 24 - 14}px`);
    });

    it("keeps a figure's at its top, level with the picture, not the caption", () => {
      const top = setupSecond((ref) => (
        <figure data-block="" ref={ref}>
          <div data-picture="" />
          <figcaption contentEditable data-line-top="200">
            A caption
          </figcaption>
        </figure>
      ));
      expect(top).toBe(`${topOf(1)}px`);
    });
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

  it("hands a press that doesn't travel on, with the handle pressed", () => {
    const onPress = vi.fn();
    setup(["a", "b", "c"], undefined, onPress);
    hover(1);
    const handle = handles()[0];
    pointer("pointerdown", handle, LEFT - 20, topOf(1) + 10);
    pointer("pointerup", handle, LEFT - 20, topOf(1) + 12);
    expect(onPress).toHaveBeenCalledExactlyOnceWith(1, handle);
  });

  it("hands on no press that became a drag", () => {
    const onPress = vi.fn();
    setup(["a", "b", "c"], undefined, onPress);
    const handle = carry(0, topOf(2) + 10);
    pointer("pointerup", handle, LEFT - 20, topOf(2) + 10);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("hands on no press the system cancelled", () => {
    const onPress = vi.fn();
    setup(["a", "b", "c"], undefined, onPress);
    hover(0);
    const handle = handles()[0];
    pointer("pointerdown", handle, LEFT - 20, topOf(0) + 10);
    pointer("pointercancel", handle, LEFT - 20, topOf(0) + 10);
    expect(onPress).not.toHaveBeenCalled();
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
