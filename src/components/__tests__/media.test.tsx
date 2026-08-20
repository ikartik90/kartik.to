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
    render(<Media src="/media/shot.png" alt="A screenshot" kind="image" />);
    const image = screen.getByAltText("A screenshot");
    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("src")).toBe("/media/shot.png");
  });

  it("plays a clip as a <video> instead", () => {
    render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
    expect(screen.queryByAltText("A demo")).toBeNull();
    expect(video()).not.toBeNull();
    expect(video()?.getAttribute("aria-label")).toBe("A demo");
  });

  // `kind` is the ONLY thing consulted, and these are precisely the two cases
  // a filename cannot get right — a clip stored under a bare R2 key, and a
  // still frame that happens to be named `.mp4`. There is no longer any
  // fallback for them to lose to: the caller says which element it wants,
  // because every caller has a node or an upload that already knows.
  it("renders what it is told it is, whatever the src looks like", () => {
    render(<Media src="/media/8f2c-key" alt="A demo" kind="video" />);
    expect(video()).not.toBeNull();
    expect(screen.queryByAltText("A demo")).toBeNull();

    cleanup();

    render(<Media src="/media/still.mp4" alt="A frame" kind="image" />);
    expect(screen.getByAltText("A frame").tagName).toBe("IMG");
    expect(video()).toBeNull();
  });

  // A picture has nothing to play, and `kind` is what decides that too —
  // otherwise a still named `.mp4` would grow a dead play button.
  it("withholds the transport from anything declared a picture", () => {
    render(
      <Media src="/media/still.mp4" alt="A frame" kind="image" transport />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  // A decorative source is unlabelled, exactly as `alt=""` leaves an <img>:
  // in the grid and the lightbox the surrounding button already carries the
  // name, and repeating it would announce the same thing twice.
  it("leaves a clip with no alt unlabelled rather than labelling it empty", () => {
    render(<Media src="/media/demo.mp4" alt="" kind="video" />);
    expect(video()?.hasAttribute("aria-label")).toBe(false);
  });

  // React sets `muted` as a property and never renders the attribute, so
  // server-rendered markup would reach the autoplay policy un-muted.
  it("mutes and loops a clip, in the markup as well as on the element", () => {
    render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
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
    render(<Media src="/media/demo.mp4" alt="A demo" autoPlay={false} kind="video" />);
    expect(play).not.toHaveBeenCalled();
    expect(video()?.hasAttribute("autoplay")).toBe(false);
    // Still muted and looping — it is a held clip, not a different one.
    expect(video()?.muted).toBe(true);
    expect(video()?.hasAttribute("loop")).toBe(true);
  });

  it("holds a clip still for a visitor who asked for less motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
  });

  it("gives a clip its transport only where it is asked for", () => {
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
    expect(video()?.hasAttribute("controls")).toBe(false);
    rerender(<Media src="/media/demo.mp4" alt="A demo" controls kind="video" />);
    expect(video()?.hasAttribute("controls")).toBe(true);
  });

  // One callback for both, because the caller's question — "how big is this
  // thing really?" — is the same one whatever the element answering it is.
  // Both dimensions, because a caller fitting a composition to the screen needs
  // the SHAPE, and half a measurement cannot give it one.
  it("reports intrinsic size from whichever element measured it", () => {
    const onMeasure = vi.fn();
    const { rerender } = render(
      <Media src="/media/shot.png" alt="A screenshot" onMeasure={onMeasure} kind="image" />,
    );
    const image = screen.getByAltText("A screenshot");
    Object.defineProperty(image, "naturalWidth", { value: 640 });
    Object.defineProperty(image, "naturalHeight", { value: 480 });
    fireEvent.load(image);
    expect(onMeasure).toHaveBeenCalledWith(640, 480);

    rerender(<Media src="/media/demo.mp4" alt="A demo" onMeasure={onMeasure} kind="video" />);
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
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<Media src="/media/demo.mp4" alt="A demo" transport kind="video" />);
    expect(screen.getByRole("button")).toBeTruthy();

    rerender(<Media src="/media/shot.png" alt="A screenshot" transport kind="image" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  // The chip reports the ELEMENT, not the last press: a clip is started and
  // stopped by things the button never hears about — the autoplay policy, the
  // reduced-motion pause, a backgrounded tab — and a label derived from
  // anything else would end up offering to play what is already playing.
  it("names the transport for what pressing it will do", () => {
    render(
      <Media src="/media/demo.mp4" alt="A demo" transport autoPlay={false} kind="video" />,
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
    const { rerender } = render(<Media src="/media/demo.mp4" alt="A demo" kind="video" />);
    expect(video()!.paused).toBe(false);

    rerender(<Media src="/media/demo.mp4" alt="A demo" transport kind="video" />);
    expect(screen.getByRole("button", { name: "Pause video" })).toBeTruthy();
  });

  it("stops a playing clip and starts a stopped one", () => {
    render(
      <Media src="/media/demo.mp4" alt="A demo" transport autoPlay={false} kind="video" />,
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
        kind="image"
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
        kind="video"
        className="tile"
        draggable={false}
        data-checkered=""
      />,
    );
    expect(video()?.className).toBe("tile");
    expect(video()?.getAttribute("draggable")).toBe("false");
    expect(video()?.hasAttribute("data-checkered")).toBe(true);
  });

  // The same bargain as the presentation above, for the surface that has to
  // make the media FOCUSABLE. The editor's block has no caret of its own, so
  // the media element is the tab stop, the thing the overlay keys off and the
  // thing `[data-showcase-media]` has to find — and which element that is, is
  // precisely what this component decides and the caller no longer knows. So
  // the hooks have to travel down and land on whichever arm the fork took;
  // landing on one and not the other is how a clip would become unreachable by
  // keyboard while a photograph in the same slot stayed fine.
  it("passes the interaction contract through to either element", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const contract = {
      tabIndex: 0,
      onFocus,
      onBlur,
      onKeyDown,
      "data-showcase-media": "",
    };

    const { rerender } = render(
      <Media src="/media/shot.png" alt="A screenshot" kind="image" {...contract} />,
    );
    const image = screen.getByAltText("A screenshot");
    expect(image.tabIndex).toBe(0);
    expect(image.hasAttribute("data-showcase-media")).toBe(true);
    fireEvent.focus(image);
    fireEvent.keyDown(image, { key: "Backspace" });
    fireEvent.blur(image);

    rerender(<Media src="/media/demo.mp4" alt="A demo" kind="video" {...contract} />);
    const clip = video() as HTMLVideoElement;
    expect(clip.tabIndex).toBe(0);
    expect(clip.hasAttribute("data-showcase-media")).toBe(true);
    fireEvent.focus(clip);
    fireEvent.keyDown(clip, { key: "Backspace" });
    fireEvent.blur(clip);

    // Twice each: once from the picture, once from the clip.
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
});
