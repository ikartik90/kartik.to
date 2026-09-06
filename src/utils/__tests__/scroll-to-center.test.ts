import { describe, expect, it } from "vitest";
import { scrollToCenter } from "../scroll-to-center";

// A 128px box (four 32px rows) over 224px of content — 96px of scroll to spend.
const box = { rowHeight: 32, boxHeight: 128, contentHeight: 224 };

describe("scrollToCenter", () => {
  it("puts the row in the middle of the box", () => {
    // Row 3 spans 96–128; its middle (112) lands on the box's middle (64).
    expect(scrollToCenter({ ...box, rowTop: 96 })).toBe(48);
  });

  it("settles flush against the top rather than scrolling backwards", () => {
    expect(scrollToCenter({ ...box, rowTop: 0 })).toBe(0);
    expect(scrollToCenter({ ...box, rowTop: 32 })).toBe(0);
  });

  it("settles flush against the foot rather than past the end", () => {
    // The last row of seven, which cannot be centred without overscrolling.
    expect(scrollToCenter({ ...box, rowTop: 192 })).toBe(96);
  });

  it("does not scroll content that already fits", () => {
    expect(
      scrollToCenter({ ...box, rowTop: 96, contentHeight: 128 }),
    ).toBe(0);
  });
});
