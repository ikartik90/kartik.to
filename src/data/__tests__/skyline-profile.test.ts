import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  SKYLINE_PROFILE,
  SKYLINE_PROFILE_BINS,
  SKYLINE_VIEWBOX_HEIGHT,
  SKYLINE_VIEWBOX_WIDTH,
  skylineTopAt,
} from "../skyline-profile";

// The profile is generated: after editing the drawing, re-run scripts/skyline-profile.mjs.

describe("SKYLINE_PROFILE", () => {
  it("has a reading for every slice of the drawing", () => {
    expect(SKYLINE_PROFILE).toHaveLength(SKYLINE_PROFILE_BINS);
  });

  it("stays inside the viewBox it was measured in", () => {
    for (const y of SKYLINE_PROFILE) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(SKYLINE_VIEWBOX_HEIGHT);
    }
  });

  it("is measured in the viewBox the footer actually draws", () => {
    const svg = readFileSync(
      "src/assets/illustrations/toronto-skyline.svg",
      "utf8",
    );
    expect(svg).toContain(
      `viewBox="0 0 ${SKYLINE_VIEWBOX_WIDTH} ${SKYLINE_VIEWBOX_HEIGHT}"`,
    );
  });

  it("finds the CN Tower's antenna at the middle of the drawing", () => {
    const tip = skylineTopAt(1968, 2027);
    expect(tip).toBeLessThan(30);
    expect(skylineTopAt(1700, 1900)).toBeGreaterThan(tip + 200);
    expect(skylineTopAt(2100, 2300)).toBeGreaterThan(tip + 200);
  });

  it("finds low buildings out at the waterfront edges", () => {
    expect(skylineTopAt(0, 200)).toBeGreaterThan(400);
    expect(skylineTopAt(3800, 4000)).toBeGreaterThan(400);
  });
});

describe("skylineTopAt", () => {
  it("answers with the HIGHEST point across the range, not an average", () => {
    expect(skylineTopAt(1500, 2500)).toBe(skylineTopAt(1968, 2027));
  });

  it("does not care which way round the range is given", () => {
    expect(skylineTopAt(2500, 1500)).toBe(skylineTopAt(1500, 2500));
  });

  it.each([
    [-4000, -3000],
    [9000, 12000],
  ])("clamps a range off the edge of the drawing (%i–%i)", (from, to) => {
    const answer = skylineTopAt(from, to);
    expect(Number.isFinite(answer)).toBe(true);
    expect(answer).toBeLessThanOrEqual(SKYLINE_VIEWBOX_HEIGHT);
  });

  it("reads a single slice as that slice", () => {
    const perBin = SKYLINE_VIEWBOX_WIDTH / SKYLINE_PROFILE_BINS;
    expect(skylineTopAt(perBin * 10, perBin * 10 + 1)).toBe(
      SKYLINE_PROFILE[10],
    );
  });
});
