// ---------------------------------------------------------------------------
// A cover, small enough to pick out of a row.
//
// The presets strip shows saved covers at 80px, and it CANNOT show them as
// themselves: every paper-shaders mount holds its own webgl2 context, the
// library pools nothing and recovers from no loss, so a strip that rendered the
// real thing would spend one context per preset and go permanently blank at
// whatever number the browser stops handing them out (~16, shared with the
// playground's own). The page comment in `cover-playground.tsx` makes the same
// call one level up: compare by switching, not by tiling.
//
// So the tile is painted from the one thing that survives being shrunk to 80px
// anyway — the ramp. At that size a fanned light-blade and a swirl are the same
// smudge; what tells two saved covers apart across the room is their colours,
// in the order they were authored.
// ---------------------------------------------------------------------------

/**
 * What a tile needs off a cover: its ramp, and the ground behind it.
 *
 * FLAT colours, not the pairs a cover stores — a tile is painted on one ground
 * at a time, so the caller resolves the pair (`paletteFor`) and hands over what
 * it wants drawn. Keeping the choice out here is what lets the strip paint in
 * the page's theme while the preview card stands in the other one.
 */
export interface CoverSwatchSource {
  colors: string[];
  colorBack?: string;
}

/**
 * The tile's `background` — a CSS shorthand value, ready to hand to an element.
 *
 * The ground is emitted as the FINAL layer because that is the only layer of
 * the shorthand CSS lets a colour sit in, and it is where it belongs anyway:
 * behind the ramp, showing through wherever the ramp is translucent.
 */
export function coverSwatch({ colors, colorBack }: CoverSwatchSource): string {
  // Nothing to ramp. A mesh gradient has no ground, and a cover mid-edit could
  // in principle arrive with an empty list; neither is a reason to emit
  // `linear-gradient()` with no stops, which paints nothing and invalidates the
  // whole declaration.
  if (colors.length === 0) return colorBack ?? "transparent";

  // A one-stop gradient is invalid CSS, so a single colour is stated twice.
  // Cheaper than a second shape for the tile to be in, and identical to look at.
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  const ramp = `linear-gradient(135deg, ${stops.join(", ")})`;

  return colorBack ? `${ramp}, ${colorBack}` : ramp;
}
