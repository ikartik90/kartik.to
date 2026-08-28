"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Where the colour picker opens, and why it is a NUMBER rather than an anchor.
//
// The picker used to take its vertical position from CSS anchor positioning —
// `top: anchor(top)` against the swatch that opened it. That is not a one-time
// placement: an anchor is TRACKED, so scrolling the properties rail dragged the
// picker along with the row it belonged to. Beside its own row is a relationship
// worth having when the two are far apart, but the picker is a 360px panel
// docked two pixels off the rail — it reads as part of that strip, and a strip
// whose lower half slides while its upper half holds still reads as broken.
//
// So the swatch's position is READ ONCE, at the moment of opening, and the
// picker is pinned there for as long as it is up. Scroll the rail underneath and
// the picker stays exactly where it was put. That is the whole of the change: the
// horizontal dock never tracked anything (it is `inset-inline-end` measured off
// the rail's own width) and is untouched.
//
// The CLAMP is the thing anchor positioning was also buying, via a
// `@position-try` fallback, and it has to be replaced rather than dropped: a
// swatch near the foot of the screen would otherwise open a picker that runs off
// the bottom. It is done in a LAYOUT effect, which is what makes the correction
// invisible — the browser has laid the panel out (so its height is known) but
// has not painted, so the clamped position is the first one on screen.
// ---------------------------------------------------------------------------

/** How close to the viewport's foot the picker may come. `spacing.lg`. */
const VIEWPORT_INSET = 12;

export interface PickerPin {
  /**
   * The pinned `top`, in viewport pixels — `undefined` until something has been
   * pinned, which is also the closed state.
   */
  top: number | undefined;
  /** Read the trigger's position and hold it. Call this as the picker opens. */
  pin: (trigger: HTMLElement | null) => void;
  /** Forget it, so the next open reads a fresh position. */
  unpin: () => void;
  /**
   * Put on the picker's own element. Measures it once it is laid out and lifts
   * it if it would otherwise run past the foot of the screen.
   */
  ref: (node: HTMLElement | null) => void;
}

export function usePickerPin(): PickerPin {
  const [top, setTop] = useState<number | undefined>(undefined);
  // What was READ, as distinct from what is currently applied: the clamp has to
  // be able to run again (on a resize, or on a second open at the same spot)
  // without treating its own correction as the new anchor position.
  const wanted = useRef<number | undefined>(undefined);
  const node = useRef<HTMLElement | null>(null);

  const clamp = useCallback(() => {
    const el = node.current;
    const from = wanted.current;
    if (!el || from === undefined) return;
    const room = window.innerHeight - el.offsetHeight - VIEWPORT_INSET;
    // `Math.max(VIEWPORT_INSET, …)` so a picker TALLER than the viewport is
    // pinned to the top rather than pushed off it — the panel scrolls the page
    // in that case, which is the lesser of the two failures.
    setTop(Math.max(VIEWPORT_INSET, Math.min(from, room)));
  }, []);

  const ref = useCallback(
    (next: HTMLElement | null) => {
      node.current = next;
      if (next) clamp();
    },
    [clamp],
  );

  // A resize can invalidate the clamp under an open picker — rotating a tablet
  // is the ordinary way to get one. Re-run against the position that was READ,
  // never against the applied one, or each resize would walk the panel upward.
  useLayoutEffect(() => {
    if (top === undefined) return;
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [top, clamp]);

  return {
    top,
    pin: useCallback((trigger: HTMLElement | null) => {
      const from = trigger?.getBoundingClientRect().top;
      wanted.current = from;
      setTop(from);
    }, []),
    unpin: useCallback(() => {
      wanted.current = undefined;
      setTop(undefined);
    }, []),
    ref,
  };
}
