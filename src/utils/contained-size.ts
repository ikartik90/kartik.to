import type { MediaShape } from "@/domain/nodes";

/**
 * What a `contain`-fitted picture actually measures inside a box.
 *
 * CSS does this arithmetic itself and nothing in the app has ever needed to —
 * `object-fit: contain` letterboxes the element and the browser works the rest
 * out. It is needed here because Satori composes the Open Graph card, and there
 * the picture's own corner has to be drawn on a box: a radius on a letterboxed
 * element rounds the LETTERBOX, which is a rounded rectangle of ground with a
 * squared-off picture inside it. Sizing the element to the picture is what puts
 * the corner back on the picture, exactly as `mediaObjectStyle` does it in the
 * browser.
 *
 * `null` where the media never recorded its shape, which is every document
 * written before those fields existed. Then there is nothing to compute from,
 * and the caller falls back to filling the box and letting `object-fit` letterbox
 * it — the corner is on the box for those, which is the old behaviour and not
 * a regression.
 */
export function containedSize(
  shape: MediaShape,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } | null {
  const { width, height } = shape;
  if (!width || !height) return null;
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
}
