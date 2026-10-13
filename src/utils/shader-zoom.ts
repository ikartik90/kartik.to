import { SHADER_PRESET_PREVIEW_PX } from "@/domain/shader-preset";

/** `ShaderMount`'s own `minPixelRatio` default. */
const LIBRARY_MIN_PIXEL_RATIO = 2;

export interface ShaderZoom {
  /** The box's long edge over the preview's; the stage is laid out at 1/zoom and scaled back. */
  zoom: number;
  minPixelRatio: number;
  maxPixelCount: number;
}

/**
 * Draws a preset into a `width` × `height` box as the preview would at its own size, scaled. The pixel limits keep
 * the buffer at the box's device pixels: the stage's layout size is the preview's, not the box's.
 */
export function shaderZoom(
  width: number,
  height: number,
  devicePixelRatio: number,
): ShaderZoom | null {
  if (width <= 0 || height <= 0) return null;

  const zoom = Math.max(width, height) / SHADER_PRESET_PREVIEW_PX;
  const ratio = Math.max(devicePixelRatio, LIBRARY_MIN_PIXEL_RATIO);
  return {
    zoom,
    minPixelRatio: ratio * zoom,
    maxPixelCount: Math.round(width * ratio) * Math.round(height * ratio),
  };
}
