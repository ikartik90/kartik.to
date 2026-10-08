import { describe, expect, it } from "vitest";
import { openingLineDelay, openingStepDelay, PAGE_OPENING } from "../page-opening";

describe("page opening", () => {
  it("brings each line in a line's step after the one before", () => {
    expect([0, 1, 2].map(openingLineDelay)).toEqual([0, 100, 200]);
  });

  it("brings the first step in a page step after the last line, then each a page step apart", () => {
    expect([0, 1, 2].map((i) => openingStepDelay(3, i))).toEqual([350, 500, 650]);
  });

  it("times the steps far enough apart to read one by one", () => {
    expect(PAGE_OPENING.stepGapMs).toBeGreaterThan(PAGE_OPENING.lineGapMs);
  });
});
