import { describe, expect, it } from "vitest";
import { blockAt, dropSlot, slotIndex, slotLineY } from "../block-reorder";

// Three blocks in a 100–740 column, 20 apart: [0–100] [120–320] [340–400].
const BOXES = [
  { top: 0, bottom: 100, left: 100, right: 740 },
  { top: 120, bottom: 320, left: 100, right: 740 },
  { top: 340, bottom: 400, left: 100, right: 740 },
];

describe("blockAt", () => {
  const at = (x: number, y: number) => blockAt(BOXES, x, y, 40);

  it("finds the block under the point", () => {
    expect(at(400, 50)).toBe(0);
    expect(at(400, 200)).toBe(1);
    expect(at(400, 399)).toBe(2);
  });

  it("splits the gap between two blocks at its middle", () => {
    expect(at(400, 109)).toBe(0);
    expect(at(400, 111)).toBe(1);
  });

  it("reaches left of a block as far as its handle", () => {
    expect(at(60, 200)).toBe(1);
    expect(at(59, 200)).toBeNull();
  });

  it("finds nothing right of the column, above the first block or below the last", () => {
    expect(at(741, 200)).toBeNull();
    expect(at(400, -1)).toBeNull();
    expect(at(400, 401)).toBeNull();
  });
});

describe("dropSlot", () => {
  it("drops past every block whose middle is above the point", () => {
    expect(dropSlot(BOXES, 49)).toBe(0);
    expect(dropSlot(BOXES, 51)).toBe(1);
    expect(dropSlot(BOXES, 219)).toBe(1);
    expect(dropSlot(BOXES, 221)).toBe(2);
    expect(dropSlot(BOXES, 371)).toBe(3);
  });
});

describe("slotIndex", () => {
  it("leaves the block where it is in the slots either side of it", () => {
    expect(slotIndex(1, 1)).toBeNull();
    expect(slotIndex(1, 2)).toBeNull();
  });

  it("moves it up into an earlier slot", () => {
    expect(slotIndex(2, 0)).toBe(0);
    expect(slotIndex(2, 1)).toBe(1);
  });

  it("moves it down, counting the place it leaves", () => {
    expect(slotIndex(0, 2)).toBe(1);
    expect(slotIndex(0, 3)).toBe(2);
  });
});

describe("slotLineY", () => {
  it("draws the line in the middle of the gap it fills", () => {
    expect(slotLineY(BOXES, 1, 20)).toBe(110);
    expect(slotLineY(BOXES, 2, 20)).toBe(330);
  });

  it("stands half a gap off the first and last blocks", () => {
    expect(slotLineY(BOXES, 0, 20)).toBe(-10);
    expect(slotLineY(BOXES, 3, 20)).toBe(410);
  });
});
