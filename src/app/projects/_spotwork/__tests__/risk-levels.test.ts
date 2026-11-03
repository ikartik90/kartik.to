import { describe, expect, it } from "vitest";
import { isHot, overall, radius } from "../risk-levels";

describe("radius", () => {
  it("puts none at the centre and low, medium and high equal steps out", () => {
    expect([0, 1, 2, 3].map(radius)).toEqual([0, 50, 100, 150]);
  });
});

describe("isHot", () => {
  it("lights the factor pointed at, and only that one", () => {
    expect(isHot("cancel", "cancel")).toBe(true);
    expect(isHot("cancel", "lateCancel")).toBe(false);
  });

  it("lights every factor at none when the centre they share is pointed at", () => {
    expect(isHot("cancel location company", "location")).toBe(true);
    expect(isHot("cancel location company", "worker")).toBe(false);
  });

  it("lights nothing when nothing is pointed at", () => {
    expect(isHot(null, "cancel")).toBe(false);
  });
});

describe("overall", () => {
  it("rates a worker high from 60% of the most they could score, medium from 30%, low below", () => {
    expect(overall([3, 3, 2, 1, 3, 0])).toBe(3);
    expect(overall([2, 0, 2, 1, 1, 3])).toBe(2);
    expect(overall([0, 0, 1, 1, 0, 0])).toBe(1);
  });
});
