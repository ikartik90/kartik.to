import { describe, expect, it } from "vitest";
import {
  hasRoomToScroll,
  resolveHandoff,
  type ScrollBox,
} from "../scroll-handoff";

/** A box 100 tall holding 300 of content, parked at the top unless said otherwise. */
const box = (over: Partial<ScrollBox> = {}): ScrollBox => ({
  scrollTop: 0,
  scrollHeight: 300,
  clientHeight: 100,
  scrollable: true,
  sealed: false,
  ...over,
});

/** A clipping wrapper: content taller than the box, and it moves for nobody. */
const clipped = (over: Partial<ScrollBox> = {}) =>
  box({ scrollable: false, ...over });

/** The same box scrolled to its last pixel. */
const atEnd = (over: Partial<ScrollBox> = {}) =>
  box({ scrollTop: 200, ...over });

/** A box with nothing to scroll — an option list of three rows. */
const short = (over: Partial<ScrollBox> = {}) =>
  box({ scrollHeight: 100, ...over });

const DOWN = 40;
const UP = -40;

describe("hasRoomToScroll", () => {
  it("is true for a box parked at the top asked to go down", () => {
    expect(hasRoomToScroll(box(), DOWN)).toBe(true);
  });

  it("is false for a box parked at the top asked to go up", () => {
    expect(hasRoomToScroll(box(), UP)).toBe(false);
  });

  it("is false at the end of the travel", () => {
    expect(hasRoomToScroll(atEnd(), DOWN)).toBe(false);
  });

  it("is true at the end of the travel asked to go back up", () => {
    expect(hasRoomToScroll(atEnd(), UP)).toBe(true);
  });

  it("is false for a box with no overflow at all", () => {
    expect(hasRoomToScroll(short(), DOWN)).toBe(false);
  });

  it("is false for a clipping wrapper, however much it overflows", () => {
    expect(hasRoomToScroll(clipped(), DOWN)).toBe(false);
  });

  it("counts a sub-pixel remainder as the end", () => {
    // Fractional layout leaves scrollTop a hair short of the maximum; a box the
    // user cannot see move is a box at its end.
    expect(hasRoomToScroll(box({ scrollTop: 199.6 }), DOWN)).toBe(false);
  });
});

describe("resolveHandoff", () => {
  it("leaves the event alone while the innermost list can still scroll", () => {
    expect(resolveHandoff([box(), box()], DOWN)).toBe(-1);
  });

  it("hands the wheel to the container once the list is at its end", () => {
    expect(resolveHandoff([atEnd(), box()], DOWN)).toBe(1);
  });

  it("hands off a list that never scrolled, so a short list is not a dead spot", () => {
    expect(resolveHandoff([short(), box()], DOWN)).toBe(1);
  });

  it("hands off upwards too, from the top of the list", () => {
    expect(resolveHandoff([box(), box({ scrollTop: 100 })], UP)).toBe(1);
  });

  it("passes over an ancestor that is itself at its end", () => {
    expect(resolveHandoff([atEnd(), atEnd(), box()], DOWN)).toBe(2);
  });

  it("stops when nothing outside the list has anywhere to go", () => {
    expect(resolveHandoff([atEnd(), atEnd(), short()], DOWN)).toBe(-1);
  });

  it("passes over a clipping wrapper rather than handing it the wheel", () => {
    expect(resolveHandoff([atEnd(), clipped(), box()], DOWN)).toBe(2);
  });

  it("stops at a clipping wrapper that seals — a popover shell", () => {
    expect(
      resolveHandoff([atEnd(), clipped({ sealed: true }), box()], DOWN),
    ).toBe(-1);
  });

  it("stops at a sealed ancestor — a popover keeps the page behind still", () => {
    expect(
      resolveHandoff([atEnd(), atEnd({ sealed: true }), box()], DOWN),
    ).toBe(-1);
  });

  it("scrolls a sealed ancestor that still has room, and no further", () => {
    expect(resolveHandoff([atEnd(), box({ sealed: true }), box()], DOWN)).toBe(
      1,
    );
  });

  it("stops when the list itself is sealed", () => {
    expect(resolveHandoff([atEnd({ sealed: true }), box()], DOWN)).toBe(-1);
  });

  it("has nothing to do without a delta", () => {
    expect(resolveHandoff([atEnd(), box()], 0)).toBe(-1);
  });

  it("has nothing to do with nothing above the list", () => {
    expect(resolveHandoff([atEnd()], DOWN)).toBe(-1);
  });
});
