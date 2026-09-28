import { describe, expect, it } from "vitest";
import { carouselRestOffsets, carouselStep } from "../carousel-snap";

describe("carouselRestOffsets", () => {
  it("rests each slide `inset` from the start, as far as the scroll reaches", () => {
    expect(carouselRestOffsets([240, 900, 1560, 2220], 400, 1660)).toEqual([
      0, 500, 1160, 1660,
    ]);
  });

  it("rests a slide that starts inside the inset at the very start", () => {
    expect(carouselRestOffsets([240, 900], 400, 1000)).toEqual([0, 500]);
  });

  it("rests the last slide at its start like the others, short of the end", () => {
    expect(carouselRestOffsets([0, 500], 100, 800)).toEqual([0, 400]);
  });

  it("rests every slide that can't reach its place at the end, one offset per slide", () => {
    expect(carouselRestOffsets([240, 900, 1560, 2220], 400, 300)).toEqual([
      0, 300, 300, 300,
    ]);
  });

  it("has nowhere to rest without slides", () => {
    expect(carouselRestOffsets([], 400, 0)).toEqual([]);
  });
});

describe("carouselStep", () => {
  const offsets = [0, 500, 1160, 1660];

  it("skips offsets that repeat where it stands", () => {
    expect(carouselStep([0, 300, 300, 300], 0, 1)).toBe(300);
    expect(carouselStep([0, 300, 300, 300], 300, 1)).toBeNull();
    expect(carouselStep([0, 300, 300, 300], 300, -1)).toBe(0);
  });

  it("moves to the next rest offset", () => {
    expect(carouselStep(offsets, 0, 1)).toBe(500);
  });

  it("moves to the previous rest offset", () => {
    expect(carouselStep(offsets, 500, -1)).toBe(0);
  });

  it("has no step before the first or after the last", () => {
    expect(carouselStep(offsets, 0, -1)).toBeNull();
    expect(carouselStep(offsets, 1660, 1)).toBeNull();
  });

  it("treats a sub-pixel landing as resting on the offset", () => {
    expect(carouselStep(offsets, 499.6, 1)).toBe(1160);
    expect(carouselStep(offsets, 1659.5, 1)).toBeNull();
  });

  it("steps from between two offsets to the one in that direction", () => {
    expect(carouselStep(offsets, 700, 1)).toBe(1160);
    expect(carouselStep(offsets, 700, -1)).toBe(500);
  });
});
