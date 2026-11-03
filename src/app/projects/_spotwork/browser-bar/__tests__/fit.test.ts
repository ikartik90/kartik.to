import { describe, expect, it } from "vitest";
import { HIDE_ORDER, hiddenItems } from "../fit";

// Figma's bar at 1440 (SW Curie 25726:30182): every item shows, and with a 211px-wide field the whole bar needs 574.5.
const FIELD = 211;

describe("hiddenItems", () => {
  it("hides nothing while everything fits", () => {
    expect(hiddenItems(1440, FIELD)).toEqual([]);
    expect(hiddenItems(574.5, FIELD)).toEqual([]);
  });

  it("folds items into the menu from the right end first", () => {
    expect(hiddenItems(574, FIELD)).toEqual(["tabs"]);
  });

  it("counts the menu button once something is hidden", () => {
    // Without tabs the bar needs 572.5 with the menu button, 545.5 without it.
    expect(hiddenItems(572.5, FIELD)).toEqual(["tabs"]);
    expect(hiddenItems(572, FIELD)).toEqual(["tabs", "newTab"]);
  });

  it("keeps only the window controls and the field when nothing else fits", () => {
    expect(hiddenItems(300, FIELD)).toEqual(HIDE_ORDER);
  });
});
