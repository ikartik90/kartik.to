import { describe, expect, it } from "vitest";
import { SHADER_PRESET_PREVIEW_PX } from "@/domain/shader-preset";
import { shaderZoom } from "../shader-zoom";

const PREVIEW = SHADER_PRESET_PREVIEW_PX;

describe("shaderZoom", () => {
  it("draws a box the preview's size at the preview's scale", () => {
    expect(shaderZoom(PREVIEW, PREVIEW * (2 / 3), 2)?.zoom).toBe(1);
  });

  it("scales by the long edge, landscape or portrait", () => {
    expect(shaderZoom(PREVIEW / 2, PREVIEW / 3, 2)?.zoom).toBe(0.5);
    expect(shaderZoom(PREVIEW / 3, PREVIEW / 2, 2)?.zoom).toBe(0.5);
    expect(shaderZoom(PREVIEW * 2, PREVIEW, 2)?.zoom).toBe(2);
  });

  it("caps the buffer at the box's own device pixels, not the preview's", () => {
    expect(shaderZoom(470, 307, 2)?.maxPixelCount).toBe(940 * 614);
    expect(shaderZoom(470, 307, 3)?.maxPixelCount).toBe(1410 * 921);
  });

  it("keeps the library's 2× floor on a 1× screen", () => {
    expect(shaderZoom(470, 307, 1)?.maxPixelCount).toBe(940 * 614);
  });

  it("raises the pixel ratio by the zoom, so a box larger than the preview isn't upscaled", () => {
    expect(shaderZoom(PREVIEW * 2, PREVIEW, 2)?.minPixelRatio).toBe(4);
    expect(shaderZoom(PREVIEW * 2, PREVIEW, 1)?.minPixelRatio).toBe(4);
    expect(shaderZoom(PREVIEW / 2, PREVIEW / 4, 3)?.minPixelRatio).toBe(1.5);
  });

  it("has nothing to draw into an empty box", () => {
    expect(shaderZoom(0, 0, 2)).toBeNull();
    expect(shaderZoom(0, 300, 2)).toBeNull();
  });
});
