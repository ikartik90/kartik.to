"use client";

import { useState } from "react";
import { useDelayedOn } from "./use-delayed-on";

/**
 * Without a cursor, whether a card plays as if hovered: from `delay` after it is `shown` whole on screen until it is
 * out of sight (`inSight` false). `resets` counts the times it has gone out of sight playing.
 */
export function useShownHover(shown: boolean, inSight: boolean, delay: number) {
  const played = useDelayedOn(shown, delay);
  const [on, setOn] = useState(false);
  const [resets, setResets] = useState(0);
  // Adjusted while rendering. Only in sight does it turn on, or a `shown` a report behind would flip it forever.
  if (played && inSight && !on) setOn(true);
  if (!inSight && on) {
    setOn(false);
    setResets((count) => count + 1);
  }
  return { on, resets };
}
