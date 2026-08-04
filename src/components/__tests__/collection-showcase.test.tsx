// @vitest-environment jsdom
import { StrictMode } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionItem } from "@/domain/nodes";
import { CollectionShowcase } from "../collection-showcase";

// jsdom implements neither of these, and the lightbox is a native <dialog>.
// The stubs mirror the PLATFORM, not just the attribute: `close()` fires a
// `close` event (which is what `Dialog` maps its `onClose` prop to) and
// `showModal()` throws on an already-open dialog. A stub that only toggled the
// attribute made a real "opens, then immediately closes itself" bug invisible.
beforeEach(() => {
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

  // The reader has no empty slots to draw, so a collection too small for the
  // featured skeleton splits evenly rather than leaving holes.
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
      <CollectionShowcase items={[{ src: "/a.jpg", caption: "A caption" }]} />,
    );
    expect(screen.getByAltText("A caption")).toBeDefined();
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

  // The badge stands for images 4..n, so it opens the first of them.
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
          { src: "/a.jpg", alt: "A", caption: "First" },
          { src: "/b.jpg", alt: "B", caption: "Second" },
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

  // The size rule is min(natural, 85vw, 85vh), and it must land entirely on
  // MAX constraints: a fixed width would let the height cap shrink the box
  // while the image letterboxed inside it.
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

  // Next runs with reactStrictMode on, so every effect mounts, tears down and
  // mounts again. `Dialog` maps `onClose` to the NATIVE close event, so any
  // cleanup that calls `dialog.close()` reports a user dismissal and unmounts
  // the lightbox before it can reopen — it flashes and dies.
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
