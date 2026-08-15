// @vitest-environment jsdom
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Media } from "../media";

// jsdom ships no media stack at all: `play()` is a not-implemented stub that
// returns undefined where every browser returns a promise, and `paused` is a
// getter hard-wired to true. So the stubs stand in for the PLATFORM rather than
// just recording calls — they flip `paused` and announce it, which is what the
// element does and what anything reading the element is entitled to expect.
// (Spies still, so a test can assert the clip was started.)
const play = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { value: false, configurable: true });
  this.dispatchEvent(new Event("play"));
  return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { value: true, configurable: true });
  this.dispatchEvent(new Event("pause"));
});

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  HTMLMediaElement.prototype.play = play;
  HTMLMediaElement.prototype.pause = pause;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => cleanup());

const video = () => document.querySelector("video");

describe("Media", () => {
  it("shows a picture as an <img>, alt and all", () => {
    render(<Media src="/media/shot.png" alt="A screenshot" />);
    const image = screen.getByAltText("A screenshot");
    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("src")).toBe("/media/shot.png");
  });

  it("plays an mp4 as a <video> instead", () => {
    render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(screen.queryByAltText("A demo")).toBeNull();
    expect(video()).not.toBeNull();
    expect(video()?.getAttribute("aria-label")).toBe("A demo");
  });

  // A decorative source is unlabelled, exactly as `alt=""` leaves an <img>:
  // in the grid and the lightbox the surrounding button already carries the
  // name, and repeating it would announce the same thing twice.
  it("leaves a clip with no alt unlabelled rather than labelling it empty", () => {
    render(<Media src="/media/demo.mp4" alt="" />);
    expect(video()?.hasAttribute("aria-label")).toBe(false);
  });

  // React sets `muted` as a property and never renders the attribute, so
  // server-rendered markup would reach the autoplay policy un-muted.
  it("mutes and loops a clip, in the markup as well as on the element", () => {
    render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(video()?.muted).toBe(true);
    expect(video()?.hasAttribute("muted")).toBe(true);
    expect(video()?.hasAttribute("loop")).toBe(true);
    expect(video()?.hasAttribute("playsinline")).toBe(true);
    expect(play).toHaveBeenCalled();
  });

  // For the surface showing SEVERAL clips at once: only one of them should be
  // performing, and the rest are never asked to start rather than started and
  // stopped — so there is nothing to flicker and no playhead to lose.
  it("withholds the start where the caller says not to", () => {
    render(<Media src="/media/demo.mp4" alt="A demo" autoPlay={false} />);
    expect(play).not.toHaveBeenCalled();
    expect(video()?.hasAttribute("autoplay")).toBe(false);
    // Still muted and looping — it is a held clip, not a different one.
    expect(video()?.muted).toBe(true);
    expect(video()?.hasAttribute("loop")).toBe(true);
  });

  it("holds a clip still for a visitor who asked for less motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
  });

  it("gives a clip its transport only where it is asked for", () => {
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(video()?.hasAttribute("controls")).toBe(false);
    rerender(<Media src="/media/demo.mp4" alt="A demo" controls />);
    expect(video()?.hasAttribute("controls")).toBe(true);
  });

  // One callback for both, because the caller's question — "how big is this
  // thing really?" — is the same one whatever the element answering it is.
  // Both dimensions, because a caller fitting a composition to the screen needs
  // the SHAPE, and half a measurement cannot give it one.
  it("reports intrinsic size from whichever element measured it", () => {
    const onMeasure = vi.fn();
    const { rerender } = render(
      <Media src="/media/shot.png" alt="A screenshot" onMeasure={onMeasure} />,
    );
    const image = screen.getByAltText("A screenshot");
    Object.defineProperty(image, "naturalWidth", { value: 640 });
    Object.defineProperty(image, "naturalHeight", { value: 480 });
    fireEvent.load(image);
    expect(onMeasure).toHaveBeenCalledWith(640, 480);

    rerender(<Media src="/media/demo.mp4" alt="A demo" onMeasure={onMeasure} />);
    const clip = video()!;
    Object.defineProperty(clip, "videoWidth", { value: 1280 });
    Object.defineProperty(clip, "videoHeight", { value: 720 });
    fireEvent.loadedMetadata(clip);
    expect(onMeasure).toHaveBeenLastCalledWith(1280, 720);
  });

  // The transport is a clip's own control, not a surface's — a picture has
  // nothing to play, so asking for one over a photograph is a no-op rather
  // than a dead button.
  it("gives a clip a transport where it is asked for, and never a picture", () => {
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<Media src="/media/demo.mp4" alt="A demo" transport />);
    expect(screen.getByRole("button")).toBeTruthy();

    rerender(<Media src="/media/shot.png" alt="A screenshot" transport />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // The chip reports the ELEMENT, not the last press: a clip is started and
  // stopped by things the button never hears about — the autoplay policy, the
  // reduced-motion pause, a backgrounded tab — and a label derived from
  // anything else would end up offering to play what is already playing.
  it("names the transport for what pressing it will do", () => {
    render(
      <Media src="/media/demo.mp4" alt="A demo" transport autoPlay={false} />,
    );
    // Held at the start, so the offer is to start it.
    expect(screen.getByRole("button", { name: "Play video" })).toBeTruthy();

    // The clip starts on its own — nobody pressed anything — and the chip
    // follows it.
    act(() => void video()!.play());
    expect(screen.getByRole("button", { name: "Pause video" })).toBeTruthy();

    act(() => video()!.pause());
    expect(screen.getByRole("button", { name: "Play video" })).toBeTruthy();
  });

  // The case a remembered flag gets wrong: the clip was already running before
  // the chip existed, so there was no `play` event for it to hear, and a button
  // that started from "not playing" would offer to start it again.
  it("reports a clip that was already running when the chip arrived", () => {
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" />);
    expect(video()!.paused).toBe(false);

    rerender(<Media src="/media/demo.mp4" alt="A demo" transport />);
    expect(screen.getByRole("button", { name: "Pause video" })).toBeTruthy();
  });

  it("stops a playing clip and starts a stopped one", () => {
    render(
      <Media src="/media/demo.mp4" alt="A demo" transport autoPlay={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pause video" }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("passes the presentation through to either element", () => {
    const { rerender } = render(
      <Media
        src="/media/shot.png"
        alt="A screenshot"
        className="tile"
        draggable={false}
        data-checkered=""
      />,
    );
    const image = screen.getByAltText("A screenshot");
    expect(image.className).toBe("tile");
    expect(image.getAttribute("draggable")).toBe("false");
    expect(image.hasAttribute("data-checkered")).toBe(true);

    rerender(
      <Media
        src="/media/demo.mp4"
        alt="A demo"
        className="tile"
        draggable={false}
        data-checkered=""
      />,
    );
    expect(video()?.className).toBe("tile");
    expect(video()?.getAttribute("draggable")).toBe("false");
    expect(video()?.hasAttribute("data-checkered")).toBe(true);
  });
});
