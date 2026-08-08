"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCursorTooltip } from "./use-cursor-tooltip";

// ---------------------------------------------------------------------------
// A cursor-following tooltip that TEACHES rather than labels. Where a hover
// tooltip names the thing under the pointer for as long as you point at it,
// a hint volunteers a gesture you might not know is there — so it has to be
// self-limiting on both ends: it withdraws on its own after `duration`, and
// `retire()` puts it away for good the moment the gesture is performed. Nobody
// needs to be told how to do the thing they just did.
//
// Positioning is `useCursorTooltip`'s (fixed box + ref + rAF); this hook adds
// only the two clocks. `show(x, y)` seeds it at the pointer, exactly like the
// hover tooltips do, so it opens in place rather than at a stale spot.
// ---------------------------------------------------------------------------

/** How long a hint stays up before withdrawing itself, in ms. */
export const HINT_TOOLTIP_MS = 3000;

export function useHintTooltip(duration: number = HINT_TOOLTIP_MS) {
  const [visible, setVisible] = useState(false);
  // Latched by `retire`. A ref, not state: `show` reads it, nothing renders it.
  const spent = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const { ref, seed } = useCursorTooltip(visible);

  // Every path out of "visible" drops the timer with it, so a stale tick can
  // never reopen a hint that has already been dismissed.
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  }, []);

  // `duration` is read through a ref so `show` keeps one identity for the life
  // of the component — a consumer wiring it to a handler shouldn't rebind on
  // every render because a number literal was passed inline.
  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const show = useCallback(
    (x: number, y: number) => {
      if (spent.current) return;
      if (timer.current) clearTimeout(timer.current);
      seed(x, y);
      setVisible(true);
      // Restarted on every show, so each fresh hover gets the whole window
      // rather than the tail of the last one.
      timer.current = setTimeout(hide, durationRef.current);
    },
    [seed, hide],
  );

  /** The gesture happened — put the hint away permanently. */
  const retire = useCallback(() => {
    spent.current = true;
    hide();
  }, [hide]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { ref, visible, show, hide, retire };
}
