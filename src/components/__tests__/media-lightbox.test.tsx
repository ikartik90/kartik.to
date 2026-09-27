// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // jsdom has no Web Animations of its own.
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

interface Glide {
  element: HTMLElement;
  keyframes: Keyframe[];
  animation: Animation;
  finish: () => Promise<void>;
}

/** Records each animation, which finishes only when the test says. */
function recordAnimations() {
  const glides: Glide[] = [];
  HTMLElement.prototype.animate = vi.fn(function (
    this: HTMLElement,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
  ) {
    let resolve!: (animation: Animation) => void;
    let state: AnimationPlayState = "running";
    const animation = {
      finished: new Promise<Animation>((done) => (resolve = done)),
      get playState() {
        return state;
      },
      pause: vi.fn(() => (state = "paused")),
      play: vi.fn(() => (state = "running")),
      cancel: vi.fn(() => (state = "idle")),
    } as unknown as Animation;
    glides.push({
      element: this,
      keyframes: keyframes as Keyframe[],
      animation,
      finish: () => act(async () => resolve(animation)),
    });
    return animation;
  });
  const on = (attribute: string) => () =>
    glides.filter((glide) => glide.element.hasAttribute(attribute));
  return {
    strip: on("data-lightbox-strip"),
    frame: on("data-lightbox-frame"),
    /** Lets the opening zoom and the chrome's fade run out. */
    opened: () =>
      act(async () => {
        await Promise.all(
          glides
            .filter((glide) => !glide.element.hasAttribute("data-lightbox-strip"))
            .map((glide) => glide.finish()),
        );
      }),
  };
}

// The frame rests at 800 × 500; its slide on the page is half that, off to the right.
const REST = new DOMRect(100, 100, 800, 500);
const SLIDE = new DOMRect(620, 40, 400, 250);

/** Measures lightbox frames at `REST`, and gives a slide on the page at `SLIDE`. */
function measured() {
  const slide = document.createElement("div");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this === slide) return SLIDE;
      if (this.hasAttribute("data-lightbox-frame")) return REST;
      return new DOMRect();
    },
  );
  return slide;
}

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
const current = () =>
  dialog().querySelector<HTMLElement>("[data-lightbox-slide]:not([inert])")!;
const shown = () => current().querySelector("img")?.getAttribute("alt");
const frame = () =>
  current().querySelector<HTMLElement>("[data-lightbox-frame]")!;
const slide = (alt: string) =>
  dialog()
    .querySelector(`img[alt="${alt}"]`)
    ?.closest<HTMLElement>("[data-lightbox-slide]") ?? null;
const slotOf = (alt: string) => slide(alt)?.style.getPropertyValue("--slot");

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

  it("labels Previous and Next with tooltips that show above the modal", () => {
    render(<Harness items={[picture(0), picture(1)]} />);
    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.pointerEnter(next, { pointerType: "mouse", clientX: 10, clientY: 10 });

    const label = screen.getByText("Next").closest("[data-visible]");
    expect(label?.closest("dialog")).toBe(screen.getByRole("dialog"));
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

  it("lays the neighbours a screen to either side, out of reach", () => {
    render(<Harness items={[picture(0), picture(1), picture(2)]} initial={1} />);
    expect(slotOf("Picture 1")).toBe("-1");
    expect(slotOf("Picture 2")).toBe("0");
    expect(slotOf("Picture 3")).toBe("1");
    expect(slide("Picture 1")!.hasAttribute("inert")).toBe(true);
    expect(slide("Picture 2")!.hasAttribute("inert")).toBe(false);
    expect(slide("Picture 3")!.hasAttribute("inert")).toBe(true);
  });

  it("loads the neighbours straight away, so they arrive ready", () => {
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);
    const images = dialog().querySelectorAll("img");
    expect(images).toHaveLength(3);
    images.forEach((image) => expect(image.getAttribute("loading")).toBe("eager"));
  });

  it("keeps the element of the item it steps to", () => {
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);
    const arriving = slide("Picture 2")!.querySelector("img");
    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(current().querySelector("img")).toBe(arriving);
  });

  it("slides the next item in from the right as the current one leaves by the left", async () => {
    const { strip, opened } = recordAnimations();
    render(<Harness items={[picture(0), picture(1), picture(2)]} />);
    await opened();

    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(strip()).toHaveLength(1);
    expect(strip()[0].keyframes[0].translate).toMatch(/^calc\(100vw \+ 0px\)/);
    expect(strip()[0].keyframes.at(-1)!.translate).toBe("0px 0px");
    expect(slotOf("Picture 1")).toBe("-1");
    expect(slotOf("Picture 2")).toBe("0");
  });

  it("slides the previous item in from the left as the current one leaves by the right", async () => {
    const { strip, opened } = recordAnimations();
    render(<Harness items={[picture(0), picture(1), picture(2)]} initial={1} />);
    await opened();

    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(strip()[0].keyframes[0].translate).toMatch(/^calc\(-100vw \+ 0px\)/);
    expect(slotOf("Picture 2")).toBe("1");
  });

  it("brings a dot's item in from its side, and its neighbours once the strip rests", async () => {
    const { strip, opened } = recordAnimations();
    const user = userEvent.setup();
    render(<Harness items={[0, 1, 2, 3, 4].map((i) => picture(i))} />);
    await opened();

    await user.click(screen.getByRole("button", { name: "Show image 3" }));
    expect(strip()[0].keyframes[0].translate).toMatch(/^calc\(100vw/);
    expect(slotOf("Picture 1")).toBe("-1");
    // Its place is the leaving item's until the glide ends.
    expect(slide("Picture 2")!.style.visibility).toBe("hidden");
    expect(slide("Picture 4")).toBeNull();

    await strip()[0].finish();
    expect(slotOf("Picture 2")).toBe("-1");
    expect(slide("Picture 2")!.style.visibility).toBe("");
    expect(slotOf("Picture 4")).toBe("1");
    expect(slide("Picture 1")).toBeNull();
  });

  it("grows the frame out of its slide, corner to corner", () => {
    const { frame: zoom } = recordAnimations();
    const slide = measured();
    render(<Harness items={[picture(0)]} sourceFor={() => slide} />);

    const [first, last] = [zoom()[0].keyframes[0], zoom()[0].keyframes.at(-1)!];
    expect(first.scale).toBe(`${400 / 800} ${250 / 500}`);
    // Centre to centre: (820, 165) from (500, 350).
    expect(first.translate).toBe("320px -185px");
    expect(last.scale).toBe("1 1");
    expect(last.translate).toBe("0px 0px");
  });

  it("holds the frame on its slide until the lightbox has painted", () => {
    const { frame: zoom } = recordAnimations();
    const slide = measured();
    render(<Harness items={[picture(0)]} sourceFor={() => slide} />);
    expect(zoom()[0].animation.playState).toBe("paused");
  });

  it("mounts the neighbours only once the frame has grown into place", async () => {
    const { opened } = recordAnimations();
    const slide = measured();
    render(
      <Harness items={[picture(0), picture(1), picture(2)]} sourceFor={() => slide} />,
    );
    expect(dialog().querySelectorAll("[data-lightbox-slide]")).toHaveLength(1);

    await opened();
    expect(dialog().querySelectorAll("[data-lightbox-slide]")).toHaveLength(3);
  });

  it("shrinks the frame back into its slide, corner to corner, on close", async () => {
    const { frame: zoom, opened } = recordAnimations();
    const slide = measured();
    render(<Harness items={[picture(0)]} sourceFor={() => slide} />);
    await opened();

    fireEvent.keyDown(dialog(), { key: "Escape" });
    const closing = zoom().filter((glide) => glide.keyframes[0].scale).at(-1)!.keyframes;
    expect(closing[0].scale).toBe("1 1");
    expect(closing.at(-1)!.scale).toBe(`${400 / 800} ${250 / 500}`);
    expect(closing.at(-1)!.translate).toBe("320px -185px");
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

  it("stays over a clip on the page until the clip has drawn a frame again", () => {
    const source = document.createElement("div");
    const clip = document.createElement("video");
    let drawn!: () => void;
    Object.assign(clip, {
      requestVideoFrameCallback: vi.fn((callback: () => void) => {
        drawn = callback;
        return 1;
      }),
    });
    source.append(clip);
    render(<Harness items={[picture(0)]} sourceFor={() => source} />);

    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(source.style.visibility).toBe("");
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);

    act(() => drawn());
    expect(screen.queryByRole("dialog")).toBeNull();
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

  describe("taking over from the opener's copy", () => {
    const clip = (extra: Partial<MediaNode> = {}): MediaNode => ({
      type: "media",
      kind: "video",
      src: "/clip.mp4",
      alt: "Clip",
      width: 1600,
      height: 1000,
      ...extra,
    });

    const playingSource = (at: number) => {
      const source = document.createElement("div");
      const video = document.createElement("video");
      video.src = "/clip.mp4";
      Object.defineProperty(video, "readyState", { value: 4 });
      Object.defineProperty(video, "currentTime", { value: at });
      Object.defineProperty(video, "videoWidth", { value: 1600 });
      Object.defineProperty(video, "videoHeight", { value: 1000 });
      source.append(video);
      return source;
    };

    // The lightbox's own clip, driven through the states a browser moves it through.
    const lightboxClip = () => {
      const video = dialog().querySelector("video")!;
      const state = { readyState: 0, seeking: false, currentTime: 0 };
      Object.defineProperty(video, "readyState", { get: () => state.readyState });
      Object.defineProperty(video, "seeking", { get: () => state.seeking });
      Object.defineProperty(video, "currentTime", {
        get: () => state.currentTime,
        set: (at: number) => {
          state.currentTime = at;
          state.seeking = true;
        },
      });
      return { video, state };
    };

    const covered = () => dialog().querySelector("[data-lightbox-stand-in]") !== null;

    it("keeps a clip showing under its copy, so its picture is up when the copy comes off", () => {
      render(<Harness items={[clip()]} sourceFor={() => playingSource(3)} />);
      expect(covered()).toBe(true);
      expect(dialog().querySelector("video")!.style.visibility).not.toBe("hidden");
    });

    it("hands over at the opener's playhead once the clip has seeked there", () => {
      render(<Harness items={[clip()]} sourceFor={() => playingSource(3)} />);
      const { video, state } = lightboxClip();

      state.readyState = 1;
      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(3);
      state.readyState = 2;
      fireEvent.loadedData(video);
      expect(covered()).toBe(true);

      state.seeking = false;
      fireEvent.seeked(video);
      expect(covered()).toBe(false);
    });

    it("keeps the copy on until the clip has drawn a frame on screen", () => {
      render(<Harness items={[clip()]} sourceFor={() => playingSource(0)} />);
      const { video, state } = lightboxClip();
      let drawn!: () => void;
      Object.assign(video, {
        requestVideoFrameCallback: vi.fn((callback: () => void) => {
          drawn = callback;
          return 1;
        }),
      });

      state.readyState = 2;
      fireEvent.loadedData(video);
      expect(covered()).toBe(true);

      act(() => drawn());
      expect(covered()).toBe(false);
    });

    it("keeps the copy over a clip starting from its beginning until it has a frame", () => {
      render(<Harness items={[clip()]} sourceFor={() => playingSource(0)} />);
      const { video, state } = lightboxClip();

      state.readyState = 1;
      fireEvent.loadedMetadata(video);
      expect(covered()).toBe(true);

      state.readyState = 2;
      fireEvent.loadedData(video);
      expect(covered()).toBe(false);
    });

    it("takes a picture's copy off only once the picture has decoded", async () => {
      let decoded!: () => void;
      HTMLImageElement.prototype.decode = vi.fn(
        () => new Promise<void>((done) => (decoded = done)),
      );
      const source = document.createElement("div");
      const loaded = document.createElement("img");
      loaded.src = "/img/0.jpg";
      Object.defineProperty(loaded, "complete", { value: true });
      Object.defineProperty(loaded, "naturalWidth", { value: 1600 });
      Object.defineProperty(loaded, "naturalHeight", { value: 1000 });
      source.append(loaded);

      render(<Harness items={[picture(0)]} sourceFor={() => source} />);
      fireEvent.load(dialog().querySelector("img")!);
      expect(covered()).toBe(true);

      await act(async () => decoded());
      expect(covered()).toBe(false);
      delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
    });
  });
});
