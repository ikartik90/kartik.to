import { sourceExtension } from "@/utils/media-source";

/** JPEG only; other picture formats can carry alpha. Pictures only: callers filter clips by `kind`. */
const OPAQUE_EXTENSIONS = ["jpg", "jpeg", "jfif", "pjpeg", "pjp"];

/** Not 255: the scan runs on a downscaled copy, which averages edge alpha down slightly. */
export const ALPHA_OPAQUE_THRESHOLD = 250;

/** Biased to yes: a wrong yes is hidden behind the image, a wrong no drops the feature. */
export function formatCanCarryAlpha(src: string): boolean {
  const extension = sourceExtension(src);
  return extension === "" || !OPAQUE_EXTENSIONS.includes(extension);
}

export function sampleSize(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function hasTransparentPixels(
  pixels: Uint8ClampedArray,
  threshold = ALPHA_OPAQUE_THRESHOLD,
): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < threshold) return true;
  }
  return false;
}
