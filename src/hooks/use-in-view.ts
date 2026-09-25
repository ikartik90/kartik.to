"use client";

import { useEffect, useState, type RefObject } from "react";

// A visibility gate with hysteresis (on at `enter`, off under `exit`), so scroll jitter can't flicker it.

const THRESHOLD_STEPS = Array.from({ length: 21 }, (_, index) => index / 20);

/** Below 1 so a fast wheel can't step over the exact fill-the-viewport position. */
const CEILING_SLACK = 0.9;

/** `amount`, capped for an element taller than the viewport at the most that can ever show. */
export function inViewThreshold(
  amount: number,
  elementHeight: number,
  rootHeight: number,
): number {
  if (elementHeight <= 0 || rootHeight <= 0) return amount;
  return Math.min(amount, (rootHeight / elementHeight) * CEILING_SLACK);
}

export interface InViewOptions {
  enter?: number;
  exit?: number;
}

export function useInView(
  ref: RefObject<HTMLElement | null>,
  { enter = 0.7, exit = 0.3 }: InViewOptions = {},
): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const enterAt = inViewThreshold(
            enter,
            entry.boundingClientRect.height,
            entry.rootBounds?.height ?? 0,
          );
          // Scaled with the entry line, or a capped entry could fall below the exit and never open.
          const leaveAt = enterAt * (exit / enter);
          // Allows for float error just under the target.
          if (entry.intersectionRatio + 1e-6 >= enterAt) setInside(true);
          else if (entry.intersectionRatio < leaveAt) setInside(false);
        }
      },
      { threshold: THRESHOLD_STEPS },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enter, exit]);

  return inside;
}
