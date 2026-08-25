import { describe, expect, it } from "vitest";
import { headingInto, type Box } from "../pointer-trajectory";

// A social row: wide, short, sitting above the pointer in these cases.
const ROW: Box = { left: 100, top: 100, right: 200, bottom: 120 };
const HORIZON = 300;

/** A move from `a` to `b` taking `ms`. */
const move = (a: [number, number], b: [number, number], ms = 100) =>
  [
    { x: a[0], y: a[1], t: 0 },
    { x: b[0], y: b[1], t: ms },
  ] as const;

describe("headingInto", () => {
  it("is true for a pointer travelling straight at the box", () => {
    const [from, to] = move([150, 300], [150, 250]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(true);
  });

  it("is true when the pointer is already inside the box", () => {
    const [from, to] = move([150, 300], [150, 110]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(true);
  });

  it("is true for a diagonal that clips the box within the horizon", () => {
    const [from, to] = move([260, 220], [230, 190]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(true);
  });

  it("is false for a pointer travelling away from the box", () => {
    const [from, to] = move([150, 300], [150, 350]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(false);
  });

  it("is false for a pointer crossing sideways below the box", () => {
    const [from, to] = move([100, 300], [200, 300]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(false);
  });

  it("is false for a pointer that has stopped", () => {
    const [from, to] = move([150, 300], [150, 300]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(false);
  });

  it("is false for a drift too slow to arrive within the horizon", () => {
    // 1px in 100ms — pointed at the box, but 180px short of it in 300ms.
    const [from, to] = move([150, 300], [150, 299]);
    expect(headingInto(from, to, ROW, HORIZON)).toBe(false);
  });

  it("is true for the same drift given a horizon long enough to reach", () => {
    const [from, to] = move([150, 300], [150, 290]);
    expect(headingInto(from, to, ROW, 2000)).toBe(true);
  });

  it("is false when the two samples share a timestamp", () => {
    const from = { x: 150, y: 300, t: 5 };
    const to = { x: 150, y: 250, t: 5 };
    expect(headingInto(from, to, ROW, HORIZON)).toBe(false);
  });

  it("is false for an empty box, which can never be arrived at", () => {
    const [from, to] = move([150, 300], [150, 250]);
    const empty: Box = { left: 150, top: 100, right: 150, bottom: 100 };
    expect(headingInto(from, to, empty, HORIZON)).toBe(false);
  });
});
