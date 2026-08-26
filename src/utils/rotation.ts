// ---------------------------------------------------------------------------
// The app's ONE rotation control — its range, its step, and how a stored angle
// is brought into them.
//
// A module of its own because there are three surfaces that turn a shader and
// they must not disagree: the cover playground's Framing group, the background
// effect on a media node, and the media properties panel that edits it. A cover
// tuned in the playground is meant to be reused as a background elsewhere, so a
// rotation that read -90 in one place and 270 in another would be the same
// picture described two ways — and the panel offering a different set of stops
// from the playground would make a cover unreachable in the surface it was
// built for.
//
// This is the same call `demo-frame-sizing.ts` makes for aspect ratios, and for
// the reason recorded there: these numbers were hand-kept copies, and a
// hand-kept copy is a place for a correction to not arrive.
// ---------------------------------------------------------------------------

/**
 * Signed about a zero in the middle of the track, rather than 0..360.
 *
 * The control names a turn away from square-on, and which WAY you turned is
 * part of what you are choosing. Under 0..360 one of the two directions was
 * only reachable by running the slider almost to the far end, and the neutral
 * setting sat on the boundary where the two ends meet — the one value you
 * cannot approach from both sides.
 */
export const ROTATION_MIN = -180;
export const ROTATION_MAX = 180;

/**
 * The thumb lands on the turns anybody actually reaches for — the sixths of a
 * right angle — rather than on whichever degree the pointer happened to be
 * over. `-180 + 15k` puts zero and every ±15, ±45, ±90 exactly on the grid, so
 * square-on is a stop the thumb snaps to instead of one you creep up on.
 *
 * An INPUT convenience only. No schema enforces it, so a value saved under a
 * finer step keeps the angle it was tuned to rather than being rounded to tidy
 * it up.
 */
export const ROTATION_STEP = 15;

/**
 * A stored angle, brought into the signed range.
 *
 * WRAPPED rather than clamped, because an angle is modular: 270 and -90 are the
 * same picture, so only the way it is written down changes. Clamping to 180
 * would quietly re-tune every value saved under the old 0..360 range — and
 * those schemas ENFORCE their ranges rather than clamping (a slider reading a
 * number the picture does not have is worse than a rejected save), so without
 * this a background tuned to 270° would simply stop parsing.
 *
 * A value already inside the range is returned EXACTLY as it is, which is why
 * this is a guarded early return rather than an unconditional wrap: the general
 * formula maps 180 to -180, and although those name one angle, a slider would
 * jump from one end of its track to the other for no reason the author can see.
 *
 * Anything that is not a finite number is handed back untouched, for the
 * schemas to reject on their own terms — this is a normaliser, not a validator.
 */
export function wrapRotation(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value >= ROTATION_MIN && value <= ROTATION_MAX) return value;
  return (((value - ROTATION_MIN) % 360) + 360) % 360 + ROTATION_MIN;
}
