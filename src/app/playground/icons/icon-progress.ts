// ---------------------------------------------------------------------------
// One bar over a load that happens in two phases.
//
// The set arrives in two acts. First the LISTING — one action call, which is
// one request in name and two hundred-odd HeadObjects in fact, because S3 will
// not return user metadata from a list and every icon's review state lives
// there. Then the FILES, one request each, counted as they land.
//
// Only the second act can be counted: until the listing is back, nobody knows
// how many icons there are to count against. So the first act trickles. Read
// off two separate scales, that is a bar that climbs to a third, drops to
// nothing when the counting starts at zero of two hundred, and climbs again.
//
// The fix is not to remember the high-water mark and stall there — that trades
// a rollback for a freeze, and a bar that sits still for eighty files is no
// more honest. It is to give each act its own SLICE of the one scale. The
// trickle eases toward 0.9 and never arrives, so the listing can never spend
// more than 0.9 of its slice, and the counting starts at the whole of it. The
// handover is a step forwards by construction, with nothing to remember.
// ---------------------------------------------------------------------------

/**
 * How much of the bar the listing is allowed, in percent. Measured rather than
 * guessed: cold, the listing takes ~1.5s of a ~4s load. Deliberately a little
 * under its share, so the handover is a small step forward rather than a
 * stall — and on a warm visit, where the files come from cache and the listing
 * is nearly the whole wait, the rest simply goes by fast.
 */
export const LISTING_SHARE = 30;

export interface PreloaderInput {
  /** The listing is still in flight — there is no total to count against. */
  loading: boolean;
  /** `useTrickleProgress`, 0–1: the site's ease toward ~0.9 while waiting. */
  trickle: number;
  /** Files in hand over files expected, 0–1. Real, once there is a total. */
  progress: number;
}

/** The number to draw, 0–100, over the whole two-act load. */
export function preloaderPercent({
  loading,
  trickle,
  progress,
}: PreloaderInput): number {
  if (loading) return clamp(trickle) * LISTING_SHARE;
  return LISTING_SHARE + clamp(progress) * (100 - LISTING_SHARE);
}

/**
 * Both inputs are fractions and neither is guaranteed to be one. An upload
 * that lands mid-load adds to the denominator before its file arrives, which
 * would otherwise walk the bar backwards a hair — the same fault in miniature.
 */
function clamp(fraction: number): number {
  return Math.max(0, Math.min(1, fraction));
}
