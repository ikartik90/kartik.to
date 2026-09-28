// @vitest-environment jsdom
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BACKGROUND_EFFECT, type MediaNode } from "@/domain/nodes";
import { moveItem } from "@/utils/collection-items";

vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({ className }: { className?: string }) => (
    <div data-background-effect="" className={className}>
      <canvas />
    </div>
  ),
}));

vi.mock("@/hooks/use-image-transparency", () => ({
  useImageTransparency: () => new Set<string>(),
}));

import { EditableCarousel } from "../editable-carousel";

// jsdom lays nothing out, so the geometry is stated: a 1000px scroller whose track starts 240px in,
// slides 200 × 400 and 20px apart, each halved (100 × 200) while a reorder runs.
const VIEW = 1000;
const PAD = 240;
const GAP = 20;
const FULL = 200;
/** The strip with its captions, as laid out before a drag. */
const TRACK_HEIGHT = 460;

const SLIDE = "[data-carousel-slide]";
const reordering = (element: Element) =>
  element.closest("[data-reordering]") !== null;
const slideWidth = (element: Element) =>
  reordering(element) ? FULL / 2 : FULL;

const scroller = () =>
  document.querySelector<HTMLElement>("[data-carousel-scroller]")!;
const slides = () =>
  Array.from(document.querySelectorAll<HTMLElement>(SLIDE));

function layout(slide: Element) {
  const index = slides().indexOf(slide as HTMLElement);
  const width = slideWidth(slide);
  return { left: PAD + index * (width + GAP), width, height: width * 2 };
}

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
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  Element.prototype.scrollTo = vi.fn();

  Object.defineProperties(HTMLElement.prototype, {
    offsetLeft: {
      configurable: true,
      get() {
        return this.matches(SLIDE) ? layout(this).left : 0;
      },
    },
    offsetWidth: {
      configurable: true,
      get() {
        return this.matches(SLIDE) ? layout(this).width : 0;
      },
    },
    clientWidth: {
      configurable: true,
      get() {
        return this.matches("[data-carousel-scroller]") ? VIEW : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get() {
        if (!this.matches("[data-carousel-scroller]")) return 0;
        const all = slides();
        const width = all[0] ? slideWidth(all[0]) : 0;
        return PAD * 2 + all.length * (width + GAP) - GAP;
      },
    },
  });

  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.matches("[data-carousel-scroller]")) return box(0, 0, VIEW, 420);
    const slide = this.closest(SLIDE);
    if (!slide) return box(0, 0, 0, 0);
    const { left, width, height } = layout(slide);
    return box(left - scroller().scrollLeft, 0, width, height);
  };

  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = originalGetComputedStyle(element, pseudo);
    const overrides: Record<string, string> = element.matches(
      "[data-carousel-scroller]",
    )
      ? { scrollPaddingInlineStart: "400px" }
      : element.parentElement?.matches("[data-carousel-scroller]")
        ? {
            columnGap: `${GAP}px`,
            paddingInlineStart: `${PAD}px`,
            height: `${TRACK_HEIGHT}px`,
          }
        : {};
    return new Proxy(style, {
      get: (target, key) =>
        typeof key === "string" && key in overrides
          ? overrides[key]
          : Reflect.get(target, key, target),
    });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const items = (...srcs: string[]): MediaNode[] =>
  srcs.map((src) => ({ type: "media", kind: "image", src }));

function handlers() {
  return {
    onFeature: vi.fn(),
    onReplace: vi.fn(),
    onRemove: vi.fn(),
    onAddImage: vi.fn(),
    onReorder: vi.fn(),
    onItemsChange: vi.fn(),
  };
}

function setup(list: MediaNode[]) {
  const on = handlers();
  render(<EditableCarousel items={list} {...on} />);
  // jsdom's scrollLeft is always 0.
  Object.defineProperty(scroller(), "scrollLeft", {
    configurable: true,
    writable: true,
    value: 0,
  });
  return on;
}

// Over real state, so a reorder actually moves the items.
function setupLive(list: MediaNode[]) {
  const on = handlers();
  function Harness() {
    const [current, setCurrent] = useState(list);
    return (
      <EditableCarousel
        items={current}
        {...on}
        onReorder={(from, to) => setCurrent((was) => moveItem(was, from, to))}
      />
    );
  }
  render(<Harness />);
  Object.defineProperty(scroller(), "scrollLeft", {
    configurable: true,
    writable: true,
    value: 0,
  });
  return on;
}

const root = () => document.querySelector<HTMLElement>("[data-carousel]")!;
const cells = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-media-cell]"));
const toolbarFor = (index: number) =>
  screen.getByRole("toolbar", { name: `Image ${index + 1} actions` });

// jsdom has no PointerEvent, so a MouseEvent carries the pointer fields. Moves and releases go to
// the pressed cell, as pointer capture would send them.
function pointer(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: Element,
  clientX: number,
  clientY = 100,
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
}

const centreOf = (index: number) => {
  const { left, width } = slides()[index].getBoundingClientRect();
  return left + width / 2;
};

/** Presses slide `index` at its centre and nudges past the drag threshold; returns the cell. */
function pickUp(index: number) {
  const cell = cells()[index];
  const x = centreOf(index);
  pointer("pointerdown", cell.querySelector("img")!, x);
  pointer("pointermove", cell, x + 20);
  return cell;
}

describe("EditableCarousel", () => {
  it("shows every image as a slide, then one add tile at the end", () => {
    setup(items("a", "b", "c"));
    expect(screen.getAllByRole("toolbar")).toHaveLength(3);
    const add = screen.getAllByRole("button", { name: "Add image" });
    expect(add).toHaveLength(1);
    expect(slides().at(-1)).toBe(add[0]);
  });

  it("shapes an inset slide as the lightbox frames it, band on every side", () => {
    setup([{ ...items("a")[0], width: 1600, height: 1000, padding: 40 }]);
    expect(
      parseFloat(slides()[0].style.getPropertyValue("--slide-aspect")),
    ).toBeCloseTo(
      1 / (0.875 / 1.6 + 0.125),
      10,
    );
  });

  it("offers only the add tile before there are any images", () => {
    setup([]);
    expect(screen.queryAllByRole("toolbar")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Add image" })).toBeDefined();
  });

  it("opens the picker from the add tile", async () => {
    const on = setup(items("a"));
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Add image" }),
    );
    expect(on.onAddImage).toHaveBeenCalledTimes(1);
  });

  it("features, replaces and removes the addressed image", async () => {
    const user = userEvent.setup();
    const on = setup(items("a", "b", "c"));
    await user.click(
      within(toolbarFor(2)).getByRole("button", { name: "Feature image" }),
    );
    await user.click(
      within(toolbarFor(1)).getByRole("button", { name: "Replace image" }),
    );
    await user.click(
      within(toolbarFor(0)).getByRole("button", { name: "Remove image" }),
    );
    expect(on.onFeature).toHaveBeenCalledWith(2);
    expect(on.onReplace).toHaveBeenCalledWith(1);
    expect(on.onRemove).toHaveBeenCalledWith(0);
  });

  it("leaves a slide's caption style to its carousel", async () => {
    setup([{ type: "media", kind: "image", src: "a", caption: "A note" }]);
    await userEvent.setup().click(
      within(toolbarFor(0)).getByRole("button", { name: "Image properties" }),
    );
    expect(screen.getByRole("textbox", { name: "Image caption" })).toBeDefined();
    expect(screen.queryByRole("listbox", { name: "Caption style" })).toBeNull();
  });

  describe("its slides' captions", () => {
    const captioned: MediaNode[] = [
      { type: "media", kind: "image", src: "a", caption: "A note" },
      { type: "media", kind: "image", src: "b" },
    ];
    const slideCaptions = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(`${SLIDE} > figcaption`),
      );

    it("are not shown unless asked", () => {
      render(<EditableCarousel items={captioned} {...handlers()} />);
      expect(slideCaptions()).toHaveLength(0);
    });

    it("sit beneath their pictures in the carousel's style", () => {
      render(
        <EditableCarousel
          items={captioned}
          {...handlers()}
          showCaptions
          captionStyle="subheading"
        />,
      );
      const [caption, ...rest] = slideCaptions();
      expect(rest).toHaveLength(0);
      expect(caption.textContent).toBe("A note");
      expect(
        caption.previousElementSibling!.querySelector("[data-media-cell]"),
      ).not.toBeNull();
      expect(caption.classList.contains("textStyle_subheading")).toBe(true);
    });
  });

  it("draws its slides at the size it is given", () => {
    render(<EditableCarousel items={items("a")} {...handlers()} size="small" />);
    expect(root().className).toMatch(/size_small/);
  });

  it("opens the properties panel without touching the picture", async () => {
    const on = setup(items("a"));
    await userEvent.setup().click(
      within(toolbarFor(0)).getByRole("button", { name: "Image properties" }),
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(on.onItemsChange).not.toHaveBeenCalled();
  });
});

describe("EditableCarousel reordering", () => {
  it("leaves a press that never travels far enough alone", () => {
    const on = setup(items("a", "b"));
    const cell = cells()[0];
    pointer("pointerdown", cell.querySelector("img")!, 340);
    pointer("pointermove", cell, 342);
    pointer("pointerup", cell, 342);
    expect(root().hasAttribute("data-reordering")).toBe(false);
    expect(on.onReorder).not.toHaveBeenCalled();
  });

  it("does not start a drag from a slide's controls", () => {
    setup(items("a", "b"));
    const button = within(toolbarFor(0)).getByRole("button", {
      name: "Image properties",
    });
    pointer("pointerdown", button, 340);
    pointer("pointermove", button, 400);
    expect(root().hasAttribute("data-reordering")).toBe(false);
  });

  it("shrinks the slides once a press becomes a drag", () => {
    setup(items("a", "b", "c"));
    pickUp(0);
    expect(root().hasAttribute("data-reordering")).toBe(true);
  });

  it("holds the strip's height while the captions are gone, letting go on the drop", () => {
    setup(items("a", "b"));
    const track = scroller().firstElementChild as HTMLElement;
    const cell = pickUp(0);
    expect(track.style.minHeight).toBe(`${TRACK_HEIGHT}px`);
    pointer("pointerup", cell, centreOf(1));
    expect(track.style.minHeight).toBe("");
  });

  it("leaves the carried slide's place empty, where it will land", () => {
    setup(items("a", "b"));
    const cell = pickUp(0);
    expect(cell.hasAttribute("data-dragging")).toBe(true);
    expect(cells()[1].hasAttribute("data-dragging")).toBe(false);
  });

  it("carries a copy of the slide on the page, not a browser drag image", () => {
    setup(items("a", "b"));
    pickUp(0);
    const carried = document.body.querySelector(":scope > [data-carried]")!;
    const picture = carried.querySelector("img");
    expect(picture?.getAttribute("src")).toBe("a");
    expect(picture).not.toBe(cells()[0].querySelector("img"));
  });

  it("carries the slide's shader along with its picture", () => {
    const drawn: CanvasImageSource[] = [];
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: (source: CanvasImageSource) => drawn.push(source),
    })) as unknown as HTMLCanvasElement["getContext"];
    setup([
      {
        type: "media",
        kind: "image",
        src: "a",
        padding: 40,
        backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
      },
      ...items("b"),
    ]);
    const shader = cells()[0].querySelector("[data-background-effect] canvas");
    pickUp(0);

    const carried = document.body.querySelector(":scope > [data-carried]")!;
    expect(carried.firstElementChild?.tagName).toBe("CANVAS");
    expect(drawn).toEqual([shader]);
    expect(carried.querySelector("img")).not.toBeNull();
  });

  it("carries a clip's current frame until its copy can play", () => {
    const drawn: CanvasImageSource[] = [];
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: (source: CanvasImageSource) => drawn.push(source),
    })) as unknown as HTMLCanvasElement["getContext"];
    render(
      <EditableCarousel
        items={[
          { type: "media", kind: "video", src: "/a.mp4" },
          { type: "media", kind: "video", src: "/b.mp4" },
        ]}
        {...handlers()}
      />,
    );
    Object.defineProperty(scroller(), "scrollLeft", {
      configurable: true,
      writable: true,
      value: 0,
    });
    const cell = cells()[0];
    const x = centreOf(0);
    pointer("pointerdown", cell.querySelector("video")!, x);
    pointer("pointermove", cell, x + 20);

    const carried = document.body.querySelector(":scope > [data-carried]")!;
    const clip = carried.querySelector("video")!;
    expect(clip.previousElementSibling?.tagName).toBe("CANVAS");
    expect(drawn).toEqual([cell.querySelector("video")]);
  });

  it("keeps the carried slide's place under the pointer as the slides shrink", () => {
    setup(items("a", "b", "c", "d", "e", "f", "g", "h"));
    scroller().scrollLeft = 500;
    // Slide 3 sits at 900–1100 in the track, so at 400–600 on screen; halved, at 600–700.
    pickUp(3);
    // Its middle, 650, under the pointer at 520.
    expect(scroller().scrollLeft).toBe(130);
  });

  it("moves the carried slide past each slide whose middle it crosses", () => {
    const on = setup(items("a", "b", "c"));
    const cell = pickUp(0);
    // Halved, the slides' middles are at 290, 410 and 530. The strip can't scroll back to keep the
    // first one's middle under the pointer at 360, so its place counts from 70px left of the pointer.
    pointer("pointermove", cell, 470);
    expect(slides().map((slide) => slide.style.translate)).toEqual([
      "",
      "",
      "",
      "",
    ]);
    pointer("pointermove", cell, 610);
    expect(slides().map((slide) => slide.style.translate)).toEqual([
      "240px 0px",
      "-120px 0px",
      "-120px 0px",
      "",
    ]);

    pointer("pointerup", cell, 610);
    expect(on.onReorder).toHaveBeenCalledWith(0, 2);
  });

  it("moves nothing when dropped where it started", () => {
    const on = setup(items("a", "b", "c"));
    const cell = pickUp(1);
    pointer("pointerup", cell, centreOf(1));
    expect(on.onReorder).not.toHaveBeenCalled();
  });

  it("brings the slides back to full size once dropped", () => {
    setup(items("a", "b"));
    const cell = pickUp(0);
    pointer("pointerup", cell, 300);
    expect(root().hasAttribute("data-reordering")).toBe(false);
    expect(slides().map((slide) => slide.style.translate)).toEqual([
      "",
      "",
      "",
    ]);
    expect(document.body.querySelector(":scope > [data-carried]")).toBeNull();
  });

  it("abandons the drag on Escape", () => {
    const on = setup(items("a", "b", "c"));
    const cell = pickUp(0);
    pointer("pointermove", cell, 610);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(root().hasAttribute("data-reordering")).toBe(false);
    expect(document.body.querySelector(":scope > [data-carried]")).toBeNull();

    pointer("pointerup", cell, 610);
    expect(on.onReorder).not.toHaveBeenCalled();
  });

  it("puts everything back when the gesture is cancelled", () => {
    const on = setup(items("a", "b", "c"));
    const cell = pickUp(0);
    pointer("pointermove", cell, 610);
    pointer("pointercancel", cell, 610);
    expect(root().hasAttribute("data-reordering")).toBe(false);
    expect(on.onReorder).not.toHaveBeenCalled();
  });

  it("keeps each slide's element as the order changes", () => {
    setupLive(items("a", "b", "c"));
    const carried = document.querySelector('img[src="a"]');
    const cell = pickUp(0);
    pointer("pointermove", cell, 610);
    pointer("pointerup", cell, 610);
    const moved = document.querySelectorAll("[data-media-cell] img");
    expect(Array.from(moved, (img) => img.getAttribute("src"))).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(moved[2]).toBe(carried);
  });

  it("holds the snap off while a dropped picture is still landing", () => {
    const flights: Animation[] = [];
    Element.prototype.animate = vi.fn(function () {
      const flight = { onfinish: null, oncancel: null } as unknown as Animation;
      flights.push(flight);
      return flight;
    });
    setup(items("a", "b"));
    const cell = pickUp(0);
    pointer("pointerup", cell, 300);
    expect(root().hasAttribute("data-settling")).toBe(true);

    // The flight is the one animation something waits on.
    const flight = flights.find((each) => each.onfinish)!;
    act(() => flight.onfinish?.(new Event("finish") as AnimationPlaybackEvent));
    expect(root().hasAttribute("data-settling")).toBe(false);
    expect(document.body.querySelector(":scope > [data-carried]")).toBeNull();
  });

  it("gives a slow flight time to land before taking the copy away", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    Element.prototype.animate = vi.fn(
      () => ({ onfinish: null, oncancel: null }) as unknown as Animation,
    );
    setup(items("a", "b"));
    const cell = pickUp(0);
    pointer("pointerup", cell, 300);

    act(() => vi.advanceTimersByTime(400));
    expect(document.body.querySelector(":scope > [data-carried]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(document.body.querySelector(":scope > [data-carried]")).toBeNull();
  });

  it("keeps the controls down after a drop until the pointer moves", () => {
    setup(items("a", "b"));
    const cell = pickUp(0);
    pointer("pointerup", cell, 300);
    expect(root().hasAttribute("data-pointer-idle")).toBe(true);
    fireEvent.pointerMove(document, { clientX: 500, clientY: 100 });
    expect(root().hasAttribute("data-pointer-idle")).toBe(false);
  });

  describe("near an edge", () => {
    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
      });
    });

    const frames = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    it("scrolls on while the carried slide is held by the right edge", () => {
      setup(items("a", "b", "c", "d", "e", "f"));
      const cell = pickUp(0);
      pointer("pointermove", cell, 990);
      frames(200);
      expect(scroller().scrollLeft).toBeGreaterThan(0);
    });

    it("scrolls back by the left edge", () => {
      setup(items("a", "b", "c", "d", "e", "f", "g", "h", "i", "j"));
      scroller().scrollLeft = 1000;
      const cell = pickUp(5);
      const from = scroller().scrollLeft;
      pointer("pointermove", cell, 10);
      frames(200);
      expect(scroller().scrollLeft).toBeLessThan(from);
    });

    it("holds still away from the edges", () => {
      setup(items("a", "b", "c", "d", "e", "f"));
      const cell = pickUp(0);
      pointer("pointermove", cell, 990);
      frames(100);
      pointer("pointermove", cell, 500);
      const held = scroller().scrollLeft;
      frames(200);
      expect(scroller().scrollLeft).toBe(held);
    });

    it("carries the slide past the ones the scroll brings under the pointer", () => {
      const on = setup(items("a", "b", "c", "d", "e", "f"));
      const cell = pickUp(0);
      pointer("pointermove", cell, 990);
      frames(1000);
      pointer("pointerup", cell, 990);
      expect(on.onReorder).toHaveBeenCalledWith(0, 5);
    });
  });
});
