import { describe, it, expect } from "vitest";
import { LISTING_SHARE, preloaderPercent } from "../icon-progress";

// ---------------------------------------------------------------------------
// The preloader's number.
//
// The load is two phases and the bar is one scale, which is the whole problem:
// an unknown-length listing followed by a counted set of files. Read off two
// scales it went up, then back to nothing, then up again.
// ---------------------------------------------------------------------------

describe("preloaderPercent", () => {
  it("keeps the trickle inside the listing's own slice", () => {
    // The trickle eases toward 0.9 and never reaches it, so the listing can
    // never spend more of the bar than it was given.
    expect(preloaderPercent({ loading: true, trickle: 0.9, progress: 0 }))
      .toBeLessThanOrEqual(LISTING_SHARE);
  });

  it("hands over forwards, not back to nothing", () => {
    // The bug, stated as a number: the furthest the trickle can get must not
    // be further than where the counting starts.
    const trickledOut = preloaderPercent({ loading: true, trickle: 0.9, progress: 0 });
    const firstCount = preloaderPercent({ loading: false, trickle: 0, progress: 0 });
    expect(firstCount).toBeGreaterThanOrEqual(trickledOut);
  });

  it("counts the files across the rest of the bar", () => {
    expect(preloaderPercent({ loading: false, trickle: 0, progress: 0.5 })).toBe(65);
  });

  it("finishes at a hundred", () => {
    expect(preloaderPercent({ loading: false, trickle: 0, progress: 1 })).toBe(100);
  });

  it("never goes backwards across a whole load", () => {
    // The listing trickling for a second, then two hundred files landing.
    const listing = [0.06, 0.14, 0.22, 0.29, 0.35, 0.9].map((trickle) =>
      preloaderPercent({ loading: true, trickle, progress: 0 }),
    );
    const files = Array.from({ length: 201 }, (_, arrived) =>
      preloaderPercent({ loading: false, trickle: 0, progress: arrived / 200 }),
    );

    const whole = [...listing, ...files];
    for (let i = 1; i < whole.length; i += 1) {
      expect(whole[i]).toBeGreaterThanOrEqual(whole[i - 1]);
    }
  });

  it("holds still rather than overrunning if the set grows mid-load", () => {
    // An upload during the first load adds to the denominator before its file
    // arrives, so the raw fraction dips. The bar is a promise about direction.
    expect(preloaderPercent({ loading: false, trickle: 0, progress: -0.1 }))
      .toBe(LISTING_SHARE);
    expect(preloaderPercent({ loading: false, trickle: 0, progress: 1.4 })).toBe(100);
  });
});
