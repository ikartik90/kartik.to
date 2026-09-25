// Shared with panda.config.ts conditions, so the CSS and JS checks can't drift.

/** Portrait below 820px, where globals.css starts insetting the page for the rail. */
export const BOTTOM_SHEET_QUERY =
  "(orientation: portrait) and (max-width: 819px)";

/** Landscape below that same 820px rail inset. */
export const NARROW_RAIL_QUERY =
  "(orientation: landscape) and (max-width: 819px)";

export function isBottomSheetLayout(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(BOTTOM_SHEET_QUERY).matches
  );
}

export const HAS_CURSOR_QUERY = "(hover: hover) and (pointer: fine)";

export function hasCursor(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(HAS_CURSOR_QUERY).matches
  );
}
