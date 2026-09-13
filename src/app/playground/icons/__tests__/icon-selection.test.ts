import { describe, expect, it } from "vitest";
import {
  MARQUEE_THRESHOLD,
  isDragging,
  keysWithin,
  marqueeRect,
  selectionAfterClick,
  selectionAfterMarquee,
  type TileBox,
} from "../icon-selection";

// A row of three tiles, 100 wide with a 10 gap, and one directly under the
// first — the smallest grid that can tell a sweep from a block.
const TILES: TileBox[] = [
  { key: "a", left: 0, top: 0, right: 100, bottom: 100 },
  { key: "b", left: 110, top: 0, right: 210, bottom: 100 },
  { key: "c", left: 220, top: 0, right: 320, bottom: 100 },
  { key: "d", left: 0, top: 110, right: 100, bottom: 210 },
];

describe("selectionAfterClick", () => {
  it("takes one icon and lets go of the rest", () => {
    // The whole point of the change: a plain press is "this one", not "this
    // one as well". A set you have to empty by hand before starting again is
    // a set you fight.
    expect(selectionAfterClick(["a", "b"], "c", false)).toEqual(["c"]);
  });

  it("lets go of an icon pressed again, down to nothing selected", () => {
    // A press toggles the icon it lands on. There is no floor at one: the
    // panel has no Clear button, so pressing the last icon again IS how a
    // selection is emptied.
    expect(selectionAfterClick(["c"], "c", false)).toEqual([]);
  });

  it("drops the rest when the press lands on one that was already taken", () => {
    // Shift is the only thing that keeps the others. Without it a press says
    // "this one alone" on the way in and "not this one either" on the way
    // out — the icon toggles, and the rest are let go of regardless.
    expect(selectionAfterClick(["a", "b", "c"], "b", false)).toEqual([]);
  });

  it("adds to the set when the press is additive", () => {
    expect(selectionAfterClick(["a"], "b", true)).toEqual(["a", "b"]);
  });

  it("takes one back out when the additive press lands on a taken icon", () => {
    // Shift is how you correct a selection, so it has to work both ways —
    // otherwise an icon caught by mistake can only be fixed by starting over.
    expect(selectionAfterClick(["a", "b", "c"], "b", true)).toEqual(["a", "c"]);
  });

  it("starts a set from nothing, additive or not", () => {
    expect(selectionAfterClick([], "a", false)).toEqual(["a"]);
    expect(selectionAfterClick([], "a", true)).toEqual(["a"]);
  });
});

describe("isDragging", () => {
  it("is not a drag until the pointer has really moved", () => {
    // A press is never perfectly still; without a threshold every click
    // would sweep a one-pixel band and read as a drag.
    const origin = { x: 100, y: 100 };
    expect(isDragging(origin, { x: 100, y: 100 })).toBe(false);
    expect(isDragging(origin, { x: 100 + MARQUEE_THRESHOLD - 1, y: 100 })).toBe(false);
  });

  it("is a drag once it has, in either axis and either direction", () => {
    const origin = { x: 100, y: 100 };
    expect(isDragging(origin, { x: 100 + MARQUEE_THRESHOLD, y: 100 })).toBe(true);
    expect(isDragging(origin, { x: 100, y: 100 - MARQUEE_THRESHOLD })).toBe(true);
  });
});

describe("marqueeRect", () => {
  it("is the box between the two points", () => {
    expect(marqueeRect({ x: 10, y: 20 }, { x: 110, y: 220 })).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 200,
    });
  });

  it("is the same box dragged the other way", () => {
    // Normalised, because a band drawn up and to the left is a band.
    expect(marqueeRect({ x: 110, y: 220 }, { x: 10, y: 20 })).toEqual({
      left: 10,
      top: 20,
      width: 100,
      height: 200,
    });
  });
});

describe("keysWithin", () => {
  it("takes every icon the band touches, not only those it swallows", () => {
    // Sweeping across a row clips the tops of the tiles rather than
    // enclosing them; requiring containment would select nothing at all.
    expect(keysWithin(TILES, { left: 50, top: 40, width: 120, height: 10 })).toEqual([
      "a",
      "b",
    ]);
  });

  it("leaves out what it does not reach", () => {
    expect(keysWithin(TILES, { left: 0, top: 0, width: 50, height: 50 })).toEqual(["a"]);
  });

  it("takes a block when the band covers two rows", () => {
    expect(
      keysWithin(TILES, { left: 0, top: 0, width: 130, height: 130 }),
    ).toEqual(["a", "b", "d"]);
  });

  it("takes nothing from a band that has touched nothing yet", () => {
    expect(keysWithin(TILES, { left: 104, top: 0, width: 2, height: 2 })).toEqual([]);
  });

  it("answers in the grid's own order, not the order they were swept", () => {
    // A download is named and zipped in listing order, so the selection has
    // to be a set rather than a record of how the pointer travelled.
    expect(keysWithin(TILES, { left: 0, top: 0, width: 320, height: 10 })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("selectionAfterMarquee", () => {
  it("is the swept icons, and only those", () => {
    expect(selectionAfterMarquee(["a", "d"], ["b", "c"], false)).toEqual(["b", "c"]);
  });

  it("adds to what was already taken when the drag is additive", () => {
    expect(selectionAfterMarquee(["a"], ["b", "c"], true)).toEqual(["a", "b", "c"]);
  });

  it("never takes the same icon twice", () => {
    expect(selectionAfterMarquee(["a", "b"], ["b", "c"], true)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("empties the set when an additive drag sweeps nothing", () => {
    expect(selectionAfterMarquee(["a"], [], false)).toEqual([]);
    expect(selectionAfterMarquee(["a"], [], true)).toEqual(["a"]);
  });
});
