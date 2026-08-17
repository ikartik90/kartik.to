import { describe, expect, it } from "vitest";
import { getCursorTooltipPosition } from "../cursor";

describe("getCursorTooltipPosition", () => {
  it("places the tooltip at the bottom-right of the selection cursor", () => {
    expect(getCursorTooltipPosition(100, 200)).toEqual({
      left: "115px",
      top: "217px",
    });
  });

  it("stays at the bottom-right while the label still fits", () => {
    expect(
      getCursorTooltipPosition(100, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "115px", top: "217px" });
  });

  // A control in the right-hand gutter opens its label INTO the edge. The
  // label then hangs from the same point by its other corner, which puts it
  // under the cursor rather than out beside it.
  it("hangs below the cursor when the label would run off the edge", () => {
    expect(
      getCursorTooltipPosition(960, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "855px", top: "217px" });
  });

  // Below is still off the edge on a narrow viewport, so the label gives up
  // hanging from the cursor before it gives up being readable.
  it("pins to the edge when it fits nowhere", () => {
    expect(
      getCursorTooltipPosition(200, 200, { width: 300, viewportWidth: 320 }),
    ).toEqual({ left: "12px", top: "217px" });
  });

  it("never pins past the left edge", () => {
    expect(
      getCursorTooltipPosition(5, 200, { width: 400, viewportWidth: 320 }),
    ).toEqual({ left: "12px", top: "217px" });
  });
});
