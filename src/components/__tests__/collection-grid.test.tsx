// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { COLLECTION_MAX_ITEMS, type CollectionItem } from "@/domain/nodes";
import { swapItems } from "@/utils/collection-items";
import { CollectionGrid } from "../collection-grid";

afterEach(() => cleanup());

const items = (...srcs: string[]): CollectionItem[] =>
  srcs.map((src) => ({ src }));

/**
 * Renders the grid over REAL state, so a reorder actually swaps the items the
 * way the editor does. Needed wherever the assertion is about what a cell is
 * showing rather than about which callback fired.
 */
function setupLive(list: CollectionItem[]) {
  const handlers = {
    onFeature: vi.fn(),
    onEditCaption: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
  };
  function Harness() {
    const [current, setCurrent] = useState(list);
    return (
      <CollectionGrid
        items={current}
        {...handlers}
        onReorder={(from, to) => setCurrent((c) => swapItems(c, from, to))}
      />
    );
  }
  render(<Harness />);
  return handlers;
}

function setup(list: CollectionItem[]) {
  const handlers = {
    onFeature: vi.fn(),
    onEditCaption: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
    onReorder: vi.fn(),
  };
  render(<CollectionGrid items={list} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
}

const cells = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-collection-cell]"));

const grid = () =>
  document.querySelector<HTMLElement>("[data-collection-grid]")!;

// Reordering is driven by pointer events, and the grid resolves the tile under
// the pointer by hit-testing the cells' own rects — so jsdom, which lays nothing
// out, needs those rects stated. A 100px grid, three across, at the origin.
const CELL = 100;

function rect(left: number, top: number, width = CELL, height = CELL) {
  return () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => "",
    }) as DOMRect;
}

function layOutCells() {
  cells().forEach((cell, index) => {
    const at = rect((index % 3) * CELL, Math.floor(index / 3) * CELL);
    cell.getBoundingClientRect = at;
    const img = cell.querySelector("img");
    if (img) img.getBoundingClientRect = at;
  });
}

const centreOf = (index: number) => ({
  clientX: (index % 3) * CELL + CELL / 2,
  clientY: Math.floor(index / 3) * CELL + CELL / 2,
});

/**
 * jsdom implements no PointerEvent, so a MouseEvent carries the pointer fields —
 * React dispatches on the event's type, so it reaches the pointer handlers.
 *
 * Moves and releases go to the SOURCE cell rather than to whatever is under the
 * pointer, which is exactly what pointer capture guarantees in a browser.
 */
function pointer(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: Element,
  at: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...at,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  fireEvent(target, event);
  return event;
}

/** Press on the tile at `index`, at a point inside it. */
function press(index: number, at = centreOf(index)) {
  const source = cells()[index];
  pointer("pointerdown", source.querySelector("img")!, at);
  return source;
}

/**
 * Carry the tile at `from` onto the tile at `to`. The first move is a nudge, so
 * the press clears the drag threshold even when `to` is the cell it started in.
 */
function drag(from: number, to: number) {
  layOutCells();
  const start = centreOf(from);
  const source = press(from, start);
  pointer("pointermove", source, {
    clientX: start.clientX + 20,
    clientY: start.clientY,
  });
  pointer("pointermove", source, centreOf(to));
  pointer("pointerup", source, centreOf(to));
  return source;
}

/** The toolbar belonging to the nth image (0-based). */
const toolbarFor = (index: number) =>
  screen.getByRole("toolbar", { name: `Image ${index + 1} actions` });

describe("CollectionGrid", () => {
  // The cap is shown rather than merely enforced: two images means two filled
  // slots and four empty ones, never a two-cell grid.
  it("always shows every slot, filled or not", () => {
    setup(items("a", "b"));
    expect(screen.getAllByRole("toolbar")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Add Image" })).toHaveLength(
      COLLECTION_MAX_ITEMS - 2,
    );
  });

  it("offers no empty slot once the collection is full", () => {
    setup(items("a", "b", "c", "d", "e", "f"));
    expect(screen.queryByRole("button", { name: "Add Image" })).toBeNull();
  });

  it("opens the picker from an empty slot", async () => {
    const { user, onAddImage } = setup(items("a"));
    await user.click(screen.getAllByRole("button", { name: "Add Image" })[0]);
    expect(onAddImage).toHaveBeenCalledOnce();
  });

  it("features the image whose toolbar was used", async () => {
    const { user, onFeature } = setup(items("a", "b", "c"));
    await user.click(
      within(toolbarFor(2)).getByRole("button", { name: "Feature image" }),
    );
    expect(onFeature).toHaveBeenCalledExactlyOnceWith(2);
  });

  // Index 0 IS the featured image, so its own button reads as already on.
  it("marks only the first slot's feature button as pressed", () => {
    setup(items("a", "b"));
    const pressed = (index: number) =>
      within(toolbarFor(index))
        .getByRole("button", { name: "Feature image" })
        .getAttribute("aria-pressed");
    expect(pressed(0)).toBe("true");
    expect(pressed(1)).toBe("false");
  });

  it("reorders by dragging one tile onto another", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    drag(2, 1);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 1);
  });

  // Dropping a tile in the first cell is the same gesture as the Feature
  // button — index 0 IS the featured position.
  it("features an image dragged onto the first cell", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    drag(2, 0);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 0);
  });

  it("ignores a tile released back on the cell it came from", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    drag(1, 1);
    expect(onReorder).not.toHaveBeenCalled();
  });

  // Items are a dense array, so there is no slot "at" an empty cell to trade
  // with — every rearrangement is reachable by swapping filled tiles. Released
  // anywhere that is not a filled tile, nothing moves.
  it("does not reorder when released away from every tile", () => {
    const { onReorder } = setup(items("a", "b"));
    layOutCells();
    const source = press(0);
    pointer("pointermove", source, { clientX: 900, clientY: 900 });
    pointer("pointerup", source, { clientX: 900, clientY: 900 });

    expect(onReorder).not.toHaveBeenCalled();
    expect(cells()[0].querySelector("img")).not.toBeNull();
    expect(cells().some((c) => c.hasAttribute("data-dragging"))).toBe(false);
  });

  // A press is not a drag. The toolbar sits over the photo, and a button that
  // moved the tile a pixel every time it was clicked would be unusable.
  it("ignores a press that never travels far enough to be a drag", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    layOutCells();
    const start = centreOf(2);
    const source = press(2, start);
    pointer("pointermove", source, {
      clientX: start.clientX + 2,
      clientY: start.clientY,
    });
    pointer("pointerup", source, centreOf(1));

    expect(onReorder).not.toHaveBeenCalled();
    expect(previewNode()).toBeNull();
  });

  // The photo is the drag handle. Pressing the controls laid over it must stay
  // a press, or the toolbar would be unreachable on a filled cell.
  it("does not start a drag from the cell's controls", () => {
    setup(items("a", "b", "c"));
    layOutCells();
    const button = within(toolbarFor(2)).getByRole("button", {
      name: "Feature image",
    });
    pointer("pointerdown", button, centreOf(2));
    pointer("pointermove", cells()[2], centreOf(1));

    expect(previewNode()).toBeNull();
    expect(cells().some((c) => c.hasAttribute("data-dragging"))).toBe(false);
  });

  const previewNode = () =>
    document.body.querySelector<HTMLElement>(
      '[class*="collection-grid__dragPreview"]',
    );

  /** Press on a tile and carry it far enough to become a drag. */
  function lift(index: number, at = { clientX: 160, clientY: 90 }) {
    const source = press(index, at);
    pointer("pointermove", source, {
      clientX: at.clientX + 40,
      clientY: at.clientY,
    });
    return source;
  }

  // What rides the cursor is a CLONE OF THE PHOTO, not the browser's own drag
  // bitmap — the whole reason this gesture is built on pointer events. That
  // bitmap composites onto an opaque backing, so the corners a border-radius
  // makes transparent come back white, and the browser animates it home when the
  // drag ends, which played over an already-reordered grid.
  it("carries a clone of the photo, not a browser drag image", () => {
    setup(items("a", "b"));
    layOutCells();
    const img = cells()[0].querySelector("img")!;
    lift(0, centreOf(0));

    const node = previewNode()!;
    expect(node).not.toBeNull();
    expect(node.tagName).toBe("IMG");
    expect((node as HTMLImageElement).src).toBe(img.src);
    // Parented to the body, so no ancestor's overflow or stacking context can
    // clip it as it crosses the page.
    expect(node.parentElement).toBe(document.body);
  });

  it("hangs the preview from where the image was grabbed", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(100, 50, 300, 300);
    const source = press(0, { clientX: 160, clientY: 90 });
    // Grabbed 60 across and 40 down, so the preview trails the pointer by that
    // much rather than centring under it.
    pointer("pointermove", source, { clientX: 400, clientY: 300 });
    expect(previewNode()!.style.translate).toBe("340px 260px");

    pointer("pointermove", source, { clientX: 500, clientY: 500 });
    expect(previewNode()!.style.translate).toBe("440px 460px");
  });

  // Tracking rides the independent `translate` property precisely so it does
  // NOT share `transform` with the press feedback — a transition on `transform`
  // would be a transition on the pointer tracking, and the photo would swim
  // after the cursor instead of sticking to it.
  it("keeps the pointer tracking off the transform property", () => {
    setup(items("a", "b"));
    layOutCells();
    lift(0, centreOf(0));
    expect(previewNode()!.style.transform).toBe("");
  });

  // Lifting a photo answers the hand the way pressing a button does — the same
  // 100ms as `action`'s `_active` at twice its travel, since a tile needs more
  // movement than a 40px control to read as pressed. Applied by attribute so
  // the number itself stays in `panda.config.ts`.
  it("marks the carried photo as picked up, for the press feedback", () => {
    setup(items("a", "b"));
    layOutCells();
    lift(0, centreOf(0));
    expect(previewNode()!.hasAttribute("data-carried")).toBe(true);
  });

  // The press is acknowledged on POINTER DOWN, not once the drag threshold is
  // crossed — holding a photo still has to feel like holding something.
  it("presses the photo the moment the pointer goes down", () => {
    setup(items("a", "b", "c"));
    press(1);
    expect(cells()[1].hasAttribute("data-pressed")).toBe(true);
    expect(cells()[0].hasAttribute("data-pressed")).toBe(false);
    // No movement yet, so this is a press and nothing more.
    expect(previewNode()).toBeNull();
  });

  // Shrinking about the centre slides the picture away from the cursor, so the
  // pixel you pressed stops being the pixel you are holding. The press is
  // anchored to where the hand actually landed.
  it("scales the pressed photo about the point it was pressed", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(100, 50, 300, 200);
    press(0, { clientX: 160, clientY: 90 });
    // Pressed 60 across and 40 down from the photo's own top-left.
    expect(cells()[0].style.getPropertyValue("--press-origin")).toBe(
      "60px 40px",
    );
  });

  // The clone inherits the anchor rather than picking its own, or the photo
  // would jump sideways at the very moment the drag takes over.
  it("anchors the carried photo to the same point", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(100, 50, 300, 200);
    const source = press(0, { clientX: 160, clientY: 90 });
    pointer("pointermove", source, { clientX: 400, clientY: 300 });

    expect(previewNode()!.style.transformOrigin).toBe("60px 40px");
    expect(previewNode()!.style.transformOrigin).toBe(
      cells()[0].style.getPropertyValue("--press-origin"),
    );
  });

  it("stops anchoring once the press is over", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = press(0);
    pointer("pointerup", source, centreOf(0));
    expect(cells()[0].style.getPropertyValue("--press-origin")).toBe("");
  });

  // The toolbar is not a drag handle, so pressing it must not shrink the
  // picture underneath it.
  it("does not press the photo when the pointer lands on the toolbar", () => {
    setup(items("a", "b", "c"));
    pointer(
      "pointerdown",
      within(toolbarFor(1)).getByRole("button", { name: "Feature image" }),
      centreOf(1),
    );
    expect(cells().some((c) => c.hasAttribute("data-pressed"))).toBe(false);
  });

  // The moment a hand is on the photo, the photo is what is being addressed —
  // so the scrim and its toolbar get out of the way before any movement, not
  // once a drag has been established.
  it("clears the controls off the photo on press, before any movement", () => {
    setup(items("a", "b", "c"));
    expect(grid().hasAttribute("data-reordering")).toBe(false);
    press(1);
    expect(grid().hasAttribute("data-reordering")).toBe(true);
  });

  // A press on the toolbar is a press on the toolbar. Hiding it out from under
  // the pointer would make its own buttons unusable.
  it("leaves the controls alone when the press lands on them", () => {
    setup(items("a", "b", "c"));
    pointer(
      "pointerdown",
      within(toolbarFor(1)).getByRole("button", { name: "Feature image" }),
      centreOf(1),
    );
    expect(grid().hasAttribute("data-reordering")).toBe(false);
  });

  it("lets the photo back up when a press ends without a drag", () => {
    setup(items("a", "b", "c"));
    layOutCells();
    const source = press(1);
    pointer("pointerup", source, centreOf(1));
    expect(cells().some((c) => c.hasAttribute("data-pressed"))).toBe(false);
  });

  // The press scales the photo IN PLACE, and `getBoundingClientRect` reports
  // the transformed box — so measuring at the drag threshold hands the clone a
  // box already reduced by the press, which the clone then scales again. The
  // picture shrinks twice and the grab point drifts. Measure at the press.
  it("sizes the carried photo before the press shrinks it", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(0, 0, 300, 200);
    const source = press(0, { clientX: 10, clientY: 10 });

    // What the photo measures once the press has taken hold — 0.94 of itself.
    img.getBoundingClientRect = rect(9, 6, 282, 188);
    pointer("pointermove", source, { clientX: 200, clientY: 200 });

    expect(previewNode()!.style.width).toBe("300px");
    expect(previewNode()!.style.height).toBe("200px");
    // Grabbed 10 in from a photo at the origin, so it still trails by 10.
    expect(previewNode()!.style.translate).toBe("190px 190px");
  });

  // The clone takes the gesture over MID-press, so it has to arrive already
  // scaled down. Easing it down again would pop it up to full size first.
  it("hands the press straight to the carried photo, with no second dip", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = press(0, centreOf(0));
    // Marked before it enters the document, so there is no resting scale for a
    // transition to run from.
    pointer("pointermove", source, centreOf(1));
    expect(previewNode()!.hasAttribute("data-carried")).toBe(true);
  });

  it("matches the preview to the size of the photo it lifted", () => {
    setup(items("a", "b"));
    cells()[0].querySelector("img")!.getBoundingClientRect = rect(
      0,
      0,
      300,
      200,
    );
    lift(0, { clientX: 10, clientY: 10 });
    expect(previewNode()!.style.width).toBe("300px");
    expect(previewNode()!.style.height).toBe("200px");
  });

  // Letting go over a tile sends the photo INTO that tile. Landing it on the
  // cell it was dropped on is the whole answer to "where did it go?" — it
  // arrives exactly over the swapped-in image, so handing back to the grid is
  // invisible. (The reorder itself is applied at once, underneath.)
  describe("landing", () => {
    let animate: ReturnType<typeof vi.fn>;
    const finishers: Array<() => void> = [];

    beforeEach(() => {
      finishers.length = 0;
      // jsdom implements no Web Animations API.
      animate = vi.fn(() => {
        const anim = {
          set onfinish(fn: () => void) {
            finishers.push(fn);
          },
          set oncancel(fn: () => void) {
            finishers.push(fn);
          },
        };
        return anim;
      });
      (HTMLElement.prototype as unknown as { animate: unknown }).animate =
        animate;
    });

    afterEach(() => {
      delete (HTMLElement.prototype as unknown as { animate?: unknown })
        .animate;
    });

    it("flies the photo into the cell it was dropped on", () => {
      const { onReorder } = setup(items("a", "b", "c"));
      drag(2, 0);

      expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 0);
      const [frames] = animate.mock.calls[0] as [
        Array<Record<string, string>>,
      ];
      // Cell 0 sits at the origin in the laid-out grid, so that is where the
      // photo comes to rest — not the cell it was lifted from.
      expect(frames[frames.length - 1].translate).toBe("0px 0px");
      expect(frames[frames.length - 1].width).toBe("100px");
      // And it lets go of the press as it lands, so it sits flush with the
      // photo already in the slot rather than arriving a hair small or askew.
      expect(frames[frames.length - 1].scale).toBe("1");
      expect(frames[frames.length - 1].rotate).toBe("0deg");
      // Still on screen, travelling. It leaves when it arrives.
      expect(previewNode()).not.toBeNull();
    });

    it("hands back to the grid once it lands", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      finishers.forEach((finish) => finish());
      expect(previewNode()).toBeNull();
    });

    const srcOf = (index: number) =>
      cells()[index].querySelector("img")!.getAttribute("src");

    // The reorder is applied to state the moment you let go, so the receiving
    // cell already owns the incoming photo. Painting it while a copy is still
    // travelling there would show the picture in two places at once.
    it("marks the receiving cell for as long as one is in the air", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[0].hasAttribute("data-landing")).toBe(true);
      // Only the cell being flown into — every other cell is untouched.
      expect(cells()[2].hasAttribute("data-landing")).toBe(false);
      expect(cells()[1].hasAttribute("data-landing")).toBe(false);
    });

    // The heart of it. HIDING the receiving cell's photo stops the duplicate
    // but leaves a hole to see the page background through — the flash. It has
    // to keep showing the photo it held BEFORE the swap, so the slot is full
    // throughout and the incoming picture still appears only once.
    it("leaves the receiving cell showing its previous photo, not a hole", () => {
      setupLive(items("a", "b", "c"));
      drag(2, 0);

      // Still "a", the photo cell 0 held before the drop — NOT "c", which is
      // the one currently in the air, and not nothing at all.
      expect(srcOf(0)).toBe("a");
      expect(cells()[0].querySelector("img")).not.toBeNull();
    });

    // The photo is visibly in the air over the target, so the slot it came out
    // of must stay empty — filling it early shows that same photo twice.
    it("keeps the vacated slot empty until the flight lands", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[2].hasAttribute("data-dragging")).toBe(true);
    });

    // The clone must OUTLIVE the state commit. Removing it first and letting
    // React batch the swap into a later microtask lets the browser paint in
    // between — one frame showing the cover photo where the clone just was and
    // an empty slot where the displaced photo belongs, so both flash.
    //
    // Deliberately NOT wrapped in `act()`: the assertion is that the DOM is
    // already final inside the landing call itself, which only holds if the
    // commit was flushed synchronously before the clone went.
    it("commits the swap before the clone leaves, never after", () => {
      setupLive(items("a", "b", "c"));
      drag(2, 0);
      expect(srcOf(0)).toBe("a");

      finishers.forEach((finish) => finish());

      expect(srcOf(0)).toBe("c");
      expect(srcOf(2)).toBe("a");
      expect(previewNode()).toBeNull();
    });

    it("resolves the whole swap when the flight lands", () => {
      setupLive(items("a", "b", "c"));
      drag(2, 0);
      act(() => finishers.forEach((finish) => finish()));

      // Target now shows what was dropped on it, vacated slot shows what it
      // traded for, and it fades up rather than appearing from nowhere.
      expect(srcOf(0)).toBe("c");
      expect(srcOf(2)).toBe("a");
      expect(cells()[2].hasAttribute("data-dragging")).toBe(false);
      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
    });

    // Revealed in the SAME call that removes the clone: a gap either way shows
    // the photo twice or not at all.
    it("uncovers the photo in the same breath as the clone leaves", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(previewNode()).not.toBeNull();
      expect(cells()[0].hasAttribute("data-landing")).toBe(true);

      // Landing clears React state, so its render has to be flushed.
      act(() => finishers.forEach((finish) => finish()));

      expect(previewNode()).toBeNull();
      expect(cells()[0].hasAttribute("data-landing")).toBe(false);
    });

    it("holds nothing back when the drop moved nothing", () => {
      setup(items("a", "b"));
      layOutCells();
      const source = press(0);
      pointer("pointermove", source, { clientX: 900, clientY: 900 });
      pointer("pointerup", source, { clientX: 900, clientY: 900 });
      expect(cells().some((c) => c.hasAttribute("data-landing"))).toBe(false);
    });

    // A swap moves two photos, and only one of them was carried. The displaced
    // one appears in the slot the dragged photo left, and fades up there rather
    // than travelling — animating a trip nobody made would be a lie about what
    // happened.
    it("fades the displaced photo up in the vacated slot", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
      // Only the vacated slot — the cell that was dropped on has the flight
      // landing on it instead.
      expect(cells()[0].hasAttribute("data-arriving")).toBe(false);
    });

    it("stops marking the slot once it has arrived", () => {
      vi.useFakeTimers();
      try {
        setup(items("a", "b", "c"));
        drag(2, 0);
        // The timer clears React state, so its render has to be flushed.
        act(() => void vi.advanceTimersByTime(1000));
        expect(cells().some((c) => c.hasAttribute("data-arriving"))).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    // The controls come back AT THE RELEASE, while the photo is still in the
    // air, so the blur has the whole flight to come up and is already on the
    // cell when the photo touches down. Holding them until the landing put the
    // two in the wrong order: the photo arrived bare and the blur washed over
    // it a beat later, which reads as a glitch on the thing just dropped.
    it("has the blur back up before the photo lands", () => {
      setup(items("a", "b", "c"));
      layOutCells();
      const source = press(2);
      pointer("pointermove", source, centreOf(0));
      expect(grid().hasAttribute("data-reordering")).toBe(true);

      pointer("pointerup", source, centreOf(0));

      // Released and the controls are already returning, even though the photo
      // is demonstrably still travelling.
      expect(grid().hasAttribute("data-reordering")).toBe(false);
      expect(cells()[0].hasAttribute("data-landing")).toBe(true);
      expect(previewNode()).not.toBeNull();
    });

    // The overlay's return must not be chained to anything the flight does, or
    // it drifts back behind the landing again.
    it("does not wait on the flight or the vacated fade to restore them", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(grid().hasAttribute("data-reordering")).toBe(false);

      act(() => finishers.forEach((finish) => finish()));

      // Still fading the displaced photo up, and the controls never left.
      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
      expect(grid().hasAttribute("data-reordering")).toBe(false);
    });

    // Nothing flew, so there is nothing to wait for.
    it("brings the controls straight back when nothing moved", () => {
      setup(items("a", "b", "c"));
      layOutCells();
      const source = press(2);
      pointer("pointermove", source, { clientX: 900, clientY: 900 });
      pointer("pointerup", source, { clientX: 900, clientY: 900 });
      expect(grid().hasAttribute("data-reordering")).toBe(false);
    });

    it("leaves nothing arriving when the drop moved nothing", () => {
      setup(items("a", "b", "c"));
      layOutCells();
      const source = press(1);
      pointer("pointermove", source, { clientX: 900, clientY: 900 });
      pointer("pointerup", source, { clientX: 900, clientY: 900 });
      expect(cells().some((c) => c.hasAttribute("data-arriving"))).toBe(false);
    });

    // Observed in a real browser: an animation that completes while the tab is
    // hidden reaches `finished` without ever dispatching, which stranded the
    // photo over the grid. The clock has to be able to finish the job alone.
    it("clears the photo even if the flight never calls back", () => {
      vi.useFakeTimers();
      try {
        setup(items("a", "b", "c"));
        drag(2, 0);
        expect(previewNode()).not.toBeNull();
        vi.advanceTimersByTime(1000);
        expect(previewNode()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    // Nothing to fly to, so nothing flies — this is the case the user asked to
    // be instant, and it stays instant.
    it("takes the photo away at once when it lands on nothing", () => {
      const { onReorder } = setup(items("a", "b"));
      layOutCells();
      const source = press(0);
      pointer("pointermove", source, { clientX: 900, clientY: 900 });
      pointer("pointerup", source, { clientX: 900, clientY: 900 });

      expect(onReorder).not.toHaveBeenCalled();
      expect(animate).not.toHaveBeenCalled();
      expect(previewNode()).toBeNull();
    });
  });

  // Where there is no Web Animations API to play, the photo simply goes — and
  // nothing is held back, because there is no flight to wait for.
  it("still swaps when it cannot animate the landing", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    drag(2, 0);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 0);
    expect(previewNode()).toBeNull();
    expect(cells().some((c) => c.hasAttribute("data-landing"))).toBe(false);
  });

  it("takes the preview away when the gesture is cancelled", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = lift(0, centreOf(0));
    expect(previewNode()).not.toBeNull();
    pointer("pointercancel", source, centreOf(1));
    expect(previewNode()).toBeNull();
  });

  // Escape is the way out of a drag you have thought better of, and it must not
  // move anything.
  it("abandons the drag on Escape", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, centreOf(2));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(previewNode()).toBeNull();
    expect(cells().some((c) => c.hasAttribute("data-dragging"))).toBe(false);

    // The release that follows must not still land the tile.
    pointer("pointerup", source, centreOf(2));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("marks the carried tile and the one under the pointer", () => {
    setup(items("a", "b", "c"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, centreOf(2));

    expect(cells()[0].hasAttribute("data-dragging")).toBe(true);
    expect(cells()[2].hasAttribute("data-drop-target")).toBe(true);
    expect(cells()[1].hasAttribute("data-drop-target")).toBe(false);
    // The cell it came from is never its own drop target.
    pointer("pointermove", source, centreOf(0));
    expect(cells()[0].hasAttribute("data-drop-target")).toBe(false);
  });

  it("clears its drag state however the gesture ends", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, centreOf(1));
    pointer("pointerup", source, centreOf(1));

    expect(cells().some((c) => c.hasAttribute("data-dragging"))).toBe(false);
    expect(cells().some((c) => c.hasAttribute("data-drop-target"))).toBe(false);
  });

  it("replaces and removes the addressed image", async () => {
    const { user, onReplace, onRemove } = setup(items("a", "b"));
    await user.click(
      within(toolbarFor(1)).getByRole("button", { name: "Replace image" }),
    );
    await user.click(
      within(toolbarFor(1)).getByRole("button", { name: "Remove image" }),
    );
    expect(onReplace).toHaveBeenCalledExactlyOnceWith(1);
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe("CollectionGrid caption editing", () => {
  async function startEditing(list: CollectionItem[], index: number) {
    const ctx = setup(list);
    await ctx.user.click(
      within(toolbarFor(index)).getByRole("button", {
        name: "Edit image caption",
      }),
    );
    return ctx;
  }

  it("swaps the toolbar's buttons for a caption field", async () => {
    await startEditing(items("a", "b"), 0);
    expect(screen.getByRole("textbox", { name: "Image caption" })).toBeDefined();
    // Only the edited cell loses its buttons; the other toolbar is untouched.
    expect(screen.getAllByRole("toolbar")).toHaveLength(1);
  });

  it("seeds the field with the caption already written", async () => {
    const ctx = setup([{ src: "a", caption: "Existing" }]);
    await ctx.user.click(
      screen.getByRole("button", { name: "Edit image caption" }),
    );
    expect(
      (screen.getByRole("textbox", { name: "Image caption" }) as HTMLInputElement)
        .value,
    ).toBe("Existing");
  });

  it("commits on Enter and closes the field", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "A caption{Enter}",
    );
    expect(onEditCaption).toHaveBeenCalledExactlyOnceWith(0, "A caption");
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });

  it("stores a cleared caption as nothing at all", async () => {
    const ctx = setup([{ src: "a", caption: "Existing" }]);
    await ctx.user.click(
      screen.getByRole("button", { name: "Edit image caption" }),
    );
    await ctx.user.clear(screen.getByRole("textbox", { name: "Image caption" }));
    await ctx.user.keyboard("{Enter}");
    expect(ctx.onEditCaption).toHaveBeenCalledExactlyOnceWith(0, undefined);
  });

  it("discards the draft on Escape", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Never mind{Escape}",
    );
    expect(onEditCaption).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });

  // Clicking away is a commit, not a cancel — losing typing to a stray click
  // is the worse failure.
  it("commits on blur", async () => {
    const { user, onEditCaption } = await startEditing(items("a"), 0);
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Typed then left",
    );
    await user.tab();
    expect(onEditCaption).toHaveBeenCalledExactlyOnceWith(0, "Typed then left");
  });

  // The editor is pinned to the IMAGE, not the slot: featuring it mid-edit
  // moves it to another cell, and removing it must not strand the field on
  // whatever slides into that slot.
  it("follows its image when the collection is reordered", async () => {
    const list = items("a", "b");
    const { rerender } = render(
      <CollectionGrid
        items={list}
        onFeature={vi.fn()}
        onEditCaption={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
        onAddImage={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    await userEvent.setup().click(
      within(toolbarFor(1)).getByRole("button", { name: "Edit image caption" }),
    );

    rerender(
      <CollectionGrid
        items={items("b", "a")}
        onFeature={vi.fn()}
        onEditCaption={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
        onAddImage={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    // "b" is now slot 0, so slot 1 ("a") keeps its buttons and slot 0 edits.
    expect(screen.getByRole("toolbar", { name: "Image 2 actions" })).toBeDefined();
    expect(screen.queryByRole("toolbar", { name: "Image 1 actions" })).toBeNull();
  });

  it("closes itself when its image is removed", async () => {
    const list = items("a", "b");
    const props = {
      onFeature: vi.fn(),
      onEditCaption: vi.fn(),
      onReplace: vi.fn(),
      onRemove: vi.fn(),
      onAddImage: vi.fn(),
      onReorder: vi.fn(),
    };
    const { rerender } = render(<CollectionGrid items={list} {...props} />);
    await userEvent.setup().click(
      within(toolbarFor(1)).getByRole("button", { name: "Edit image caption" }),
    );

    rerender(<CollectionGrid items={items("a")} {...props} />);
    expect(screen.queryByRole("textbox", { name: "Image caption" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Slot identity
// ---------------------------------------------------------------------------

describe("CollectionGrid slot identity", () => {
  // Keying a cell by the photo inside it made a swap change both keys, so React
  // destroyed and rebuilt exactly the element the browser was mid-drag on — it
  // then never received `dragend`, and the browser was left resolving a drag
  // whose source had vanished. The slot is the identity, not its contents.
  it("keeps a cell's DOM node across a swap of its contents", () => {
    const props = {
      onFeature: vi.fn(),
      onEditCaption: vi.fn(),
      onReplace: vi.fn(),
      onRemove: vi.fn(),
      onAddImage: vi.fn(),
      onReorder: vi.fn(),
    };
    const { rerender } = render(
      <CollectionGrid items={items("a", "b", "c")} {...props} />,
    );
    const [slot0, slot1] = cells();

    rerender(<CollectionGrid items={items("c", "b", "a")} {...props} />);

    expect(cells()[0]).toBe(slot0);
    expect(cells()[1]).toBe(slot1);
    expect(document.contains(slot0)).toBe(true);
    // The node stayed; only what it shows changed.
    expect(cells()[0].querySelector("img")!.getAttribute("src")).toBe("c");
  });
});
