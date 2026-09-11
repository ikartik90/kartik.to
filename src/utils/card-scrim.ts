// ---------------------------------------------------------------------------
// The wash a card's caption stands on — the curve, stated once.
//
// It lived in `panda.config.ts` alone, which was right while a card was only
// ever drawn by a browser. It is not any more: an Open Graph image is the same
// card composed by Satori into a PNG, and Satori reads neither `color-mix()`
// nor a Panda token, so that gradient cannot be handed to it. Restating the
// ramp there would be the same curve written twice, and a curve written twice
// is a curve that stops matching the moment either is tuned — which for THIS
// one would mean a link preview shading its words differently from the card
// it is a picture of.
//
// So the shape of the ramp is here, in numbers, and the two surfaces only
// supply the paint: the recipe mixes a token, the image writes an `rgba()`.
// The reasoning behind the numbers — why a quarter, why smootherstep, why nine
// stops — is in `panda.config.ts` over `CARD_WASH`, beside the design it
// argues with.
// ---------------------------------------------------------------------------

/** The scrim is at least this much of the card, and usually exactly. */
export const CARD_SCRIM_MIN_SHARE = 0.25;

/** How opaque the wash ever gets — at the very foot, under the last line. */
export const CARD_WASH_PEAK = 0.95;

/**
 * How many stops describe the ramp. A browser interpolates LINEARLY between
 * stops, so the curve is only ever as smooth as the polyline describing it;
 * nine is where its corners stop being findable.
 */
export const CARD_WASH_STOPS = 9;

/**
 * Smootherstep — `6t⁵ − 15t⁴ + 10t³`, the curve whose SLOPE is zero at both
 * ends as well as its value, so the wash neither starts nor arrives anywhere
 * the eye can find an edge.
 */
export function smootherstep(t: number): number {
  return t ** 3 * (t * (t * 6 - 15) + 10);
}

/** The ramp, as offsets down the scrim and the alpha at each. */
export function cardWashStops(): { offset: number; alpha: number }[] {
  return Array.from({ length: CARD_WASH_STOPS }, (_, step) => {
    const offset = step / (CARD_WASH_STOPS - 1);
    return { offset, alpha: CARD_WASH_PEAK * smootherstep(offset) };
  });
}

/**
 * The ramp as a CSS gradient, in whatever colour the caller can express.
 *
 * `paint` takes an alpha on 0..1 and returns a colour — a `color-mix()` of a
 * token where a browser will read it, a literal `rgba()` where Satori will.
 */
export function cardWashGradient(paint: (alpha: number) => string): string {
  const stops = cardWashStops()
    .map(({ offset, alpha }) => `${paint(alpha)} ${(offset * 100).toFixed(1)}%`)
    .join(", ");
  return `linear-gradient(to bottom, ${stops})`;
}
