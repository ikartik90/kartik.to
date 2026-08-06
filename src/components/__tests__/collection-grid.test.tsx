// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  COLLECTION_MAX_ITEMS,
  DEFAULT_BACKGROUND_EFFECT,
  type CollectionItem,
} from "@/domain/nodes";
import { swapItems } from "@/utils/collection-items";
// StaticMeshGradient is WebGL; jsdom can't run it. Stand it in with a marker
// element carrying the colours, so a test can assert what was rendered.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ colors, className }: { colors: string[]; className?: string }) => (
    // The <canvas> is part of the contract, not decoration: the drag preview
    // snapshots it to carry the gradient with the picture.
    <div data-background-effect="" data-colors={colors.join(",")} className={className}>
      <canvas />
    </div>
  ),
}));

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
    onSetBackgroundEffect: vi.fn(),
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
    onSetBackgroundEffect: vi.fn(),
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
      onSetBackgroundEffect: vi.fn(),
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

// ---------------------------------------------------------------------------
// Properties panel
//
// The grid owns WHICH picture the panel is addressing and when it is up; what
// the panel contains is media-properties-panel.test.tsx's business.
// ---------------------------------------------------------------------------

const propertiesButton = (index: number) =>
  within(toolbarFor(index)).getByRole("button", { name: "Image properties" });

const panel = () => screen.queryByRole("dialog", { name: "Media properties" });

const panelProps = () => ({
  onFeature: vi.fn(),
  onEditCaption: vi.fn(),
  onReplace: vi.fn(),
  onRemove: vi.fn(),
  onAddImage: vi.fn(),
  onReorder: vi.fn(),
  onSetBackgroundEffect: vi.fn(),
});

describe("CollectionGrid properties panel", () => {
  it("offers the control on every filled cell", () => {
    setup(items("a", "b"));
    expect(propertiesButton(0)).toBeDefined();
    expect(propertiesButton(1)).toBeDefined();
  });

  // Asking to SEE a picture's properties must not be the same gesture as
  // giving it a caption or a gradient it did not have. Adding one is a click
  // inside the panel, on the section that owns it.
  it("opens without touching the picture", async () => {
    const { user, onSetBackgroundEffect, onEditCaption } = setup(items("a", "b"));
    expect(panel()).toBeNull();

    await user.click(propertiesButton(1));

    expect(panel()).not.toBeNull();
    expect(onSetBackgroundEffect).not.toHaveBeenCalled();
    expect(onEditCaption).not.toHaveBeenCalled();
  });

  // The panel is the editor for that picture now; a scrim blurring the very
  // gradient being tuned would defeat the preview.
  it("stands the addressed cell's overlay down, and only that one", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    expect(cells()[1].hasAttribute("data-properties-open")).toBe(true);
    expect(cells()[0].hasAttribute("data-properties-open")).toBe(false);
    expect(
      document.querySelectorAll("[data-properties-open]"),
    ).toHaveLength(1);
  });

  // The toolbar stands down while the panel is open, so the button that opened
  // it cannot be the way back — the header's close is.
  it("closes from the header without taking anything away", async () => {
    const { user, onSetBackgroundEffect, onEditCaption } = setup([
      { src: "a", caption: "A note", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
    ]);
    await user.click(propertiesButton(0));

    await user.click(
      screen.getByRole("button", { name: "Close properties panel" }),
    );

    // The panel plays its closing slide before the grid drops it.
    await waitFor(() => expect(panel()).toBeNull());
    expect(onSetBackgroundEffect).not.toHaveBeenCalled();
    expect(onEditCaption).not.toHaveBeenCalled();
    // Both are properties of the picture, not of the panel.
    expect(document.querySelectorAll("[data-background-effect]")).toHaveLength(1);
  });

  it("closes on Escape", async () => {
    const { user } = setup([
      { src: "a", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
    ]);
    await user.click(propertiesButton(0));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(panel()).toBeNull());
    expect(cells()[0].hasAttribute("data-properties-open")).toBe(false);
  });

  // What it reports is the PANEL's state, not the picture's — a picture that
  // has a caption but no panel open leaves the button unlit, because the
  // button is the way in and out of the panel and nothing else.
  it("reads pressed only while its own panel is open", async () => {
    const { user } = setup([
      {
        src: "a",
        caption: "A note",
        backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
      },
      { src: "b" },
    ]);
    expect(propertiesButton(0).getAttribute("aria-pressed")).toBe("false");

    await user.click(propertiesButton(1));

    expect(propertiesButton(1).getAttribute("aria-pressed")).toBe("true");
    expect(propertiesButton(0).getAttribute("aria-pressed")).toBe("false");
  });

  // The dismiss runs on POINTERDOWN and the toggle on the click after it, so
  // without exempting the trigger the button could only ever open: it would
  // find the panel already dismissed and put it straight back.
  it("closes the panel when its own button is pressed again", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));
    expect(panel()).not.toBeNull();

    await user.click(propertiesButton(1));

    await waitFor(() => expect(panel()).toBeNull());
  });

  // Closing has to go through the PANEL, not through the grid's own state:
  // dropping it from the tree on the click takes the closing slide with it.
  it("asks the panel to leave rather than yanking it", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(propertiesButton(1));

    // Still mounted, mid-slide, and no longer in the way.
    expect(panel()).not.toBeNull();
    expect(panel()!.className).toMatch(/properties-panel__exiting/);
    await waitFor(() => expect(panel()).toBeNull());
  });

  // Same mechanism, the other way: the press lands on another cell's trigger,
  // so the panel moves to that picture rather than closing and re-opening.
  it("moves to another image when that image's button is pressed", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(0));

    await user.click(propertiesButton(1));

    expect(panel()).not.toBeNull();
    expect(cells()[1].hasAttribute("data-properties-open")).toBe(true);
    expect(cells()[0].hasAttribute("data-properties-open")).toBe(false);
  });

  it("paints the gradient behind an image that has one, and only that image", () => {
    setup([
      { src: "a", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
      { src: "b" },
    ]);
    const layers = document.querySelectorAll("[data-background-effect]");
    expect(layers).toHaveLength(1);
    expect(cells()[0].querySelector("[data-background-effect]")).not.toBeNull();
  });

  // Featuring, removing and reordering all move an image between slots; a
  // stored index would leave the panel captioning whichever picture slid in.
  it("follows its image when the collection is reordered", async () => {
    const seeded: CollectionItem[] = [
      { src: "a" },
      { src: "b", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
    ];
    const props = panelProps();
    const { rerender } = render(<CollectionGrid items={seeded} {...props} />);
    await userEvent.setup().click(propertiesButton(1));

    rerender(<CollectionGrid items={[seeded[1], seeded[0]]} {...props} />);

    expect(cells()[0].hasAttribute("data-properties-open")).toBe(true);
    expect(cells()[1].hasAttribute("data-properties-open")).toBe(false);
  });

  it("closes itself when its image is removed", async () => {
    const seeded: CollectionItem[] = [
      { src: "a", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
      { src: "b" },
    ];
    const props = panelProps();
    const { rerender } = render(<CollectionGrid items={seeded} {...props} />);
    await userEvent.setup().click(propertiesButton(0));
    expect(panel()).not.toBeNull();

    rerender(<CollectionGrid items={[seeded[1]]} {...props} />);
    expect(panel()).toBeNull();
  });

  // The index the panel edits is resolved from the image it was opened on, so
  // an edit has to land on that picture and not on the slot it happens to
  // occupy.
  it("routes a caption typed in the panel to the addressed image", async () => {
    const { user, onEditCaption } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(screen.getByRole("button", { name: "Add caption" }));
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Hi",
    );

    expect(onEditCaption).toHaveBeenLastCalledWith(1, "Hi");
  });

  it("routes a background added in the panel to the addressed image", async () => {
    const { user, onSetBackgroundEffect } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(screen.getByRole("button", { name: "Add background" }));

    expect(onSetBackgroundEffect).toHaveBeenCalledExactlyOnceWith(
      1,
      DEFAULT_BACKGROUND_EFFECT,
    );
  });
});

describe("CollectionGrid background effect travels with the photo", () => {
  const preview = () =>
    document.body.querySelector<HTMLElement>(
      '[class*="collection-grid__dragPreview"]',
    );

  beforeEach(() => {
    // jsdom's canvas has no 2D/WebGL backend, so the readback is stubbed. What
    // matters to this component is only that a snapshot is taken and painted.
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,SNAPSHOT",
    );
  });

  // The clone is a bare <img>, and a cloned <canvas> is blank — so without an
  // explicit snapshot the picture leaves its gradient behind in the cell and
  // flies as a transparent cut-out.
  it("paints the gradient onto the clone that rides the cursor", () => {
    setup([{ src: "a", backgroundEffect: DEFAULT_BACKGROUND_EFFECT }, { src: "b" }]);
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });

    expect(preview()!.style.backgroundImage).toContain("SNAPSHOT");
    // Exactly the photo's own box, so the two line up pixel for pixel.
    expect(preview()!.style.backgroundSize).toBe("100% 100%");

    pointer("pointerup", source, centreOf(0));
  });

  it("carries nothing extra for a photo with no effect", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });

    expect(preview()!.style.backgroundImage).toBe("");

    pointer("pointerup", source, centreOf(0));
  });

  // A readback is the one part of the drag that depends on the GPU. Losing it
  // must cost the gradient, never the gesture.
  it("still drags when the snapshot cannot be read", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      throw new Error("context lost");
    });
    const { onReorder } = setup([
      { src: "a", backgroundEffect: DEFAULT_BACKGROUND_EFFECT },
      { src: "b" },
    ]);

    drag(0, 1);

    expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 1);
  });
});
