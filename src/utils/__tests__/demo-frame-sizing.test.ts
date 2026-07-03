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
} from "../demo-frame-sizing";

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
    expect(getAspectRatioHeight(800, "sm")).toBe(400);
    expect(getAspectRatioHeight(900, "md")).toBe(600);
    expect(getAspectRatioHeight(500, "lg")).toBe(600);
  });

  it("returns zero aspect-ratio height for non-positive widths", () => {
    expect(getAspectRatioHeight(0, "sm")).toBe(0);
    expect(getAspectRatioHeight(-10, "md")).toBe(0);
  });

  it("includes logger height in aspect-ratio min height", () => {
    expect(getDemoFrameAspectMinHeight(800, "sm", true, true)).toBe(
      400 + DEMO_FRAME_LOGGER_SECTION_EXPANDED_PX,
    );
    expect(getDemoFrameAspectMinHeight(800, "sm", true)).toBe(
      400 + DEMO_FRAME_LOGGER_SECTION_COLLAPSED_PX,
    );
  });

  it("overrides aspect ratio when content-driven min height is taller", () => {
    expect(shouldOverrideDemoFrameAspectRatio(500, 800, "sm")).toBe(true);
  });

  it("keeps aspect ratio when it provides enough height", () => {
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "sm")).toBe(false);
  });

  it("accounts for logger height when deciding aspect-ratio override", () => {
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "sm", true, true)).toBe(
      false,
    );
    expect(shouldOverrideDemoFrameAspectRatio(400, 800, "sm", true, true)).toBe(
      true,
    );
    expect(shouldOverrideDemoFrameAspectRatio(100, 800, "sm", true)).toBe(false);
  });
});
