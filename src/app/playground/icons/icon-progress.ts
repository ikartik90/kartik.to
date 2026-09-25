/** Percent of the bar the listing phase may use. */
export const LISTING_SHARE = 30;

export interface PreloaderInput {
  /** The listing is still in flight. */
  loading: boolean;
  /** `useTrickleProgress`, 0–1. */
  trickle: number;
  /** Files in hand over files expected, 0–1. */
  progress: number;
}

/** 0–100 across both phases. */
export function preloaderPercent({
  loading,
  trickle,
  progress,
}: PreloaderInput): number {
  if (loading) return clamp(trickle) * LISTING_SHARE;
  return LISTING_SHARE + clamp(progress) * (100 - LISTING_SHARE);
}

function clamp(fraction: number): number {
  return Math.max(0, Math.min(1, fraction));
}
