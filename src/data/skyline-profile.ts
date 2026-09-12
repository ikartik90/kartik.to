// ---------------------------------------------------------------------------
// The Toronto skyline's silhouette, as a number per slice of the drawing.
//
// GENERATED from `src/assets/illustrations/toronto-skyline.svg` — the roofline
// of every path in it, reduced to the highest point in each of
// `SKYLINE_PROFILE_BINS` equal vertical slices of the 4000×600 viewBox. Regenerate
// it with `scripts/skyline-profile.mjs` if the drawing ever changes.
//
// WHY IT EXISTS. The homepage's testimonial band stands in front of this
// picture, and the one thing it must not do is crowd it: every column of cards
// stops a fixed distance above whatever is directly beneath it — the CN Tower
// under the middle of the screen, the financial district right of it, low
// warehouses at the edges. That is a question about the ARTWORK, and CSS has no
// way to ask it. So the artwork is asked once, here, and the answer is a small
// array the band can look up at whatever width it is being drawn.
//
// Smaller y is HIGHER, as in the viewBox: 18 is the tip of the tower's antenna
// and ~520 is the roof of the lowest shed on the waterfront.
// ---------------------------------------------------------------------------

/** The viewBox the numbers below are in — the drawing's own coordinates. */
export const SKYLINE_VIEWBOX_WIDTH = 4000;
export const SKYLINE_VIEWBOX_HEIGHT = 600;

/** How many slices the width is cut into. 400 gives a 10-unit slice, which is
 *  finer than the tower is wide (58) — coarser bins would smear the antenna
 *  sideways and push the columns either side of it further up than they need. */
export const SKYLINE_PROFILE_BINS = 400;

/** The highest point of the drawing in each slice, left to right. */
export const SKYLINE_PROFILE: readonly number[] = [
  492, 492, 492, 492, 492, 492, 484, 484, 484, 517, 512, 500, 500, 500, 484,
  484, 484, 490, 504, 504, 504, 504, 481, 481, 481, 481, 481, 521, 488, 488,
  488, 488, 519, 512, 489, 489, 489, 520, 491, 491, 491, 491, 486, 486, 486,
  494, 490, 490, 490, 502, 513, 513, 505, 498, 498, 498, 505, 506, 488, 488,
  488, 503, 503, 503, 518, 490, 490, 485, 485, 485, 504, 504, 504, 502, 502,
  502, 502, 512, 512, 504, 504, 504, 504, 519, 504, 504, 504, 504, 504, 520,
  505, 497, 497, 505, 505, 503, 503, 503, 468, 468, 468, 493, 482, 482, 464,
  464, 464, 464, 470, 470, 470, 470, 470, 485, 476, 476, 476, 485, 458, 458,
  458, 458, 471, 466, 466, 466, 466, 466, 482, 475, 482, 494, 483, 483, 471,
  471, 471, 471, 486, 477, 477, 486, 414, 414, 412, 412, 412, 418, 418, 422,
  422, 421, 421, 408, 408, 408, 415, 415, 409, 409, 409, 425, 431, 398, 398,
  398, 443, 443, 443, 443, 443, 453, 453, 453, 471, 471, 488, 488, 488, 488,
  447, 442, 442, 442, 442, 447, 488, 488, 488, 463, 463, 463, 463, 488, 488,
  465, 200, 182, 182, 25, 18, 182, 182, 458, 458, 449, 449, 449, 419, 414,
  414, 414, 419, 437, 416, 411, 411, 411, 411, 458, 403, 337, 332, 315, 332,
  332, 403, 365, 365, 365, 365, 362, 350, 350, 350, 360, 343, 360, 395, 395,
  395, 395, 395, 350, 350, 339, 350, 371, 463, 463, 463, 481, 481, 481, 492,
  477, 477, 492, 436, 436, 436, 436, 423, 423, 423, 423, 423, 441, 432, 432,
  441, 423, 423, 423, 431, 431, 431, 431, 433, 433, 399, 399, 399, 420, 420,
  420, 419, 419, 419, 421, 415, 415, 415, 447, 447, 468, 468, 468, 468, 477,
  464, 477, 477, 443, 443, 443, 443, 429, 429, 429, 429, 441, 441, 441, 516,
  460, 452, 452, 460, 470, 470, 470, 476, 476, 468, 476, 464, 464, 455, 464,
  464, 502, 502, 502, 502, 502, 521, 492, 492, 492, 492, 517, 505, 505, 499,
  499, 499, 499, 499, 521, 498, 498, 498, 519, 510, 497, 497, 497, 519, 519,
  484, 484, 484, 502, 495, 495, 502, 515, 515, 502, 502, 502, 514, 505, 505,
  505, 505, 496, 496, 496, 497, 497, 497, 518, 495, 484, 484, 495, 490, 490,
  490, 516, 494, 494, 494, 494, 518, 497, 497, 497,
];

/**
 * The highest point of the drawing between two x positions, in viewBox units.
 *
 * Takes a RANGE rather than a point because the caller is a column of cards
 * several hundred pixels wide, and what it needs to clear is the tallest thing
 * anywhere under it — a column whose left edge happens to fall in a gap between
 * two towers is not clear of either.
 *
 * Clamped rather than wrapped: the drawing is sliced by the viewport
 * (`xMidYMax slice`), so a caller can legitimately ask about a column that
 * hangs past the edge of the artwork, and the nearest real slice is the honest
 * answer for it.
 */
export function skylineTopAt(fromX: number, toX: number): number {
  const perBin = SKYLINE_VIEWBOX_WIDTH / SKYLINE_PROFILE_BINS;
  const lo = Math.max(0, Math.min(SKYLINE_PROFILE_BINS - 1, Math.floor(Math.min(fromX, toX) / perBin)));
  const hi = Math.max(0, Math.min(SKYLINE_PROFILE_BINS - 1, Math.floor(Math.max(fromX, toX) / perBin)));

  let top = SKYLINE_VIEWBOX_HEIGHT;
  for (let bin = lo; bin <= hi; bin++) {
    if (SKYLINE_PROFILE[bin] < top) top = SKYLINE_PROFILE[bin];
  }
  return top;
}
