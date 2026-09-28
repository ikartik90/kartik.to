// @vitest-environment jsdom
import { StrictMode } from "react";
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

// StaticMeshGradient is WebGL, which jsdom can't run: a marker element carries its colours.
vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: ({
    colors,
    className,
    style,
  }: {
    colors: string[];
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-background-effect=""
      data-colors={colors.join(",")}
      className={className}
      // Keeps `style`: it carries the corner.
      style={style}
    >
      <canvas />
    </div>
  ),
}));

import { MediaCarousel } from "../media-carousel";

const SCROLLER = "[data-carousel-scroller]";

// jsdom does no layout, so each test states the geometry the browser would measure.
let geometry = {
  clientWidth: 1440,
  scrollWidth: 3100,
  slideStarts: [240, 900, 1560, 2220],
  inset: "400px",
};

const originalGetComputedStyle = window.getComputedStyle;

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  // As the platform: `close()` fires `close`, and `showModal()` throws on an open dialog.
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    if (this.open) {
      throw new DOMException("Already open", "InvalidStateError");
    }
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
  Element.prototype.scrollTo = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: {
      configurable: true,
      get() {
        return this.matches(SCROLLER) ? geometry.clientWidth : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get() {
        return this.matches(SCROLLER) ? geometry.scrollWidth : 0;
      },
    },
    offsetLeft: {
      configurable: true,
      get() {
        if (!this.matches("[data-carousel-slide]")) return 0;
        const index = Array.from(this.parentElement!.children).indexOf(this);
        return geometry.slideStarts[index] ?? 0;
      },
    },
  });

  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = originalGetComputedStyle(element, pseudo);
    if (!element.matches(SCROLLER)) return style;
    return new Proxy(style, {
      get: (target, key) =>
        key === "scrollPaddingInlineStart"
          ? geometry.inset
          : Reflect.get(target, key, target),
    });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  geometry = {
    clientWidth: 1440,
    scrollWidth: 3100,
    slideStarts: [240, 900, 1560, 2220],
    inset: "400px",
  };
});

const items = (count: number): MediaNode[] =>
  Array.from({ length: count }, (_, i) => ({
    type: "media",
    kind: "image",
    src: `/img/${i}.jpg`,
    alt: `Image ${i + 1}`,
    width: 1600,
    height: 1000,
  }));

const scroller = () => document.querySelector<HTMLElement>(SCROLLER)!;

function scrollTo(left: number) {
  Object.defineProperty(scroller(), "scrollLeft", {
    configurable: true,
    value: left,
  });
  act(() => {
    fireEvent.scroll(scroller());
  });
}

const firstSlide = () =>
  document.querySelector<HTMLElement>("[data-carousel-slide]")!;

const aspectOf = (slide: HTMLElement) =>
  parseFloat(slide.style.getPropertyValue("--slide-aspect"));

describe("MediaCarousel", () => {
  it("renders nothing without items", () => {
    const { container } = render(<MediaCarousel items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows every item as a slide, named by its alt text", () => {
    render(<MediaCarousel items={items(4)} />);
    for (const name of ["Image 1", "Image 2", "Image 3", "Image 4"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("gives each slide its media's shape", () => {
    render(<MediaCarousel items={items(1)} />);
    expect(aspectOf(firstSlide())).toBe(1.6);
  });

  it("shapes an inset slide as the lightbox frames it, band on every side", () => {
    render(<MediaCarousel items={[{ ...items(1)[0], padding: 40 }]} />);
    expect(aspectOf(firstSlide())).toBeCloseTo(1 / (0.875 / 1.6 + 0.125), 10);
  });

  it("opens the lightbox on the slide pressed", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={items(4)} />);
    await user.click(screen.getByRole("button", { name: "Image 3" }));
    const dialog = screen.getByRole("dialog", { name: "Image 3" });
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  describe("pinching", () => {
    const pinch = (deltaY: number) =>
      act(() => {
        scroller().dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY,
            clientX: 1000,
            clientY: 200,
          }),
        );
      });

    const layOut = () =>
      document
        .querySelectorAll<HTMLElement>("[data-carousel-slide]")
        .forEach((slide, i) => {
          slide.getBoundingClientRect = () => new DOMRect(i * 700, 0, 640, 400);
        });

    it("opens the lightbox on the slide a pinch spreads", () => {
      render(<MediaCarousel items={items(4)} />);
      layOut();
      pinch(-10);
      expect(screen.getByRole("dialog", { name: "Image 2" })).toBeTruthy();
    });

    it("leaves a pinch in alone", () => {
      render(<MediaCarousel items={items(4)} />);
      layOut();
      pinch(10);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    describe("in Safari, whose trackpad pinches are gesture events", () => {
      const gesture = (type: string, scale: number) =>
        act(() => {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.assign(event, { scale, clientX: 1000, clientY: 200 });
          scroller().dispatchEvent(event);
        });

      beforeEach(() => vi.stubGlobal("GestureEvent", class {}));
      afterEach(() => vi.unstubAllGlobals());

      it("leaves every wheel to the scroller, so snapping survives a swipe that could go back", () => {
        render(<MediaCarousel items={items(4)} />);
        layOut();
        const wheel = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -10,
          clientX: 1000,
          clientY: 200,
        });
        act(() => {
          scroller().dispatchEvent(wheel);
        });
        expect(wheel.defaultPrevented).toBe(false);
      });

      it("still opens the lightbox on the slide a pinch spreads", () => {
        render(<MediaCarousel items={items(4)} />);
        layOut();
        gesture("gesturestart", 1);
        gesture("gesturechange", 1.2);
        expect(
          screen.getByRole("dialog", { name: "Image 2" }).hasAttribute("open"),
        ).toBe(true);
      });
    });
  });

  describe("stepping", () => {
    it("holds Previous at the start and steps Next to the next slide", async () => {
      const user = userEvent.setup();
      render(<MediaCarousel items={items(4)} />);
      const previous = screen.getByRole("button", { name: "Previous" });
      expect(previous.getAttribute("aria-disabled")).toBe("true");

      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(scroller().scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ left: 500 }),
      );
    });

    it("steps Previous back to the slide before", async () => {
      const user = userEvent.setup();
      render(<MediaCarousel items={items(4)} />);
      scrollTo(1160);

      const previous = screen.getByRole("button", { name: "Previous" });
      expect(previous.getAttribute("aria-disabled")).toBeNull();
      await user.click(previous);
      expect(scroller().scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ left: 500 }),
      );
    });

    it("holds Next once the last slide has arrived", async () => {
      const user = userEvent.setup();
      render(<MediaCarousel items={items(4)} />);
      scrollTo(1660);

      const next = screen.getByRole("button", { name: "Next" });
      expect(next.getAttribute("aria-disabled")).toBe("true");
      await user.click(next);
      expect(scroller().scrollTo).not.toHaveBeenCalled();
    });

    it("offers no stepping when every slide fits", () => {
      geometry = { ...geometry, scrollWidth: 1440 };
      render(<MediaCarousel items={items(2)} />);
      expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    });
  });
});

// Alt text "Image 0", "Image 1"… as the lightbox tests expect.
const named = (count: number): MediaNode[] =>
  Array.from({ length: count }, (_, i) => ({
    type: "media",
    kind: "image",
    src: `/img/${i}.jpg`,
    alt: `Image ${i}`,
  }));

// The lightbox's current item; its neighbours wait beside it, inert.
const current = () =>
  screen
    .getByRole("dialog")
    .querySelector<HTMLElement>("[data-lightbox-slide]:not([inert])")!;

const frame = () => current().querySelector<HTMLElement>("[data-lightbox-frame]")!;

const tiles = () =>
  screen.queryAllByRole("button").filter((el) => el.querySelector("img"));

describe("MediaCarousel slides", () => {
  it("falls back to the caption for alt text", () => {
    render(
      <MediaCarousel
        items={[
          { type: "media", kind: "image", src: "/a.jpg", caption: "A caption" },
        ]}
      />,
    );
    expect(screen.getByAltText("A caption")).toBeDefined();
  });

  it("hands the slide and its ground no corner off the picture", () => {
    render(
      <MediaCarousel
        items={[
          {
            type: "media",
            kind: "image",
            src: "/a.jpg",
            borderRadius: 20,
            backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
          },
        ]}
      />,
    );
    const slide = tiles()[0].parentElement!;
    expect(slide.style.borderRadius).toBe("");
    expect(
      slide.querySelector<HTMLElement>("[data-background-effect]")!.style
        .borderRadius,
    ).toBe("");
  });
});

describe("MediaCarousel settings", () => {
  const captioned = (): MediaNode[] => [
    { type: "media", kind: "image", src: "/a.jpg", alt: "A", caption: "First" },
    { type: "media", kind: "image", src: "/b.jpg", alt: "B" },
  ];

  const slideCaptions = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-carousel-slide] > figcaption",
      ),
    );

  it("draws its slides at the size it is given", () => {
    render(<MediaCarousel items={items(2)} size="large" />);
    expect(
      document.querySelector("[data-carousel]")!.className,
    ).toMatch(/size_large/);
  });

  it("shows no captions beneath its slides unless asked", () => {
    render(<MediaCarousel items={captioned()} />);
    expect(slideCaptions()).toHaveLength(0);
  });

  it("shows each slide's caption beneath its picture, as a caption by default", () => {
    render(<MediaCarousel items={captioned()} showCaptions />);
    const [caption, ...rest] = slideCaptions();
    expect(rest).toHaveLength(0);
    expect(caption.textContent).toBe("First");
    expect(caption.previousElementSibling!.matches("[data-media-surface]")).toBe(
      true,
    );
    expect(caption.classList.contains("textStyle_caption")).toBe(true);
  });

  it("draws every slide's caption in the carousel's style, not the slide's own", () => {
    render(
      <MediaCarousel
        items={[{ ...captioned()[0], captionStyle: "subheading" }]}
        showCaptions
        captionStyle="paragraph"
      />,
    );
    expect(slideCaptions()[0].classList.contains("textStyle_bodyLarge")).toBe(
      true,
    );
  });

  describe("with its lightbox off", () => {
    it("shows its slides without making them buttons", () => {
      render(<MediaCarousel items={captioned()} lightbox={false} />);
      expect(screen.getByAltText("A")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "A" })).toBeNull();
    });

    it("has no lightbox to open", () => {
      render(<MediaCarousel items={captioned()} lightbox={false} />);
      expect(document.querySelector("dialog")).toBeNull();
    });
  });
});

describe("MediaCarousel lightbox", () => {
  const openLightbox = async (count: number, tileIndex = 0) => {
    const user = userEvent.setup();
    render(<MediaCarousel items={named(count)} />);
    await user.click(tiles()[tileIndex]);
    return user;
  };

  it("opens on the tile that was clicked", async () => {
    await openLightbox(5, 1);
    expect(current().querySelector("img")?.getAttribute("alt")).toBe("Image 1");
  });

  it("steps through every image with the arrow keys, not just the tiles", async () => {
    await openLightbox(5, 2);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(current().querySelector("img")?.getAttribute("alt")).toBe("Image 3");
  });

  it("wraps at both ends", async () => {
    await openLightbox(3, 0);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(current().querySelector("img")?.getAttribute("alt")).toBe("Image 2");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(current().querySelector("img")?.getAttribute("alt")).toBe("Image 0");
  });

  it("shows the open image's own caption", async () => {
    const user = userEvent.setup();
    render(
      <MediaCarousel
        items={[
          { type: "media", kind: "image", src: "/a.jpg", alt: "A", caption: "First" },
          { type: "media", kind: "image", src: "/b.jpg", alt: "B", caption: "Second" },
        ]}
      />,
    );
    await user.click(tiles()[0]);
    const dialog = screen.getByRole("dialog");
    expect(current().textContent).toContain("First");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(current().textContent).toContain("Second");
    expect(current().textContent).not.toContain("First");
  });

  it("draws the open image's caption as a caption, whatever the carousel's style", async () => {
    const user = userEvent.setup();
    render(
      <MediaCarousel
        items={[
          {
            type: "media",
            kind: "image",
            src: "/a.jpg",
            alt: "A",
            caption: "First",
            captionStyle: "subheading",
          },
        ]}
        showCaptions
        captionStyle="subheading"
      />,
    );
    await user.click(tiles()[0]);
    const caption = current().querySelector("figcaption")!;
    expect(caption.classList.contains("textStyle_caption")).toBe(true);
  });

  it("caps at the image's natural width once it has loaded", async () => {
    await openLightbox(2, 0);
    const img = current().querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 640, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 480, configurable: true });
    fireEvent.load(img);
    expect(frame().style.getPropertyValue("--frame-max")).toBe("640px");
  });

  it("does not inherit the previous image's shape when you navigate", async () => {
    await openLightbox(2, 0);
    const dialog = screen.getByRole("dialog");
    const first = current().querySelector("img")!;
    Object.defineProperty(first, "naturalWidth", { value: 640, configurable: true });
    Object.defineProperty(first, "naturalHeight", { value: 480, configurable: true });
    fireEvent.load(first);

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(frame().style.getPropertyValue("--frame-max")).toBe("");
  });

  it("closes on Escape", async () => {
    await openLightbox(2, 0);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")?.hasAttribute("open")).toBeFalsy();
  });

  it("closes on a backdrop click", async () => {
    await openLightbox(2, 0);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("survives React's double-invoked effects", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <MediaCarousel items={named(3)} />
      </StrictMode>,
    );
    await user.click(tiles()[0]);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });
});

describe("MediaCarousel lightbox picture", () => {
  const openRounded = async (item: Partial<MediaNode> = {}) => {
    const user = userEvent.setup();
    render(
      <MediaCarousel
        items={[
          { type: "media", kind: "image", src: "/a.jpg", alt: "A", borderRadius: 20, ...item },
          { type: "media", kind: "image", src: "/b.jpg", alt: "B", borderRadius: 8 },
        ]}
      />,
    );
    await user.click(tiles()[0]);
    return screen.getByRole("dialog");
  };

  it("rounds the picture as its tile does, in shares of the frame's width", async () => {
    await openRounded();
    expect(current().querySelector("img")!.style.borderRadius).toBe("3.125cqw");
  });

  it("leaves the card behind it alone", async () => {
    await openRounded({
      backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
    });
    const ground = current().querySelector<HTMLElement>("[data-background-effect]")!;
    expect(ground.style.borderRadius).toBe("");
    expect(current().querySelector("img")!.style.borderRadius).toBe("3.125cqw");
  });

  it("does not carry the previous image's corner across a step", async () => {
    const dialog = await openRounded();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(current().querySelector("img")!.style.borderRadius).toBe("1.25cqw");
  });

  it("leaves a square picture square at any size", async () => {
    await openRounded({ borderRadius: undefined });
    expect(current().querySelector("img")!.style.borderRadius).toMatch(/^0(px)?$/);
  });

  it("insets the picture by its band, a share of the frame's width", async () => {
    await openRounded({ padding: 40 });
    const band = current().querySelector<HTMLElement>("[data-media-box]")!;
    expect(band.style.padding).toBe("6.25%");
  });

  it("sizes the frame for the picture and its band together", async () => {
    await openRounded({ padding: 40 });
    const img = current().querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 640 });
    Object.defineProperty(img, "naturalHeight", { value: 480 });
    fireEvent.load(img);
    expect(frame().style.getPropertyValue("--frame-aspect")).toBe(
      String(1 / (0.875 / (640 / 480) + 0.125)),
    );
    expect(frame().style.getPropertyValue("--frame-max")).toBe(`${640 / 0.875}px`);
  });
});

describe("MediaCarousel clips", () => {
  const clip = {
    type: "media" as const,
    kind: "video" as const,
    src: "/demo.mp4",
    alt: "A demo",
  };

  describe("on screen", () => {
    let report: (slide: Element, ratio: number) => void;

    beforeEach(() => {
      const callbacks: IntersectionObserverCallback[] = [];
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            callbacks.push(callback);
          }
          observe() {}
          unobserve() {}
          disconnect() {}
          takeRecords() {
            return [];
          }
        },
      );
      report = (slide, ratio) =>
        act(() =>
          callbacks.at(-1)!(
            [
              {
                target: slide,
                intersectionRatio: ratio,
                isIntersecting: ratio > 0,
                boundingClientRect: { height: 400 } as DOMRectReadOnly,
                rootBounds: { height: 900 } as DOMRectReadOnly,
              } as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
          ),
        );
    });

    afterEach(() => vi.unstubAllGlobals());

    it("plays a slide's clip only while the whole slide is on screen", () => {
      render(
        <MediaCarousel
          items={[clip, { ...clip, src: "/b.mp4", alt: "B" }]}
        />,
      );
      const [first, second] = document.querySelectorAll<HTMLElement>(
        "[data-carousel-slide]",
      );
      const clipOf = (slide: HTMLElement) => slide.querySelector("video")!;
      const play = vi.mocked(HTMLMediaElement.prototype.play);
      const pause = vi.mocked(HTMLMediaElement.prototype.pause);
      expect(play).not.toHaveBeenCalled();

      report(first, 1);
      report(second, 0.3);
      expect(play.mock.contexts).toEqual([clipOf(first)]);

      report(first, 0.9);
      report(second, 1);
      expect(pause.mock.contexts).toEqual([clipOf(first)]);
      expect(play.mock.contexts).toEqual([clipOf(first), clipOf(second)]);
    });
  });

  it("plays an mp4 tile as a video, still under the tile's own button", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={[clip]} />);

    const tile = screen.getByRole("button", { name: "A demo" });
    expect(tile.querySelector("video")).not.toBeNull();

    await user.click(tile);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("gives a clip tile a chip outside the button that opens the lightbox", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={[clip]} />);

    const tile = screen.getByRole("button", { name: "A demo" });
    const chip = screen.getByRole("button", { name: /video$/ });
    expect(tile.querySelector("video")).not.toBeNull();
    expect(tile.contains(chip)).toBe(false);

    // A closed <dialog> is out of the accessibility tree, so no match by role means it didn't open.
    await user.click(chip);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(tile);
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.querySelector("video")!.hasAttribute("controls")).toBe(false);
    expect(
      within(dialog).getByRole("button", { name: /video$/ }),
    ).toBeTruthy();
  });

  it("shows a clip stored under an extensionless key, in the tile and enlarged", async () => {
    const user = userEvent.setup();
    const keyed = {
      type: "media" as const,
      kind: "video" as const,
      src: "media/8f2c-4b1e-key",
      alt: "A demo",
    };
    render(<MediaCarousel items={[keyed]} />);

    const tile = screen.getByRole("button", { name: "A demo" });
    expect(tile.querySelector("video")).not.toBeNull();

    await user.click(tile);
    expect(screen.getByRole("dialog").querySelector("video")).not.toBeNull();
  });

  it("plays whichever clip the lightbox opens", async () => {
    const user = userEvent.setup();
    render(
      <MediaCarousel
        items={[
          { type: "media", kind: "video", src: "/a.mp4", alt: "A" },
          { type: "media", kind: "video", src: "/b.mp4", alt: "B" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "B" }));
    const opened = screen.getByRole("dialog").querySelector("video")!;
    expect(opened.hasAttribute("autoplay")).toBe(true);
  });

  it("caps the lightbox at the clip's own width", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={[clip]} />);
    await user.click(screen.getByRole("button", { name: "A demo" }));

    const opened = screen.getByRole("dialog").querySelector("video")!;
    Object.defineProperty(opened, "videoWidth", { value: 1280 });
    Object.defineProperty(opened, "videoHeight", { value: 720 });
    fireEvent.loadedMetadata(opened);

    expect(frame().style.getPropertyValue("--frame-max")).toBe("1280px");
  });
});
