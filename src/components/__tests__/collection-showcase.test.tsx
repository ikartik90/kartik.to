// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BACKGROUND_EFFECT, type CollectionItem } from "@/domain/nodes";
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

import { CollectionShowcase } from "../collection-showcase";

// jsdom has no <dialog> behaviour. The stubs mirror the platform: `close()` fires `close`
// (what `Dialog` maps `onClose` to) and `showModal()` throws on an already-open dialog.
beforeEach(() => {
  // jsdom has no media stack: `play()` returns nothing where a browser returns a promise.
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
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
});

afterEach(() => cleanup());

const items = (count: number): CollectionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    type: "media",
    kind: "image",
    src: `/img/${i}.jpg`,
    alt: `Image ${i}`,
  }));

const tiles = () =>
  screen.queryAllByRole("button").filter((el) => el.querySelector("img"));

describe("CollectionShowcase layout", () => {
  it("renders nothing for an empty collection", () => {
    const { container } = render(<CollectionShowcase items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows one tile for one image and two for two", () => {
    const { rerender } = render(<CollectionShowcase items={items(1)} />);
    expect(tiles()).toHaveLength(1);
    rerender(<CollectionShowcase items={items(2)} />);
    expect(tiles()).toHaveLength(2);
  });

  it("shows exactly three tiles from three images up", () => {
    const { rerender } = render(<CollectionShowcase items={items(3)} />);
    expect(tiles()).toHaveLength(3);
    rerender(<CollectionShowcase items={items(6)} />);
    expect(tiles()).toHaveLength(3);
  });

  it("folds the images it cannot show into a surplus count", () => {
    render(<CollectionShowcase items={items(5)} />);
    expect(screen.getByText("+2 Images")).toBeDefined();
  });

  it("shows no surplus badge when everything fits", () => {
    render(<CollectionShowcase items={items(3)} />);
    expect(screen.queryByText(/Images$/)).toBeNull();
  });

  it("falls back to the caption for alt text", () => {
    render(
      <CollectionShowcase
        items={[
          { type: "media", kind: "image", src: "/a.jpg", caption: "A caption" },
        ]}
      />,
    );
    expect(screen.getByAltText("A caption")).toBeDefined();
  });

  it("hands the tile and its ground no corner off the picture", () => {
    render(
      <CollectionShowcase
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
    const cell = tiles()[0].parentElement!;
    expect(cell.getAttribute("style")).toBeNull();
    expect(
      cell.querySelector<HTMLElement>("[data-background-effect]")!.style
        .borderRadius,
    ).toBe("");
  });
});

describe("CollectionShowcase lightbox", () => {
  const openLightbox = async (count: number, tileIndex = 0) => {
    const user = userEvent.setup();
    render(<CollectionShowcase items={items(count)} />);
    await user.click(tiles()[tileIndex]);
    return user;
  };

  it("opens on the tile that was clicked", async () => {
    await openLightbox(5, 1);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("img")?.getAttribute("alt")).toBe("Image 1");
  });

  it("opens on the fourth image from the surplus badge", async () => {
    const user = userEvent.setup();
    render(<CollectionShowcase items={items(5)} />);
    await user.click(screen.getByRole("button", { name: /2 more images/i }));
    expect(
      screen.getByRole("dialog").querySelector("img")?.getAttribute("alt"),
    ).toBe("Image 3");
  });

  it("steps through every image with the arrow keys, not just the tiles", async () => {
    await openLightbox(5, 2);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.querySelector("img")?.getAttribute("alt")).toBe("Image 3");
  });

  it("wraps at both ends", async () => {
    await openLightbox(3, 0);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(dialog.querySelector("img")?.getAttribute("alt")).toBe("Image 2");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.querySelector("img")?.getAttribute("alt")).toBe("Image 0");
  });

  it("shows the open image's own caption", async () => {
    const user = userEvent.setup();
    render(
      <CollectionShowcase
        items={[
          { type: "media", kind: "image", src: "/a.jpg", alt: "A", caption: "First" },
          { type: "media", kind: "image", src: "/b.jpg", alt: "B", caption: "Second" },
        ]}
      />,
    );
    await user.click(tiles()[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("First");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.textContent).toContain("Second");
    expect(dialog.textContent).not.toContain("First");
  });

  it("caps at the image's natural width once it has loaded", async () => {
    await openLightbox(2, 0);
    const img = screen.getByRole("dialog").querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 640, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 480, configurable: true });
    fireEvent.load(img);
    expect(img.style.maxWidth).toBe("min(640px, 85vw)");
    expect(img.style.width).toBe("");
  });

  it("does not inherit the previous image's box when you navigate", async () => {
    await openLightbox(2, 0);
    const dialog = screen.getByRole("dialog");
    const first = dialog.querySelector("img")!;
    Object.defineProperty(first, "naturalWidth", { value: 640, configurable: true });
    fireEvent.load(first);

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.querySelector("img")!.style.maxWidth).toBe("");
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
        <CollectionShowcase items={items(3)} />
      </StrictMode>,
    );
    await user.click(tiles()[0]);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });
});

describe("CollectionShowcase lightbox corner", () => {
  let resizePictureTo: ((width: number) => void) | null = null;

  beforeEach(() => {
    resizePictureTo = null;
    // jsdom has no layout or ResizeObserver: the picture's width is whatever this stub reports.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizePictureTo = (width: number) =>
            act(() =>
              callback(
                [{ contentRect: { width } } as ResizeObserverEntry],
                this as unknown as ResizeObserver,
              ),
            );
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  const openRounded = async (item: Partial<CollectionItem> = {}) => {
    const user = userEvent.setup();
    render(
      <CollectionShowcase
        items={[
          { type: "media", kind: "image", src: "/a.jpg", alt: "A", borderRadius: 20, ...item },
          { type: "media", kind: "image", src: "/b.jpg", alt: "B", borderRadius: 8 },
        ]}
      />,
    );
    await user.click(tiles()[0]);
    return screen.getByRole("dialog");
  };

  it("grows the corner with the picture it is enlarging", async () => {
    const dialog = await openRounded();
    const img = dialog.querySelector("img")!;

    expect(img.style.borderRadius).toBe("20px");

    resizePictureTo!(1280);
    expect(img.style.borderRadius).toBe("40px");
  });

  it("shrinks it on a viewport too narrow for the authored size", async () => {
    const dialog = await openRounded();
    resizePictureTo!(320);
    expect(dialog.querySelector("img")!.style.borderRadius).toBe("10px");
  });

  it("leaves the card behind it alone", async () => {
    const dialog = await openRounded({
      backgroundEffect: DEFAULT_BACKGROUND_EFFECT,
    });
    resizePictureTo!(1280);

    const ground = dialog.querySelector<HTMLElement>("[data-background-effect]")!;
    expect(ground.style.borderRadius).toBe("");
    expect(dialog.querySelector("img")!.style.borderRadius).toBe("40px");
  });

  it("does not carry the previous image's box across a step", async () => {
    const dialog = await openRounded();
    resizePictureTo!(1280);
    expect(dialog.querySelector("img")!.style.borderRadius).toBe("40px");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(dialog.querySelector("img")!.style.borderRadius).toBe("8px");
  });

  it("leaves a square picture square at any size", async () => {
    const dialog = await openRounded({ borderRadius: undefined });
    resizePictureTo!(1280);
    expect(dialog.querySelector("img")!.style.borderRadius).toBe("0px");
  });

  it("grows the band with the picture it is enlarging", async () => {
    const dialog = await openRounded({ padding: 40 });
    const img = dialog.querySelector("img")!;

    expect(img.style.margin).toBe("40px");

    // A 1120px picture with a 40-per-640 band each side implies a 1280px box, so the band is 80.
    resizePictureTo!(1120);
    expect(img.style.margin).toBe("80px");
    // The corner is a share of that same box: 20 of 640 is 40 at 1280.
    expect(img.style.borderRadius).toBe("40px");
  });

  it("settles the band in one measurement", async () => {
    const dialog = await openRounded({ padding: 40 });
    const img = dialog.querySelector("img")!;

    resizePictureTo!(1120);
    expect(img.style.margin).toBe("80px");
    resizePictureTo!(1120);
    expect(img.style.margin).toBe("80px");
  });

  it("leaves the band room inside the viewport caps", async () => {
    const dialog = await openRounded({ padding: 40 });
    const img = dialog.querySelector("img")!;
    // The CSSOM folds the multiplication into one number.
    expect(img.style.maxWidth).toBe(`calc(${85 * 0.875}vw)`);
    expect(img.style.maxHeight).toBe(
      `calc((85vh - var(--spacing-4xl)) / ${1 / 0.875})`,
    );

    Object.defineProperty(img, "naturalWidth", {
      value: 640,
      configurable: true,
    });
    Object.defineProperty(img, "naturalHeight", {
      value: 480,
      configurable: true,
    });
    fireEvent.load(img);
    expect(img.style.maxWidth).toBe("min(640px, calc(85vw * 0.875))");
    expect(img.style.maxHeight).toBe(
      `calc((85vh - var(--spacing-4xl)) / ${1 + (2 * (40 / 640) * (640 / 480)) / 0.875})`,
    );
  });

  it("leaves an uninset picture's caps alone", async () => {
    const img = (await openRounded()).querySelector("img")!;
    expect(img.style.maxWidth).toBe("");
    expect(img.style.maxHeight).toBe("");
    expect(img.style.margin).toBe("0px");
  });
});

describe("CollectionShowcase clips", () => {
  const clip = {
    type: "media" as const,
    kind: "video" as const,
    src: "/demo.mp4",
    alt: "A demo",
  };

  it("plays an mp4 tile as a video, still under the tile's own button", async () => {
    const user = userEvent.setup();
    render(<CollectionShowcase items={[clip]} />);

    const tile = screen.getByRole("button", { name: "A demo" });
    expect(tile.querySelector("video")).not.toBeNull();

    await user.click(tile);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("gives a clip tile a chip outside the button that opens the lightbox", async () => {
    const user = userEvent.setup();
    render(<CollectionShowcase items={[clip]} />);

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

  it("plays the featured clip in the grid and holds the rest still", () => {
    render(
      <CollectionShowcase
        items={[
          { type: "media", kind: "video", src: "/a.mp4", alt: "A" },
          { type: "media", kind: "video", src: "/b.mp4", alt: "B" },
          { type: "media", kind: "video", src: "/c.mp4", alt: "C" },
        ]}
      />,
    );

    const tiles = Array.from(document.querySelectorAll("video"));
    expect(tiles).toHaveLength(3);
    expect(tiles.map((v) => v.hasAttribute("autoplay"))).toEqual([
      true,
      false,
      false,
    ]);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("shows a clip stored under an extensionless key, in the tile and enlarged", async () => {
    const user = userEvent.setup();
    const keyed = {
      type: "media" as const,
      kind: "video" as const,
      src: "media/8f2c-4b1e-key",
      alt: "A demo",
    };
    render(<CollectionShowcase items={[keyed]} />);

    const tile = screen.getByRole("button", { name: "A demo" });
    expect(tile.querySelector("video")).not.toBeNull();

    await user.click(tile);
    expect(screen.getByRole("dialog").querySelector("video")).not.toBeNull();
  });

  it("plays whichever clip the lightbox opens", async () => {
    const user = userEvent.setup();
    render(
      <CollectionShowcase
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
    render(<CollectionShowcase items={[clip]} />);
    await user.click(screen.getByRole("button", { name: "A demo" }));

    const opened = screen.getByRole("dialog").querySelector("video")!;
    Object.defineProperty(opened, "videoWidth", { value: 1280 });
    fireEvent.loadedMetadata(opened);

    expect(opened.style.maxWidth).toBe("min(1280px, 85vw)");
  });
});
