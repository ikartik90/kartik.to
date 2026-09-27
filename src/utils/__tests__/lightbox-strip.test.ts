import { describe, expect, it } from "vitest";
import { stepTransit, stripSlots } from "../lightbox-strip";

describe("stripSlots", () => {
  it("shows a single item alone", () => {
    expect(stripSlots(0, 1, null)).toEqual([{ index: 0, slot: 0 }]);
  });

  it("puts the previous item a screen to the left and the next a screen to the right", () => {
    expect(stripSlots(1, 3, null)).toEqual([
      { index: 0, slot: -1 },
      { index: 1, slot: 0 },
      { index: 2, slot: 1 },
    ]);
  });

  it("wraps the neighbours at either end", () => {
    expect(stripSlots(0, 5, null)).toEqual([
      { index: 0, slot: 0 },
      { index: 1, slot: 1 },
      { index: 4, slot: -1 },
    ]);
  });

  it("waits a pair's other item on whichever side a swipe heads for", () => {
    expect(stripSlots(0, 2, null)).toEqual([
      { index: 0, slot: 0 },
      { index: 1, slot: "toward" },
    ]);
  });

  it("keeps a leaving item on the side it leaves by", () => {
    expect(
      stripSlots(1, 2, { rest: 0, leaving: [{ index: 0, slot: 1 }] }),
    ).toEqual([
      { index: 0, slot: 1 },
      { index: 1, slot: 0 },
    ]);
  });

  it("brings in no neighbour the strip didn't have at rest until it rests again", () => {
    expect(
      stripSlots(1, 5, { rest: 0, leaving: [{ index: 0, slot: -1 }] }),
    ).toEqual([
      { index: 0, slot: -1 },
      { index: 1, slot: 0 },
    ]);
  });

  it("keeps a neighbour it had at rest, on its new side", () => {
    expect(
      stripSlots(1, 3, { rest: 0, leaving: [{ index: 0, slot: -1 }] }),
    ).toEqual([
      { index: 0, slot: -1 },
      { index: 1, slot: 0 },
      { index: 2, slot: 1 },
    ]);
  });

  it("mounts no neighbour while the lightbox opens", () => {
    expect(stripSlots(1, 3, { rest: null, leaving: [] })).toEqual([
      { index: 1, slot: 0 },
    ]);
  });

  it("keeps the neighbours back through a step taken as the lightbox opens", () => {
    expect(
      stripSlots(2, 3, stepTransit({ rest: null, leaving: [] }, 1, 2, 1)),
    ).toEqual([
      { index: 1, slot: -1 },
      { index: 2, slot: 0 },
    ]);
  });

  it("holds a neighbour out of sight while a leaving item has its side", () => {
    expect(
      stripSlots(2, 5, { rest: 0, leaving: [{ index: 0, slot: -1 }] }),
    ).toEqual([
      { index: 0, slot: -1 },
      { index: 1, slot: null },
      { index: 2, slot: 0 },
    ]);
  });
});

describe("stepTransit", () => {
  it("sends the item stepped from out on the side it leaves by", () => {
    expect(stepTransit(null, 0, 1, 1)).toEqual({
      rest: 0,
      leaving: [{ index: 0, slot: -1 }],
    });
    expect(stepTransit(null, 1, 0, -1)).toEqual({
      rest: 1,
      leaving: [{ index: 1, slot: 1 }],
    });
  });

  it("moves what is still leaving along by a screen on a quick second step", () => {
    expect(
      stepTransit({ rest: 0, leaving: [{ index: 0, slot: -1 }] }, 1, 2, 1),
    ).toEqual({
      rest: 0,
      leaving: [
        { index: 0, slot: -2 },
        { index: 1, slot: -1 },
      ],
    });
  });

  it("takes back a leaving item that is stepped to again", () => {
    expect(
      stepTransit({ rest: 0, leaving: [{ index: 0, slot: -1 }] }, 1, 0, -1),
    ).toEqual({ rest: 0, leaving: [{ index: 1, slot: 1 }] });
  });
});
