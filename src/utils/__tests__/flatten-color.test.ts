import { describe, expect, it } from "vitest";
import { flattenColor } from "../flatten-color";

describe("flattenColor", () => {
  const white = [255, 255, 255, 1] as const;

  it("paints an opaque colour at full share as itself", () => {
    expect(flattenColor([10, 20, 30, 1], white, 1)).toBe("rgb(10, 20, 30)");
  });

  it("leaves the ground showing at no share", () => {
    expect(flattenColor([10, 20, 30, 1], white, 0)).toBe("rgb(255, 255, 255)");
  });

  it("mixes by the colour's own alpha times the share", () => {
    expect(flattenColor([0, 0, 0, 0.5], white, 1)).toBe("rgb(128, 128, 128)");
    expect(flattenColor([0, 0, 0, 1], white, 0.5)).toBe("rgb(128, 128, 128)");
    expect(flattenColor([0, 0, 0, 0.5], white, 0.5)).toBe("rgb(191, 191, 191)");
  });
});
