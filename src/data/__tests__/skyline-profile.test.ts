import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  SKYLINE_PROFILE,
  SKYLINE_PROFILE_BINS,
  SKYLINE_VIEWBOX_HEIGHT,
  SKYLINE_VIEWBOX_WIDTH,
  skylineTopAt,
} from "../skyline-profile";

// ---------------------------------------------------------------------------
// The profile is GENERATED, so what is worth testing is not the arithmetic in
// `skylineTopAt` but whether the table still describes the picture it was taken
// from. A drawing edited without re-running `scripts/skyline-profile.mjs` would
// leave the homepage's testimonial band holding clear of a skyline that is no
// longer there — and nothing else in the app would notice.
// ---------------------------------------------------------------------------

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

  // The drawing's own contract, asserted here because the band reads it as a
  // constant: the viewBox is what `SiteFooter`'s test pins, and these numbers
  // are meaningless in any other one.
  it("is measured in the viewBox the footer actually draws", () => {
    const svg = readFileSync(
      "src/assets/illustrations/toronto-skyline.svg",
      "utf8",
    );
    expect(svg).toContain(
      `viewBox="0 0 ${SKYLINE_VIEWBOX_WIDTH} ${SKYLINE_VIEWBOX_HEIGHT}"`,
    );
  });

  // The tower is the whole reason the band needs a profile rather than a
  // number: it is the one place where the silhouette is hundreds of units
  // taller than a step either side of it.
  it("finds the CN Tower's antenna at the middle of the drawing", () => {
    const tip = skylineTopAt(1968, 2027);
    expect(tip).toBeLessThan(30);
    // ...and it is genuinely a spike, not a plateau: a step to either side and
    // the drawing drops away by hundreds of units.
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
    // A range containing the tower is a range the tower decides.
    expect(skylineTopAt(1500, 2500)).toBe(skylineTopAt(1968, 2027));
  });

  it("does not care which way round the range is given", () => {
    expect(skylineTopAt(2500, 1500)).toBe(skylineTopAt(1500, 2500));
  });

  // The band is wider than the drawing is ever shown at, so a column really can
  // ask about a slice past the end. Clamping keeps that an answer rather than
  // an `undefined` that would become a `NaN` margin.
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
