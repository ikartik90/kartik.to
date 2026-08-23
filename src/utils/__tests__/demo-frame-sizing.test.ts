import { describe, expect, it } from "vitest";
import {
  DEMO_FRAME_CONTENT_PADDING_PX,
  DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX,
  DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
  DEMO_FRAME_LOGGER_SECTION_PX,
  getAspectRatioHeight,
  getDemoFrameAspectMinHeight,
  getDemoFrameLoggerOffset,
  getDemoFrameMinHeight,
  shouldOverrideDemoFrameAspectRatio,
  ASPECT_RATIOS,
  aspectCounterpart,
  isPortraitAspect,
} from "../demo-frame-sizing";
import type { DemoFrameAspectRatio } from "../demo-frame-sizing";

describe("demo-frame-sizing", () => {
  it("adds 40px padding to measured content height", () => {
    expect(getDemoFrameMinHeight(200)).toBe(200 + DEMO_FRAME_CONTENT_PADDING_PX);
  });

  it("adds 320px when logger is expanded", () => {
    expect(getDemoFrameLoggerOffset(true, true)).toBe(
      DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
    );
    expect(getDemoFrameMinHeight(200, true, true)).toBe(
      200 + DEMO_FRAME_CONTENT_PADDING_PX + DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
    );
  });

  it("adds 56px when logger is collapsed by default", () => {
    expect(getDemoFrameLoggerOffset(true)).toBe(
      DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX,
    );
    expect(getDemoFrameMinHeight(200, true)).toBe(
      200 + DEMO_FRAME_CONTENT_PADDING_PX + DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX,
    );
  });

  it("keeps deprecated constant aligned with expanded height", () => {
    expect(DEMO_FRAME_LOGGER_SECTION_PX).toBe(
      DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
    );
  });

  it("computes aspect-ratio heights from frame width", () => {
    expect(getAspectRatioHeight(800, "2/1")).toBe(400);
    expect(getAspectRatioHeight(900, "3/2")).toBe(600);
    expect(getAspectRatioHeight(960, "6/5")).toBe(800);
  });

  it("returns zero aspect-ratio height for non-positive widths", () => {
    expect(getAspectRatioHeight(0, "2/1")).toBe(0);
    expect(getAspectRatioHeight(-10, "3/2")).toBe(0);
  });

  it("includes logger height in aspect-ratio min height", () => {
    expect(getDemoFrameAspectMinHeight(800, "2/1", true, true)).toBe(
      400 + DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
    );
    expect(getDemoFrameAspectMinHeight(800, "2/1", true)).toBe(
      400 + DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX,
    );
  });

  it("overrides aspect ratio when content-driven min height is taller", () => {
    expect(shouldOverrideDemoFrameAspectRatio(500, 800, "2/1")).toBe(true);
  });

  it("keeps aspect ratio when it provides enough height", () => {
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "2/1")).toBe(false);
  });

  it("accounts for logger height when deciding aspect-ratio override", () => {
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "2/1", true, true)).toBe(
      false,
    );
    expect(shouldOverrideDemoFrameAspectRatio(400, 800, "2/1", true, true)).toBe(
      true,
    );
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "2/1", true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Orientation
//
// The grid's aspect picker shows one orientation at a time and flips between
// them, so every shape in the set has to have somewhere to flip TO.
// ---------------------------------------------------------------------------

const RATIOS = Object.keys(ASPECT_RATIOS) as DemoFrameAspectRatio[];

describe("aspectCounterpart", () => {
  // The invariant that makes the picker's orientation toggle possible at all:
  // an unpaired ratio added to the map would give the toggle a dead end, and
  // this is the test that stops it landing quietly.
  it("gives every ratio a counterpart that is itself a real ratio", () => {
    for (const ratio of RATIOS) {
      expect(ASPECT_RATIOS).toHaveProperty(aspectCounterpart(ratio));
    }
  });

  it("swaps landscape for portrait and back", () => {
    expect(aspectCounterpart("16/9")).toBe("9/16");
    expect(aspectCounterpart("9/16")).toBe("16/9");
    expect(aspectCounterpart("6/5")).toBe("5/6");
    expect(aspectCounterpart("2/1")).toBe("1/2");
  });

  // The square is its own counterpart, which is what lets the orientation
  // toggle stay pressable on a 1:1 card: the list flips, the shape does not.
  it("leaves the square alone", () => {
    expect(aspectCounterpart("1/1")).toBe("1/1");
  });

  it("is its own inverse", () => {
    for (const ratio of RATIOS) {
      expect(aspectCounterpart(aspectCounterpart(ratio))).toBe(ratio);
    }
  });
});

describe("isPortraitAspect", () => {
  it("calls a taller-than-wide shape portrait", () => {
    expect(isPortraitAspect("9/16")).toBe(true);
    expect(isPortraitAspect("3/4")).toBe(true);
    expect(isPortraitAspect("5/6")).toBe(true);
  });

  it("calls a wider-than-tall shape landscape", () => {
    expect(isPortraitAspect("16/9")).toBe(false);
    expect(isPortraitAspect("4/3")).toBe(false);
  });

  // The square is neither, and the picker has to open on SOME orientation, so
  // it counts as landscape rather than forcing every caller to special-case it.
  it("does not call the square portrait", () => {
    expect(isPortraitAspect("1/1")).toBe(false);
  });
});
