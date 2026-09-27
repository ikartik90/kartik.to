// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaNode } from "@/domain/nodes";

vi.mock("@paper-design/shaders-react", () => ({
  StaticMeshGradient: () => <div data-background-effect="" />,
}));

import { MediaLightbox } from "../media-lightbox";

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
  // jsdom has no 2D canvas; the copies are drawn in a browser.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(() => cleanup());

const picture = (i: number, extra: Partial<MediaNode> = {}): MediaNode => ({
  type: "media",
  kind: "image",
  src: `/img/${i}.jpg`,
  alt: `Picture ${i + 1}`,
  width: 1600,
  height: 1000,
  ...extra,
});

function Harness({
  items,
  initial = 0,
  sourceFor,
}: {
  items: MediaNode[];
  initial?: number;
  sourceFor?: (index: number) => HTMLElement | null;
}) {
  const [index, setIndex] = useState<number | null>(initial);
  return (
    <MediaLightbox
      items={items}
      index={index}
      onIndexChange={setIndex}
      onClose={() => setIndex(null)}
      sourceFor={sourceFor}
    />
  );
}

const dialog = () => screen.getByRole("dialog");
const shown = () => dialog().querySelector("img")?.getAttribute("alt");
const frame = () =>
  dialog().querySelector<HTMLElement>("[data-lightbox-frame]")!;

describe("MediaLightbox", () => {
  it("sizes its frame from the item's recorded shape before anything loads", () => {
    render(<Harness items={[picture(0, { padding: 40 })]} />);
    expect(frame().style.getPropertyValue("--frame-aspect")).toBe(
      String(1 / (0.875 / 1.6 + 0.125)),
    );
    expect(frame().style.getPropertyValue("--frame-max")).toBe(
      `${1600 / 0.875}px`,
    );
  });

  it("caps an unrecorded source at its natural width once it has loaded", () => {
    render(<Harness items={[picture(0, { width: undefined, height: undefined })]} />);
    expect(frame().style.getPropertyValue("--frame-max")).toBe("");

    const img = dialog().querySelector("img")!;
    Object.defineProperty(img, "naturalWidth", { value: 640 });
    Object.defineProperty(img, "naturalHeight", { value: 480 });
    fireEvent.load(img);
    expect(frame().style.getPropertyValue("--frame-max")).toBe("640px");
    expect(frame().style.getPropertyValue("--frame-aspect")).toBe(
      String(640 / 480),
    );
  });

  it("steps with Previous and Next, wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(shown()).toBe("Picture 3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(shown()).toBe("Picture 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(shown()).toBe("Picture 2");
  });

  it("steps with the arrow keys", () => {
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);
    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(shown()).toBe("Picture 2");
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(shown()).toBe("Picture 3");
  });

  it("marks the current item among the step dots, and a dot jumps to its item", async () => {
    const user = userEvent.setup();
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);
    const dots = screen.getAllByRole("button", { name: /^Show image \d$/ });
    expect(dots).toHaveLength(3);
    expect(dots[0].getAttribute("aria-current")).toBe("true");

    await user.click(dots[2]);
    expect(shown()).toBe("Picture 3");
    expect(
      screen.getByRole("button", { name: "Show image 3" }).getAttribute("aria-current"),
    ).toBe("true");
  });

  it("offers no stepping for a single item", () => {
    render(<Harness items={[picture(0)]} />);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Show image/ })).toBeNull();
  });

  it("hides the element it opened from until it closes", () => {
    const source = document.createElement("div");
    render(<Harness items={[picture(0)]} sourceFor={() => source} />);
    expect(source.style.visibility).toBe("hidden");

    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(source.style.visibility).toBe("");
  });

  it("covers the picture with its source's current frame until its own has loaded", () => {
    const source = document.createElement("div");
    const loaded = document.createElement("img");
    loaded.src = "/img/0.jpg";
    Object.defineProperty(loaded, "complete", { value: true });
    Object.defineProperty(loaded, "naturalWidth", { value: 1600 });
    Object.defineProperty(loaded, "naturalHeight", { value: 1000 });
    source.append(loaded);

    render(<Harness items={[picture(0)]} sourceFor={() => source} />);
    expect(dialog().querySelector("[data-lightbox-stand-in]")).not.toBeNull();

    fireEvent.load(dialog().querySelector("img")!);
    expect(dialog().querySelector("[data-lightbox-stand-in]")).toBeNull();
  });
});
