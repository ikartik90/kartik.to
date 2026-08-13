// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Media } from "../media";

// jsdom ships no media stack at all: `play()` is a not-implemented stub that
// returns undefined, where every browser returns a promise. Standing it up as
// a spy is also what lets a test assert that the clip was STARTED.
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

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

  // One callback for both, because the caller's question — "how wide is this
  // thing really?" — is the same one whatever the element answering it is.
  it("reports intrinsic width from whichever element measured it", () => {
    const onMeasure = vi.fn();
    const { rerender } = render(
      <Media src="/media/shot.png" alt="A screenshot" onMeasure={onMeasure} />,
    );
    const image = screen.getByAltText("A screenshot");
    Object.defineProperty(image, "naturalWidth", { value: 640 });
    fireEvent.load(image);
    expect(onMeasure).toHaveBeenCalledWith(640);

    rerender(<Media src="/media/demo.mp4" alt="A demo" onMeasure={onMeasure} />);
    const clip = video()!;
    Object.defineProperty(clip, "videoWidth", { value: 1280 });
    fireEvent.loadedMetadata(clip);
    expect(onMeasure).toHaveBeenLastCalledWith(1280);
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
