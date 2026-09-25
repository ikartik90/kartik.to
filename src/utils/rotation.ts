// Shared by every surface that turns a shader, so a preset reads the same angle everywhere.

/** Signed, so zero sits mid-track and both directions are equally reachable. */
export const ROTATION_MIN = -180;
export const ROTATION_MAX = 180;

/** An input convenience only: no schema enforces it, so finer saved values keep their angle. */
export const ROTATION_STEP = 15;

/**
 * Wraps (never clamps) old 0..360 values, which the schemas would reject; in-range
 * values, 180 included, are returned as-is. Non-finite values pass through.
 */
export function wrapRotation(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value >= ROTATION_MIN && value <= ROTATION_MAX) return value;
  return (((value - ROTATION_MIN) % 360) + 360) % 360 + ROTATION_MIN;
}
