import { describe, expect, it } from "vitest";
import {
  clampPan,
  closeProgress,
  lerpRect,
  maxZoom,
  pinchRelease,
  swipeRelease,
  wheelZoomFactor,
  zoomAbout,
} from "../lightbox-gesture";

describe("swipeRelease", () => {
  const width = 1000;

  it("moves on once the picture is dragged a quarter of its width", () => {
    expect(swipeRelease({ offset: -250, width, speed: 0 })).toBe(1);
    expect(swipeRelease({ offset: 250, width, speed: 0 })).toBe(-1);
  });

  it("springs back from a short, slow drag", () => {
    expect(swipeRelease({ offset: -200, width, speed: -0.1 })).toBe(0);
  });

  it("moves on for a flick, however short", () => {
    expect(swipeRelease({ offset: -30, width, speed: -0.8 })).toBe(1);
    expect(swipeRelease({ offset: 30, width, speed: 0.8 })).toBe(-1);
  });

  it("ignores a flick against the drag, and a wobble too small to be one", () => {
    expect(swipeRelease({ offset: -30, width, speed: 0.8 })).toBe(0);
    expect(swipeRelease({ offset: -4, width, speed: -0.8 })).toBe(0);
  });
});

describe("maxZoom", () => {
  it("zooms until the picture shows its own pixels", () => {
    expect(maxZoom(2160, 900)).toBe(2.4);
  });

  it("always offers at least twice the fitted size", () => {
    expect(maxZoom(1000, 900)).toBe(2);
    expect(maxZoom(undefined, 900)).toBe(2);
  });
});

describe("zoomAbout", () => {
  it("keeps the point under the fingers where it is", () => {
    const focus = { x: 100, y: -50 };
    const zoomed = zoomAbout({ scale: 1, x: 0, y: 0 }, 2, focus);
    // The content point under `focus` was (focus - pan) / scale; it must map back to `focus`.
    expect((focus.x - zoomed.x) / zoomed.scale).toBeCloseTo(100, 10);
    expect((focus.y - zoomed.y) / zoomed.scale).toBeCloseTo(-50, 10);
  });

  it("holds the centre still for a pinch about it", () => {
    expect(zoomAbout({ scale: 2, x: 10, y: 20 }, 3, { x: 0, y: 0 })).toEqual({
      scale: 3,
      x: 15,
      y: 30,
    });
  });
});

describe("clampPan", () => {
  const size = { width: 800, height: 500 };

  it("stops the zoomed picture from uncovering its frame", () => {
    expect(clampPan({ scale: 2, x: 900, y: -900 }, size)).toEqual({
      scale: 2,
      x: 400,
      y: -250,
    });
  });

  it("centres a picture that fits", () => {
    expect(clampPan({ scale: 1, x: 30, y: 30 }, size)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in for a spread, which arrives as a negative delta", () => {
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1);
    expect(wheelZoomFactor(10)).toBeLessThan(1);
  });

  it("composes: opposite deltas cancel", () => {
    expect(wheelZoomFactor(-7) * wheelZoomFactor(7)).toBeCloseTo(1, 10);
  });
});

describe("closeProgress", () => {
  it("runs from 0 at the fitted size to 1 at the slide's", () => {
    expect(closeProgress(1, 0.6)).toBe(0);
    expect(closeProgress(0.6, 0.6)).toBe(1);
    expect(closeProgress(0.8, 0.6)).toBeCloseTo(0.5, 10);
  });

  it("stays within its ends", () => {
    expect(closeProgress(1.4, 0.6)).toBe(0);
    expect(closeProgress(0.3, 0.6)).toBe(1);
  });
});

describe("pinchRelease", () => {
  it("settles a zoom in, and a pinch back to exactly fitted", () => {
    expect(pinchRelease({ scale: 1.8, sourceScale: 0.6, opening: false })).toBe(
      "zoom",
    );
    expect(pinchRelease({ scale: 1, sourceScale: 0.6, opening: false })).toBe(
      "fit",
    );
  });

  it("closes once the frame has shrunk a fifth of the way to its slide", () => {
    expect(pinchRelease({ scale: 0.95, sourceScale: 0.6, opening: false })).toBe(
      "fit",
    );
    expect(pinchRelease({ scale: 0.9, sourceScale: 0.6, opening: false })).toBe(
      "close",
    );
  });

  it("opens once a pinch from the slide has grown a fifth of the way", () => {
    expect(pinchRelease({ scale: 0.65, sourceScale: 0.6, opening: true })).toBe(
      "close",
    );
    expect(pinchRelease({ scale: 0.7, sourceScale: 0.6, opening: true })).toBe(
      "fit",
    );
  });
});

describe("lerpRect", () => {
  it("blends every edge", () => {
    expect(
      lerpRect(
        { left: 0, top: 0, width: 100, height: 50 },
        { left: 100, top: 40, width: 300, height: 150 },
        0.25,
      ),
    ).toEqual({ left: 25, top: 10, width: 150, height: 75 });
  });
});
