// Where an inline overlay opens beside its call to action. Boxes share one coordinate space.

export type Box = { top: number; bottom: number; left: number; right: number };
export type Side = "below" | "above" | "left";

// SW Curie hangs its overlays 4px from what opened them; `reveal`'s 24px stays clear of the view's edge.
const GAP = 4;
const ROOM = 24;

const ORDER: Side[] = ["below", "above", "left"];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Below `cta`, ending level with it, when `view` has the room; else above it; else to its left. `keep` holds the
 * side it opened on while that still fits.
 */
export function placeOverlay(cta: Box, view: Box, size: { width: number; height: number }, keep?: Side) {
  const fits: Record<Side, boolean> = {
    below: cta.bottom + GAP + size.height + ROOM <= view.bottom,
    above: cta.top - GAP - size.height - ROOM >= view.top,
    left: true,
  };
  const side = keep && fits[keep] ? keep : ORDER.find((s) => fits[s])!;
  if (side === "left")
    return {
      side,
      top: clamp(cta.top, view.top + ROOM, view.bottom - ROOM - size.height),
      left: clamp(cta.left - GAP - size.width, view.left, view.right - size.width),
    };
  return {
    side,
    top: side === "below" ? cta.bottom + GAP : cta.top - GAP - size.height,
    left: clamp(cta.right - size.width, view.left, view.right - size.width),
  };
}

/** To `cta`'s right, level with its top, or to its left where `view` has no room on the right; kept inside `view`. */
export function placeBeside(cta: Box, view: Box, size: { width: number; height: number }) {
  const side = cta.right + GAP + size.width <= view.right ? "right" : "left";
  return {
    side,
    top: clamp(cta.top, view.top + ROOM, view.bottom - ROOM - size.height),
    left: clamp(side === "right" ? cta.right + GAP : cta.left - GAP - size.width, view.left, view.right - size.width),
  } as const;
}
