import { describe, expect, it } from "vitest";
import { containedSize } from "../contained-size";

describe("containedSize", () => {
  it("fits a wide picture to the box's width", () => {
    expect(containedSize({ width: 1600, height: 900 }, 1000, 1000)).toEqual({
      width: 1000,
      height: 562.5,
    });
  });

  it("fits a tall picture to the box's height", () => {
    expect(containedSize({ width: 900, height: 1600 }, 1000, 1000)).toEqual({
      width: 562.5,
      height: 1000,
    });
  });

  it("leaves a picture of the box's own shape filling it", () => {
    expect(containedSize({ width: 32, height: 18 }, 1600, 900)).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("has no answer for a picture whose shape was never recorded", () => {
    expect(containedSize({}, 1000, 1000)).toBeNull();
    expect(containedSize({ width: 100 }, 1000, 1000)).toBeNull();
    expect(containedSize({ width: 0, height: 0 }, 1000, 1000)).toBeNull();
  });
});
