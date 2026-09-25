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
// StaticMeshGradient is WebGL, which jsdom can't run: a marker element carries its colours.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ colors, className }: { colors: string[]; className?: string }) => (
    // The <canvas> must stay: the drag preview snapshots it.
    <div data-background-effect="" data-colors={colors.join(",")} className={className}>
      <canvas />
    </div>
  ),
}));

// Transparency detection decodes images, which jsdom can't; the answer is declared here instead.
const { transparentSrcs, askedAbout } = vi.hoisted(() => ({
  transparentSrcs: new Set<string>(),
  askedAbout: [] as string[][],
}));
vi.mock("@/hooks/use-image-transparency", () => ({
  useImageTransparency: (srcs: string[]) => {
    askedAbout.push(srcs);
    return transparentSrcs;
  },
}));

import { CollectionGrid } from "../collection-grid";

// jsdom has no media stack: a clip cell would log not-implemented errors on every `play()`.
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(() => {
  cleanup();
  transparentSrcs.clear();
  askedAbout.length = 0;
});

const items = (...srcs: string[]): CollectionItem[] =>
  srcs.map((src) => ({ type: "media" as const, kind: "image" as const, src }));

// Not a `.mp4` in `items()`: the grid reads the declared kind, never the src.
const clips = (...srcs: string[]): CollectionItem[] =>
  srcs.map((src) => ({ type: "media" as const, kind: "video" as const, src }));

const picture = (
  src: string,
  fields: Partial<Omit<CollectionItem, "type" | "kind" | "src">> = {},
): CollectionItem => ({ type: "media", kind: "image", src, ...fields });

// Renders over real state, so a reorder actually swaps the items.
function setupLive(list: CollectionItem[]) {
  const handlers = {
    onFeature: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
    onItemsChange: vi.fn(),
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
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
    onReorder: vi.fn(),
    onItemsChange: vi.fn(),
  };
  render(<CollectionGrid items={list} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
}

const cells = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-media-cell]"));

const grid = () =>
  document.querySelector<HTMLElement>("[data-collection-grid]")!;

// jsdom lays nothing out and the grid hit-tests cell rects, so they're stated: 100px cells, three across.
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

const mediaIn = (cell: Element) =>
  cell.querySelector<HTMLElement>("img, video");

function layOutCells() {
  cells().forEach((cell, index) => {
    const at = rect((index % 3) * CELL, Math.floor(index / 3) * CELL);
    cell.getBoundingClientRect = at;
    const media = mediaIn(cell);
    if (media) media.getBoundingClientRect = at;
  });
}

const centreOf = (index: number) => ({
  clientX: (index % 3) * CELL + CELL / 2,
  clientY: Math.floor(index / 3) * CELL + CELL / 2,
});

// jsdom has no PointerEvent, so a MouseEvent carries the pointer fields. Moves and releases go to
// the source cell, as pointer capture would send them.
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

function press(index: number, at = centreOf(index)) {
  const source = cells()[index];
  pointer("pointerdown", mediaIn(source)!, at);
  return source;
}

// The first move is a nudge, so the press clears the drag threshold even when `to` is the start cell.
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

const toolbarFor = (index: number) =>
  screen.getByRole("toolbar", { name: `Image ${index + 1} actions` });

describe("CollectionGrid", () => {
  it("always shows every slot, filled or not", () => {
    setup(items("a", "b"));
    expect(screen.getAllByRole("toolbar")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Add Media" })).toHaveLength(
      COLLECTION_MAX_ITEMS - 2,
    );
  });

  it("offers no empty slot once the collection is full", () => {
    setup(items("a", "b", "c", "d", "e", "f"));
    expect(screen.queryByRole("button", { name: "Add Media" })).toBeNull();
  });

  it("opens the picker from an empty slot", async () => {
    const { user, onAddImage } = setup(items("a"));
    await user.click(screen.getAllByRole("button", { name: "Add Media" })[0]);
    expect(onAddImage).toHaveBeenCalledOnce();
  });

  it("features the image whose toolbar was used", async () => {
    const { user, onFeature } = setup(items("a", "b", "c"));
    await user.click(
      within(toolbarFor(2)).getByRole("button", { name: "Feature image" }),
    );
    expect(onFeature).toHaveBeenCalledExactlyOnceWith(2);
  });

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

  function lift(index: number, at = { clientX: 160, clientY: 90 }) {
    const source = press(index, at);
    pointer("pointermove", source, {
      clientX: at.clientX + 40,
      clientY: at.clientY,
    });
    return source;
  }

  it("carries a clone of the photo, not a browser drag image", () => {
    setup(items("a", "b"));
    layOutCells();
    const img = cells()[0].querySelector("img")!;
    lift(0, centreOf(0));

    const node = previewNode()!;
    expect(node).not.toBeNull();
    expect(node.tagName).toBe("IMG");
    expect((node as HTMLImageElement).src).toBe(img.src);
    expect(node.parentElement).toBe(document.body);
  });

  it("hangs the preview from where the image was grabbed", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(100, 50, 300, 300);
    const source = press(0, { clientX: 160, clientY: 90 });
    // Grabbed 60 across and 40 down, so the preview trails the pointer by that much.
    pointer("pointermove", source, { clientX: 400, clientY: 300 });
    expect(previewNode()!.style.translate).toBe("340px 260px");

    pointer("pointermove", source, { clientX: 500, clientY: 500 });
    expect(previewNode()!.style.translate).toBe("440px 460px");
  });

  it("keeps the pointer tracking off the transform property", () => {
    setup(items("a", "b"));
    layOutCells();
    lift(0, centreOf(0));
    expect(previewNode()!.style.transform).toBe("");
  });

  it("marks the carried photo as picked up, for the press feedback", () => {
    setup(items("a", "b"));
    layOutCells();
    lift(0, centreOf(0));
    expect(previewNode()!.hasAttribute("data-carried")).toBe(true);
  });

  it("presses the photo the moment the pointer goes down", () => {
    setup(items("a", "b", "c"));
    press(1);
    expect(cells()[1].hasAttribute("data-pressed")).toBe(true);
    expect(cells()[0].hasAttribute("data-pressed")).toBe(false);
    expect(previewNode()).toBeNull();
  });

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

  it("does not press the photo when the pointer lands on the toolbar", () => {
    setup(items("a", "b", "c"));
    pointer(
      "pointerdown",
      within(toolbarFor(1)).getByRole("button", { name: "Feature image" }),
      centreOf(1),
    );
    expect(cells().some((c) => c.hasAttribute("data-pressed"))).toBe(false);
  });

  it("clears the controls off the photo on press, before any movement", () => {
    setup(items("a", "b", "c"));
    expect(grid().hasAttribute("data-reordering")).toBe(false);
    press(1);
    expect(grid().hasAttribute("data-reordering")).toBe(true);
  });

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

  it("sizes the carried photo before the press shrinks it", () => {
    setup(items("a", "b"));
    const img = cells()[0].querySelector("img")!;
    img.getBoundingClientRect = rect(0, 0, 300, 200);
    const source = press(0, { clientX: 10, clientY: 10 });

    // The photo's box once the press has taken hold: 0.94 of itself.
    img.getBoundingClientRect = rect(9, 6, 282, 188);
    pointer("pointermove", source, { clientX: 200, clientY: 200 });

    expect(previewNode()!.style.width).toBe("300px");
    expect(previewNode()!.style.height).toBe("200px");
    // Grabbed 10 in from a photo at the origin, so it still trails by 10.
    expect(previewNode()!.style.translate).toBe("190px 190px");
  });

  it("hands the press straight to the carried photo, with no second dip", () => {
    setup(items("a", "b"));
    layOutCells();
    const source = press(0, centreOf(0));
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

    type Flight = [Array<Record<string, string>>, KeyframeAnimationOptions];
    const lastFrame = ([frames]: Flight) => frames[frames.length - 1];
    const xy = (value: string) =>
      value.split(" ").map((part) => parseFloat(part) || 0);

    // `drag()` releases dead centre, which leaves no travel to assert; this lets go off centre.
    function dragOffCentre(from: number, to: number) {
      layOutCells();
      const start = centreOf(from);
      const source = press(from, start);
      // A nudge first, so the press clears the drag threshold.
      pointer("pointermove", source, { ...start, clientX: start.clientX + 20 });
      // Short of the target's centre but inside its cell, so both axes have ground to cover.
      const release = {
        clientX: centreOf(to).clientX - 30,
        clientY: centreOf(to).clientY - 30,
      };
      pointer("pointermove", source, release);
      pointer("pointerup", source, release);
      return source;
    }

    function restingPoint() {
      const [travelX, travelY] = animate.mock.calls as [Flight, Flight];
      const [baseX, baseY] = xy(previewNode()!.style.translate);
      const [dx] = xy(lastFrame(travelX).translate);
      const [, dy] = xy(lastFrame(travelY).translate);
      return [baseX + dx, baseY + dy];
    }

    it("flies the photo into the cell it was dropped on", () => {
      const { onReorder } = setup(items("a", "b", "c"));
      dragOffCentre(2, 0);

      expect(onReorder).toHaveBeenCalledExactlyOnceWith(2, 0);

      expect(restingPoint()).toEqual([0, 0]);

      const [, , settle] = animate.mock.calls as [Flight, Flight, Flight];
      expect(lastFrame(settle).width).toBe("100px");
      expect(lastFrame(settle).scale).toBe("1");
      expect(lastFrame(settle).rotate).toBe("0deg");
      expect(previewNode()).not.toBeNull();
    });

    it("bends the travel by easing each axis on its own", () => {
      setup(items("a", "b", "c"));
      dragOffCentre(2, 0);
      const [travelX, travelY] = animate.mock.calls as [Flight, Flight];

      expect(xy(lastFrame(travelX).translate)[1]).toBe(0);
      expect(xy(lastFrame(travelY).translate)[0]).toBe(0);
      expect(xy(lastFrame(travelX).translate)[0]).not.toBe(0);
      expect(xy(lastFrame(travelY).translate)[1]).not.toBe(0);

      expect(travelX[1].composite).toBe("add");
      expect(travelY[1].composite).toBe("add");

      expect(travelX[1].easing).toMatch(/^linear\(/);
      expect(travelY[1].easing).not.toBe(travelX[1].easing);
    });

    it("keeps the overshooting travel off everything that merely settles", () => {
      setup(items("a", "b", "c"));
      dragOffCentre(2, 0);
      const [travelX, travelY, settle] = animate.mock.calls as [
        Flight,
        Flight,
        Flight,
      ];

      for (const [frames] of [travelX, travelY]) {
        expect(frames.every((f) => Object.keys(f).join() === "translate")).toBe(
          true,
        );
      }
      expect(settle[0].some((frame) => "translate" in frame)).toBe(false);
      expect(settle[1].easing).toBe("ease-out");
      expect(settle[1].duration).toBe(travelX[1].duration);
      expect(travelY[1].duration).toBe(travelX[1].duration);
    });

    it("hands back to the grid once it lands", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      finishers.forEach((finish) => finish());
      expect(previewNode()).toBeNull();
    });

    const srcOf = (index: number) =>
      cells()[index].querySelector("img")!.getAttribute("src");

    it("marks the receiving cell for as long as one is in the air", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[0].hasAttribute("data-landing")).toBe(true);
      expect(cells()[2].hasAttribute("data-landing")).toBe(false);
      expect(cells()[1].hasAttribute("data-landing")).toBe(false);
    });

    it("leaves the receiving cell showing its previous photo, not a hole", () => {
      setupLive(items("a", "b", "c"));
      drag(2, 0);

      expect(srcOf(0)).toBe("a");
      expect(cells()[0].querySelector("img")).not.toBeNull();
    });

    it("keeps the vacated slot empty until the flight lands", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[2].hasAttribute("data-dragging")).toBe(true);
    });

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

      expect(srcOf(0)).toBe("c");
      expect(srcOf(2)).toBe("a");
      expect(cells()[2].hasAttribute("data-dragging")).toBe(false);
      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
    });

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

    it("fades the displaced photo up in the vacated slot", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
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

    it("has the blur back up before the photo lands", () => {
      setup(items("a", "b", "c"));
      layOutCells();
      const source = press(2);
      pointer("pointermove", source, centreOf(0));
      expect(grid().hasAttribute("data-reordering")).toBe(true);

      pointer("pointerup", source, centreOf(0));

      expect(grid().hasAttribute("data-reordering")).toBe(false);
      expect(cells()[0].hasAttribute("data-landing")).toBe(true);
      expect(previewNode()).not.toBeNull();
    });

    it("does not wait on the flight or the vacated fade to restore them", () => {
      setup(items("a", "b", "c"));
      drag(2, 0);
      expect(grid().hasAttribute("data-reordering")).toBe(false);

      act(() => finishers.forEach((finish) => finish()));

      expect(cells()[2].hasAttribute("data-arriving")).toBe(true);
      expect(grid().hasAttribute("data-reordering")).toBe(false);
    });

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

  it("abandons the drag on Escape", () => {
    const { onReorder } = setup(items("a", "b", "c"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, centreOf(2));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(previewNode()).toBeNull();
    expect(cells().some((c) => c.hasAttribute("data-dragging"))).toBe(false);

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

describe("CollectionGrid slot identity", () => {
  it("keeps a cell's DOM node across a swap of its contents", () => {
    const props = {
      onFeature: vi.fn(),
      onReplace: vi.fn(),
      onRemove: vi.fn(),
      onAddImage: vi.fn(),
      onReorder: vi.fn(),
      onItemsChange: vi.fn(),
    };
    const { rerender } = render(
      <CollectionGrid items={items("a", "b", "c")} {...props} />,
    );
    const [slot0, slot1] = cells();

    rerender(<CollectionGrid items={items("c", "b", "a")} {...props} />);

    expect(cells()[0]).toBe(slot0);
    expect(cells()[1]).toBe(slot1);
    expect(document.contains(slot0)).toBe(true);
    expect(cells()[0].querySelector("img")!.getAttribute("src")).toBe("c");
  });
});

const propertiesButton = (index: number) =>
  within(toolbarFor(index)).getByRole("button", { name: "Image properties" });

const panel = () => screen.queryByRole("dialog", { name: "Media properties" });

const panelProps = () => ({
  onFeature: vi.fn(),
  onReplace: vi.fn(),
  onRemove: vi.fn(),
  onAddImage: vi.fn(),
  onReorder: vi.fn(),
  onItemsChange: vi.fn(),
});

describe("CollectionGrid properties panel", () => {
  it("offers the control on every filled cell", () => {
    setup(items("a", "b"));
    expect(propertiesButton(0)).toBeDefined();
    expect(propertiesButton(1)).toBeDefined();
  });

  it("opens without touching the picture", async () => {
    const { user, onItemsChange } = setup(items("a", "b"));
    expect(panel()).toBeNull();

    await user.click(propertiesButton(1));

    expect(panel()).not.toBeNull();
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("stands the addressed cell's overlay down, and only that one", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    expect(cells()[1].hasAttribute("data-properties-open")).toBe(true);
    expect(cells()[0].hasAttribute("data-properties-open")).toBe(false);
    expect(
      document.querySelectorAll("[data-properties-open]"),
    ).toHaveLength(1);
  });

  it("closes from the header without taking anything away", async () => {
    const { user, onItemsChange } = setup([
      picture("a", {
        caption: "A note",
        backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
      }),
    ]);
    await user.click(propertiesButton(0));

    await user.click(
      screen.getByRole("button", { name: "Close properties panel" }),
    );

    // The panel plays its closing slide before the grid drops it.
    await waitFor(() => expect(panel()).toBeNull());
    expect(onItemsChange).not.toHaveBeenCalled();
    expect(document.querySelectorAll("[data-background-effect]")).toHaveLength(1);
  });

  it("closes on Escape", async () => {
    const { user } = setup([
      picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
    ]);
    await user.click(propertiesButton(0));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(panel()).toBeNull());
    expect(cells()[0].hasAttribute("data-properties-open")).toBe(false);
  });

  it("reads pressed only while its own panel is open", async () => {
    const { user } = setup([
      {
        type: "media",
        kind: "image",
        src: "a",
        caption: "A note",
        backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
      },
      picture("b"),
    ]);
    expect(propertiesButton(0).getAttribute("aria-pressed")).toBe("false");

    await user.click(propertiesButton(1));

    expect(propertiesButton(1).getAttribute("aria-pressed")).toBe("true");
    expect(propertiesButton(0).getAttribute("aria-pressed")).toBe("false");
  });

  it("closes the panel when its own button is pressed again", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));
    expect(panel()).not.toBeNull();

    await user.click(propertiesButton(1));

    await waitFor(() => expect(panel()).toBeNull());
  });

  it("asks the panel to leave rather than yanking it", async () => {
    const { user } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(propertiesButton(1));

    expect(panel()).not.toBeNull();
    expect(panel()!.className).toMatch(/properties-panel__exiting/);
    await waitFor(() => expect(panel()).toBeNull());
  });

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
      picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
      picture("b"),
    ]);
    const layers = document.querySelectorAll("[data-background-effect]");
    expect(layers).toHaveLength(1);
    expect(cells()[0].querySelector("[data-background-effect]")).not.toBeNull();
  });

  it("follows its image when the collection is reordered", async () => {
    const seeded: CollectionItem[] = [
      picture("a"),
      picture("b", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
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
      picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
      picture("b"),
    ];
    const props = panelProps();
    const { rerender } = render(<CollectionGrid items={seeded} {...props} />);
    await userEvent.setup().click(propertiesButton(0));
    expect(panel()).not.toBeNull();

    rerender(<CollectionGrid items={[seeded[1]]} {...props} />);
    expect(panel()).toBeNull();
  });

  it("routes a caption typed in the panel to the addressed image", async () => {
    const { user, onItemsChange } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(screen.getByRole("button", { name: "Add caption" }));
    await user.type(
      screen.getByRole("textbox", { name: "Image caption" }),
      "Hi",
    );

    expect(onItemsChange).toHaveBeenLastCalledWith([
      picture("a"),
      picture("b", { caption: "Hi" }),
    ]);
  });

  it("routes a background added in the panel to the addressed image", async () => {
    const { user, onItemsChange } = setup(items("a", "b"));
    await user.click(propertiesButton(1));

    await user.click(screen.getByRole("button", { name: "Add background" }));

    expect(onItemsChange).toHaveBeenCalledExactlyOnceWith([
      picture("a"),
      picture("b", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
    ]);
  });
});

describe("CollectionGrid hover after a drop", () => {
  const idle = () => grid().hasAttribute("data-pointer-idle");

  const movePointer = (at: { clientX: number; clientY: number }) => {
    const event = new MouseEvent("pointermove", { bubbles: true, ...at });
    Object.defineProperty(event, "pointerId", { value: 1 });
    fireEvent(document, event);
  };

  it("holds the overlay down where a drag left the cursor", () => {
    setup(items("a", "b", "c"));
    expect(idle()).toBe(false);

    drag(0, 1);

    expect(idle()).toBe(true);
  });

  it("brings it back as soon as the pointer actually moves", () => {
    setup(items("a", "b", "c"));
    drag(0, 1);

    movePointer({ clientX: centreOf(1).clientX + 5, clientY: centreOf(1).clientY });

    expect(idle()).toBe(false);
  });

  it("is not woken by a move that goes nowhere", () => {
    setup(items("a", "b", "c"));
    drag(0, 1);

    movePointer(centreOf(1));

    expect(idle()).toBe(true);
  });

  it("gives way to the keyboard", () => {
    setup(items("a", "b", "c"));
    drag(0, 1);

    fireEvent.focusIn(toolbarFor(1));

    expect(idle()).toBe(false);
  });

  it("leaves a press that never travelled alone", () => {
    setup(items("a", "b", "c"));
    layOutCells();
    const source = press(0);
    pointer("pointerup", source, centreOf(0));

    expect(idle()).toBe(false);
  });

  it("holds it down for an abandoned drag too", () => {
    setup(items("a", "b", "c"));
    layOutCells();
    const source = press(0);
    pointer("pointermove", source, { clientX: 250, clientY: 50 });
    pointer("pointercancel", source, { clientX: 250, clientY: 50 });

    expect(idle()).toBe(true);
  });
});

describe("CollectionGrid transparency checkerboard", () => {
  const imageAt = (index: number) => cells()[index].querySelector("img")!;

  it("stands a see-through picture on a checkerboard", () => {
    transparentSrcs.add("a");
    setup(items("a", "b"));

    expect(imageAt(0).dataset.checkered).toBe("");
  });

  it("leaves an opaque picture alone", () => {
    setup(items("a", "b"));

    expect(imageAt(0).dataset.checkered).toBeUndefined();
  });

  it("yields to a background effect", () => {
    transparentSrcs.add("a");
    setup([picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT })]);

    expect(imageAt(0).dataset.checkered).toBeUndefined();
    expect(cells()[0].querySelector("[data-background-effect]")).not.toBeNull();
  });

  it("never asks whether a clip is see-through", () => {
    setup([...items("a.png"), ...clips("8f2c-key")]);

    expect(askedAbout.at(-1)).toEqual(["a.png"]);
  });

  it("follows its picture across a reorder", () => {
    transparentSrcs.add("a");
    setupLive(items("a", "b", "c"));

    drag(0, 2);

    expect(imageAt(2).getAttribute("src")).toBe("a");
    expect(imageAt(2).dataset.checkered).toBe("");
    expect(imageAt(0).dataset.checkered).toBeUndefined();
  });
});

describe("CollectionGrid drag clone corner", () => {
  const preview = () =>
    document.body.querySelector<HTMLElement>(
      '[class*="collection-grid__dragPreview"]',
    );

  const lift = (index: number) => {
    layOutCells();
    const source = press(index, centreOf(index));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });
    return source;
  };

  it("leaves the card's corner to the clone's class for a picture that fills its slot", () => {
    setup([picture("a", { borderRadius: 20 }), picture("b")]);
    const source = lift(0);

    expect(preview()!.style.borderRadius).toBe("");

    pointer("pointerup", source, centreOf(0));
  });

  it("resolves an inset picture's own corner to pixels", () => {
    setup([picture("a", { borderRadius: 20, padding: 32 }), picture("b")]);
    const source = lift(0);

    // 20 of 640, against the 100px box `layOutCells` states.
    expect(preview()!.style.borderRadius).toBe("3.125px");

    pointer("pointerup", source, centreOf(0));
  });

  it("carries a square inset picture square", () => {
    setup([picture("a", { padding: 32 }), picture("b")]);
    const source = lift(0);

    expect(preview()!.style.borderRadius).toBe("0px");

    pointer("pointerup", source, centreOf(0));
  });
});

describe("CollectionGrid background effect travels with the photo", () => {
  const preview = () =>
    document.body.querySelector<HTMLElement>(
      '[class*="collection-grid__dragPreview"]',
    );

  beforeEach(() => {
    // jsdom's canvas has no 2D/WebGL backend, so the readback is stubbed.
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,SNAPSHOT",
    );
  });

  it("paints the gradient onto the clone that rides the cursor", () => {
    setup([
      picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
      picture("b"),
    ]);
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });

    expect(preview()!.style.backgroundImage).toContain("SNAPSHOT");
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

  it("carries the checkerboard onto the clone", () => {
    transparentSrcs.add("a");
    setup(items("a", "b"));
    layOutCells();
    const source = press(0, centreOf(0));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });

    expect(preview()!.dataset.checkered).toBe("");

    pointer("pointerup", source, centreOf(0));
  });

  it("carries a clip mid-frame rather than restarting it", () => {
    setup([...clips("a.mp4"), ...items("b")]);
    layOutCells();
    const clip = mediaIn(cells()[0]) as HTMLVideoElement;
    Object.defineProperty(clip, "currentTime", { value: 4, writable: true });

    const source = press(0, centreOf(0));
    pointer("pointermove", source, { clientX: 60, clientY: 50 });

    const flying = preview() as HTMLVideoElement;
    expect(flying.tagName).toBe("VIDEO");
    expect(flying.muted).toBe(true);
    expect(flying.currentTime).toBe(4);

    pointer("pointerup", source, centreOf(0));
  });

  it("still drags when the snapshot cannot be read", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      throw new Error("context lost");
    });
    const { onReorder } = setup([
      picture("a", { backgroundEffect: DEFAULT_BACKGROUND_EFFECT }),
      picture("b"),
    ]);

    drag(0, 1);

    expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 1);
  });
});

describe("CollectionGrid clips", () => {
  it("shows an item declared a clip as a video, and a picture as an <img>", () => {
    setup([...clips("demo.mp4"), ...items("shot.png")]);

    expect(mediaIn(cells()[0])?.tagName).toBe("VIDEO");
    expect(mediaIn(cells()[1])?.tagName).toBe("IMG");
  });

  it("shows a clip stored under an extensionless key as a video", () => {
    setup([{ type: "media", kind: "video", src: "media/8f2c-4b1e-key" }]);
    expect(mediaIn(cells()[0])?.tagName).toBe("VIDEO");
  });

  it("hands a clip the same grip a photo has", () => {
    const { onReorder } = setup([...clips("demo.mp4"), ...items("b", "c")]);

    drag(0, 2);

    expect(onReorder).toHaveBeenCalledExactlyOnceWith(0, 2);
  });

  it("gives a cell's clip no transport of its own", () => {
    setup(clips("demo.mp4"));

    expect(mediaIn(cells()[0])?.hasAttribute("controls")).toBe(false);
  });
});
