import { describe, expect, it } from "vitest";
import { NO_ROWS, closeSheet, pressBox, pressRow, type RowSelection } from "../row-selection";

const rows = (sheet: string | null, ...picked: string[]): RowSelection => ({ picked: new Set(picked), sheet });
const state = ({ picked, sheet }: RowSelection) => ({ picked: [...picked].toSorted(), sheet });

describe("pressing a row", () => {
  it("picks it alone and opens its sheet", () => {
    expect(state(pressRow(NO_ROWS, "a"))).toEqual({ picked: ["a"], sheet: "a" });
  });

  it("leaves only it picked when several are, and opens its sheet", () => {
    expect(state(pressRow(rows(null, "a", "b", "c"), "b"))).toEqual({ picked: ["b"], sheet: "b" });
    expect(state(pressRow(rows(null, "a", "b", "c"), "d"))).toEqual({ picked: ["d"], sheet: "d" });
  });

  it("moves the sheet to it from another row's", () => {
    expect(state(pressRow(rows("a", "a"), "b"))).toEqual({ picked: ["b"], sheet: "b" });
  });

  it("opens the sheet of a row only its checkbox picked, keeping it picked", () => {
    expect(state(pressRow(rows(null, "a"), "a"))).toEqual({ picked: ["a"], sheet: "a" });
  });

  it("closes the sheet it opened and unpicks its row, when pressed again", () => {
    expect(state(pressRow(rows("a", "a"), "a"))).toEqual({ picked: [], sheet: null });
  });
});

describe("pressing a checkbox", () => {
  it("picks or unpicks its row, with no sheet open", () => {
    expect(state(pressBox(NO_ROWS, ["a"], true))).toEqual({ picked: ["a"], sheet: null });
    expect(state(pressBox(rows(null, "a", "b"), ["a"], false))).toEqual({ picked: ["b"], sheet: null });
  });

  it("closes the open sheet and keeps its row picked when another row's box is picked", () => {
    expect(state(pressBox(rows("a", "a"), ["b"], true))).toEqual({ picked: ["a", "b"], sheet: null });
  });

  it("closes the open sheet and unpicks its row, when its own box is unpicked", () => {
    expect(state(pressBox(rows("a", "a"), ["a"], false))).toEqual({ picked: [], sheet: null });
  });

  it("takes every row of a bulk press, closing the open sheet", () => {
    expect(state(pressBox(rows("a", "a"), ["a", "b", "c"], true))).toEqual({ picked: ["a", "b", "c"], sheet: null });
    expect(state(pressBox(rows("a", "a"), ["a", "b", "c"], false))).toEqual({ picked: [], sheet: null });
  });

  it("changes a new set, never the one it was given", () => {
    const before = rows("a", "a");
    pressBox(before, ["b"], true);
    pressRow(before, "b");
    expect(state(before)).toEqual({ picked: ["a"], sheet: "a" });
  });
});

describe("closing the sheet", () => {
  it("leaves every row picked", () => {
    expect(state(closeSheet(rows("a", "a")))).toEqual({ picked: ["a"], sheet: null });
  });
});
