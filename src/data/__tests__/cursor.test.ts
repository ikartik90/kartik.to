import { describe, expect, it } from "vitest";
import { getCursorTooltipPosition } from "../cursor";

describe("getCursorTooltipPosition", () => {
  it("places the tooltip at the bottom-right of the selection cursor", () => {
    expect(getCursorTooltipPosition(100, 200)).toEqual({
      left: "115px",
      top: "217px",
    });
  });
});
