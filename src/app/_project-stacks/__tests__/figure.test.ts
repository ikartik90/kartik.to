import { describe, expect, it } from "vitest";
import { PHONE_CUT, phoneZoom, placeIn, zoomScale, type Point } from "../figure";

describe("phoneZoom", () => {
  it("takes the drawing's size, with room for its shift either way so it never runs into an edge", () => {
    const bounds: Point[] = [
      [-50, -25],
      [50, 25],
    ];
    expect(phoneZoom(bounds, -4)).toEqual({ width: 100, cut: PHONE_CUT, height: 58 });
  });
});

describe("zoomScale", () => {
  it("starts the drawing at the heading's edge and runs `cut` of it off the right", () => {
    expect(zoomScale({ width: 300, cut: 1 / 3 }, { width: 216, height: 600, foot: 100, left: 16 })).toBeCloseTo(1);
  });

  it("stops where the drawing would come within the heading's inset of the heading or the foot", () => {
    expect(
      zoomScale({ width: 300, cut: 1 / 3, height: 200 }, { width: 216, height: 300, foot: 100, left: 16 }),
    ).toBeCloseTo(0.84);
  });
});

describe("placeIn", () => {
  it("centres the drawing under the heading in the 4:3 frame", () => {
    const bounds: Point[] = [
      [0, 0],
      [100, 50],
    ];
    expect(placeIn({ width: 533, height: 400, top: 0 }, bounds)).toEqual([216.5, 175]);
  });

  it("zoomed in, starts the drawing at the heading's edge and centres what shows of it under the heading", () => {
    // A lane rising to the right, wider than the frame.
    const lane: Point[] = [
      [0, 100],
      [300, -50],
      [300, 0],
      [0, 150],
    ];
    const [dx, dy] = placeIn({ width: 200, height: 400, top: 100, left: 10 }, lane);
    expect(dx).toBeCloseTo(10);
    expect(dy).toBeCloseTo(172.5);
  });

  it("zoomed in, centres a drawing narrower than the frame across it", () => {
    const bounds: Point[] = [
      [0, 0],
      [100, 50],
    ];
    expect(placeIn({ width: 400, height: 400, top: 100, left: 10 }, bounds)).toEqual([150, 225]);
  });
});
