import { describe, expect, it } from "vitest";
import { getAnchoredTooltipPosition, getCursorTooltipPosition } from "../cursor";

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

  it("slides left just far enough to clear the edge, and drops", () => {
    expect(
      getCursorTooltipPosition(960, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "219px" });
  });

  it("leaves exactly the edge gap and no more", () => {
    const { left } = getCursorTooltipPosition(960, 200, {
      width: 120,
      viewportWidth: 1000,
    });
    expect(1000 - (parseFloat(left) + 120)).toBe(4);
  });

  it("shifts by only as much as it overflows", () => {
    expect(
      getCursorTooltipPosition(862, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "219px" });
  });

  it("has not moved at the last position that fits", () => {
    expect(
      getCursorTooltipPosition(861, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "217px" });
  });

  it("never pins past the left edge", () => {
    expect(
      getCursorTooltipPosition(5, 200, { width: 400, viewportWidth: 320 }),
    ).toEqual({ left: "4px", top: "219px" });
  });

  describe("with a docked panel holding the right edge", () => {
    it("slides clear of the panel rather than the viewport", () => {
      expect(
        getCursorTooltipPosition(900, 200, {
          width: 73,
          viewportWidth: 1280,
          reservedRight: 332,
        }),
      ).toEqual({ left: "871px", top: "219px" });
    });

    it("stays at the bottom-right when nothing is reserved", () => {
      expect(
        getCursorTooltipPosition(900, 200, { width: 73, viewportWidth: 1280 }),
      ).toEqual({ left: "915px", top: "217px" });
    });

    it("gives the whole viewport back to a pointer already on the panel", () => {
      expect(
        getCursorTooltipPosition(1100, 200, {
          width: 73,
          viewportWidth: 1280,
          reservedRight: 332,
        }),
      ).toEqual({ left: "1115px", top: "217px" });
    });

    it("still pins clear of the left edge when it fits nowhere", () => {
      expect(
        getCursorTooltipPosition(200, 200, {
          width: 300,
          viewportWidth: 640,
          reservedRight: 332,
        }),
      ).toEqual({ left: "4px", top: "219px" });
    });
  });
});

describe("getAnchoredTooltipPosition", () => {
  const anchor = { left: 400, width: 100, bottom: 300 };

  it("hangs centred under the anchor, by the gap", () => {
    expect(getAnchoredTooltipPosition(anchor, { width: 60, viewportWidth: 1000 }))
      .toEqual({ left: "420px", top: "302px" });
  });

  it("centres a label wider than the thing it names", () => {
    expect(getAnchoredTooltipPosition(anchor, { width: 200, viewportWidth: 1000 }))
      .toEqual({ left: "350px", top: "302px" });
  });

  it("holds its height when it has to slide", () => {
    const { top } = getAnchoredTooltipPosition(
      { left: 940, width: 40, bottom: 300 },
      { width: 120, viewportWidth: 1000 },
    );
    expect(top).toBe("302px");
  });

  it("slides in from the near edge, leaving the gap", () => {
    expect(
      getAnchoredTooltipPosition(
        { left: 940, width: 40, bottom: 300 },
        { width: 120, viewportWidth: 1000 },
      ).left,
    ).toBe("876px");
  });

  it("keeps clear of the far edge too", () => {
    expect(
      getAnchoredTooltipPosition(
        { left: 0, width: 40, bottom: 300 },
        { width: 120, viewportWidth: 1000 },
      ).left,
    ).toBe("4px");
  });

  it("measures the near edge against a docked panel, not the viewport", () => {
    expect(
      getAnchoredTooltipPosition(
        { left: 600, width: 40, bottom: 300 },
        { width: 120, viewportWidth: 1000, reservedRight: 360 },
      ).left,
    ).toBe("516px");
  });

  it("is the plain placement with nothing measured", () => {
    expect(getAnchoredTooltipPosition(anchor)).toEqual({
      left: "400px",
      top: "302px",
    });
  });
});
