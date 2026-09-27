import { describe, expect, it } from "vitest";
import {
  edgeScrollSpeed,
  reorderShifts,
  reorderTarget,
  scrollToKeep,
  settleOffset,
} from "../carousel-reorder";

// Three slides 100, 200 and 100 wide, 10 apart, the first starting at 0:
// [0–100] [110–310] [320–420].
const WIDTHS = [100, 200, 100];
const GAP = 10;

describe("reorderShifts", () => {
  it("moves nothing while the slide is still in its place", () => {
    expect(reorderShifts(WIDTHS, GAP, 1, 1)).toEqual([0, 0, 0]);
  });

  it("slides the ones it passes back by its width and a gap", () => {
    // [1] [2] [0]: slide 0 lands at 320; 1 and 2 close up by 110.
    expect(reorderShifts(WIDTHS, GAP, 0, 2)).toEqual([320, -110, -110]);
  });

  it("slides the ones it passes on by its width and a gap", () => {
    // [0] [2] [1]: slide 2 lands at 110; slide 1 moves on by 110.
    expect(reorderShifts(WIDTHS, GAP, 2, 1)).toEqual([0, 110, -210]);
  });
});

describe("reorderTarget", () => {
  const target = (from: number, to: number, x: number) =>
    reorderTarget({ widths: WIDTHS, gap: GAP, origin: 0, from, to, x });

  it("stays put over its own place", () => {
    expect(target(0, 0, 50)).toBe(0);
  });

  it("moves on once past the middle of the next slide", () => {
    // Slide 1 is centred on 210 with slide 0 still first.
    expect(target(0, 0, 200)).toBe(0);
    expect(target(0, 0, 220)).toBe(1);
  });

  it("runs past every slide the pointer has crossed at once", () => {
    expect(target(0, 0, 415)).toBe(2);
  });

  it("moves back once before the middle of the slide before", () => {
    // [0] [2] [1]: slide 2 is centred on 160 and slide 0 on 50.
    expect(target(1, 2, 60)).toBe(1);
    expect(target(1, 1, 40)).toBe(0);
  });

  it("holds still where it has just moved, rather than flickering back", () => {
    // Having moved past slide 1's middle, slide 1 now sits first, centred on 100.
    expect(target(0, 1, 220)).toBe(1);
  });
});

describe("edgeScrollSpeed", () => {
  const speed = (x: number) =>
    edgeScrollSpeed({ x, left: 0, right: 1000, zone: 100, max: 2 });

  it("is still away from the edges", () => {
    expect(speed(500)).toBe(0);
    expect(speed(100)).toBe(0);
    expect(speed(900)).toBe(0);
  });

  it("scrolls back near the left edge and on near the right", () => {
    expect(speed(50)).toBeLessThan(0);
    expect(speed(950)).toBeGreaterThan(0);
  });

  it("speeds up towards the edge", () => {
    expect(speed(960)).toBeLessThan(speed(990));
    expect(speed(1000)).toBe(2);
    expect(speed(0)).toBe(-2);
  });

  it("goes no faster past the edge", () => {
    expect(speed(1200)).toBe(2);
    expect(speed(-50)).toBe(-2);
  });
});

describe("scrollToKeep", () => {
  it("scrolls so the same share of the slide stays under the pointer", () => {
    // A slide now at 600–700 in the track, held a quarter of the way in, under a pointer 300px into the scroller.
    expect(
      scrollToKeep({
        start: 600,
        width: 100,
        share: 0.25,
        pointer: 300,
        max: 5000,
      }),
    ).toBe(325);
  });

  it("stays inside the scroll range", () => {
    const keep = (pointer: number, max: number) =>
      scrollToKeep({ start: 600, width: 100, share: 0.5, pointer, max });
    expect(keep(900, 5000)).toBe(0);
    expect(keep(100, 200)).toBe(200);
  });

  it("stays at the start when everything fits", () => {
    expect(
      scrollToKeep({ start: 600, width: 100, share: 0.5, pointer: 100, max: -60 }),
    ).toBe(0);
  });
});

describe("settleOffset", () => {
  // Rest offsets 0, 300, 600; a 500px-wide scroller.
  const settle = (anchored: number, start: number, width = 100) =>
    settleOffset({
      offsets: [0, 300, 600],
      anchored,
      start,
      width,
      viewport: 500,
    });

  it("comes to rest at the stop nearest where the drop left it", () => {
    expect(settle(280, 450)).toBe(300);
  });

  it("passes over a nearer stop that would cut the dropped slide off", () => {
    // At 0 the slide (650–750) would sit past the scroller's end.
    expect(settle(100, 650)).toBe(300);
  });

  it("falls back to the nearest stop when none shows it whole", () => {
    expect(settle(280, 100, 900)).toBe(300);
  });
});
