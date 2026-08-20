import { sourceExtension } from "@/utils/media-source";

// ---------------------------------------------------------------------------
// Deciding whether a picture has anything behind it to see.
//
// The pure half of the transparency check — a format test, the size to sample
// at, and the scan of the resulting pixels. The DOM half (decoding the image
// and getting those pixels out of a canvas) lives in `@/hooks/use-image-
// transparency`, which is also where the caching and the CORS fallback are.
// ---------------------------------------------------------------------------

/**
 * The extensions that CANNOT carry an alpha channel, so a source wearing one is
 * opaque by construction and needs no decoding to prove it. Among the picture
 * formats this app accepts (see `ALLOWED_IMAGE_CONTENT_TYPES`) that is JPEG
 * alone — PNG, WebP, GIF and SVG can all carry one.
 *
 * PICTURE formats, and only those. `"mp4"` was in this list, put there so a
 * clip would be ruled out before the scan tried to decode it with `new Image()`
 * — which cannot load a video, so the alternative was two failed network round
 * trips. But that made this the place picture-vs-clip got decided, from a
 * filename, on a render path, which is the exact guess the `kind` field on a
 * media node was added to retire; and it never worked for the case that
 * mattered, since a clip under a bare R2 key has no extension to be recognised
 * by. `CollectionGrid` now filters on the item's own `kind` before asking, so
 * nothing that is not a picture reaches here and there is nothing to rule out.
 *
 * Adding a video format back would not be a small extension of this list — it
 * would be reinstating the guess somewhere the caller already has the answer.
 */
const OPAQUE_EXTENSIONS = ["jpg", "jpeg", "jfif", "pjpeg", "pjp"];

/**
 * Alpha at or above this counts as opaque.
 *
 * NOT 255, because the scan runs on a DOWNSCALED copy and downscaling averages:
 * a thin transparent border on a large picture arrives as 251-ish rather than
 * as a zero, and a threshold of "anything under fully opaque" would then depend
 * on the browser's resampler rounding the same way twice. A genuinely opaque
 * picture stays at exactly 255 however far it is scaled — averaging a field of
 * 255s cannot produce anything else — so the margin costs no precision.
 */
export const ALPHA_OPAQUE_THRESHOLD = 250;

/**
 * Whether this src's format could carry transparency at all.
 *
 * A guess, deliberately biased towards yes: an unrecognised extension (or none,
 * which is what an R2 key without one looks like) is treated as possible. The
 * checkerboard is painted BEHIND the picture, so being wrong that way is
 * invisible — the image covers it — while being wrong the other way silently
 * drops the feature.
 */
export function formatCanCarryAlpha(src: string): boolean {
  const extension = sourceExtension(src);
  return extension === "" || !OPAQUE_EXTENSIONS.includes(extension);
}

/**
 * The box to decode a `width`×`height` picture into before scanning it, capped
 * at `max` on its long edge.
 *
 * Scanning at full size would mean a 48MB `ImageData` for a phone photo to
 * answer a yes/no question. Downscaling is not merely cheaper but strictly
 * safer for this question: averaging can only pull alpha DOWN towards the
 * transparent pixels in a neighbourhood, never hide them by pushing it up.
 * Never upscales — there is nothing to gain from resampling a small picture.
 */
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

/** Whether an RGBA buffer holds a pixel you could see through. */
export function hasTransparentPixels(
  pixels: Uint8ClampedArray,
  threshold = ALPHA_OPAQUE_THRESHOLD,
): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < threshold) return true;
  }
  return false;
}
