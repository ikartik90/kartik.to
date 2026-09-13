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

  // A control in the right-hand gutter opens its label straight into the near
  // edge. It does not leap to the far side of the cursor: it slides left by
  // exactly enough to leave the edge gap, and drops clear of the cursor glyph
  // it is now sitting under.
  it("slides left just far enough to clear the edge, and drops", () => {
    expect(
      getCursorTooltipPosition(960, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "219px" });
  });

  // The shift is the MINIMUM one: 876 + 120 lands 4px short of 1000, and one
  // pixel further right would not.
  it("leaves exactly the edge gap and no more", () => {
    const { left } = getCursorTooltipPosition(960, 200, {
      width: 120,
      viewportWidth: 1000,
    });
    expect(1000 - (parseFloat(left) + 120)).toBe(4);
  });

  // A pixel of overflow costs a pixel of travel, not a jump across the cursor.
  it("shifts by only as much as it overflows", () => {
    expect(
      getCursorTooltipPosition(862, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "219px" });
  });

  // One pixel earlier it still fits, so it has not moved at all — the pair is
  // what pins "minimum deviation" rather than "some deviation".
  it("has not moved at the last position that fits", () => {
    expect(
      getCursorTooltipPosition(861, 200, { width: 120, viewportWidth: 1000 }),
    ).toEqual({ left: "876px", top: "217px" });
  });

  // Below is still off the edge on a narrow viewport, so the label gives up
  // hanging from the cursor before it gives up being readable, and pins clear
  // of the far edge instead.
  it("never pins past the left edge", () => {
    expect(
      getCursorTooltipPosition(5, 200, { width: 400, viewportWidth: 320 }),
    ).toEqual({ left: "4px", top: "219px" });
  });

  // A docked properties panel is `position: fixed` over the right of the
  // viewport, so the label fitting ON SCREEN is not the same as the label being
  // SEEN. Everything from the panel's near edge rightwards is spoken for, and
  // that edge is the one the gap is measured from.
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

    // The regression this pair guards: the same geometry without the panel
    // fits, which is exactly why the old test never caught it.
    it("stays at the bottom-right when nothing is reserved", () => {
      expect(
        getCursorTooltipPosition(900, 200, { width: 73, viewportWidth: 1280 }),
      ).toEqual({ left: "915px", top: "217px" });
    });

    // The rail is only in the way of a label drawn over the PAGE. A control
    // inside the rail opens its own label there, and sliding that one out into
    // the page is the panel's own tooltips being pushed off the panel.
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

// ---------------------------------------------------------------------------
// The other placement: hung under the thing it names rather than the cursor.
//
// For a label whose subject is already marked on the page — a selected tile in
// the icons grid — where a box trailing the pointer would be saying which icon
// you are pointing at, a question the highlight has already answered.
// ---------------------------------------------------------------------------

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
    // Unlike the cursor placement, there is no glyph under it to drop clear
    // of — sliding along the anchor's edge keeps it level.
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

  // A docked properties panel lies OVER the page, so fitting on screen and
  // being seen are different questions — the same reserved strip the cursor
  // placement respects.
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
