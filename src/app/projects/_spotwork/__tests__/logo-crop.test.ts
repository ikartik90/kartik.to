import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, clampOffset, sourceOf, spanOf } from "../logo-crop";

// A landscape picture, 768 × 512, and a square one.
const wide = { width: 768, height: 512 };
const square = { width: 300, height: 300 };

describe("a logo's crop", () => {
  it("zooms from the picture just covering the crop, its shorter side the crop's, to three times that", () => {
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([1, 3]);
    expect(spanOf(wide, 1)).toEqual({ width: 1.5, height: 1 });
    expect(spanOf(wide, 2)).toEqual({ width: 3, height: 2 });
    expect(spanOf(square, 1)).toEqual({ width: 1, height: 1 });
  });

  it("keeps the picture covering the crop wherever it's dragged", () => {
    expect(clampOffset(wide, 1, { x: 0.5, y: 0.2 })).toEqual({ x: 0.25, y: 0 });
    expect(clampOffset(wide, 1, { x: -0.5, y: -0.2 })).toEqual({ x: -0.25, y: 0 });
    expect(clampOffset(wide, 2, { x: -0.25, y: 0.4 })).toEqual({ x: -0.25, y: 0.4 });
    expect(clampOffset(square, 1, { x: 0.1, y: -0.1 })).toEqual({ x: 0, y: 0 });
  });

  it("finds the square of the picture that shows, in the picture's own pixels", () => {
    expect(sourceOf(wide, 1, { x: 0, y: 0 })).toEqual({ x: 128, y: 0, side: 512 });
    // Moved left and up a crop's quarter and sixth or so, the picture shows more of its right and foot.
    expect(sourceOf(wide, 2, { x: -0.25, y: -0.15625 })).toEqual({ x: 320, y: 168, side: 256 });
  });
});
