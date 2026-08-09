"use client";

import { useEffect, useState, type RefObject } from "react";

// ---------------------------------------------------------------------------
// "Is this element properly on screen?" — a live gate with HYSTERESIS, which is
// the whole design. It takes a lot of the element to turn on (70%) and very
// little to stay on (30%), so the two lines are far enough apart that no scroll
// position sits on both: park the frame near the edge, jitter a trackpad, and
// the answer holds instead of chattering.
//
// The thing it gates is a demo that performs itself, and performing has two
// halves — it should not play to an empty room, and it should be waiting to go
// again when someone comes back. Hence a gate rather than the latch this began
// as: `false` is the cue to pause and put the demo away, `true` is the cue to
// run it from the top.
//
// The amount is a fraction of the ELEMENT, which stops meaning what you want
// the moment the element is taller than the window — 70% of a 1600px block
// simply cannot be shown in an 800px viewport, and a flat threshold would wait
// forever. `inViewThreshold` caps the ask at what the viewport can actually
// hold, so a tall element triggers on filling the screen instead of never.
// ---------------------------------------------------------------------------

/**
 * The ratio steps the observer reports at. Nothing here decides anything finer
 * than 5%, and each step costs one callback while the element crosses the fold.
 */
const THRESHOLD_STEPS = Array.from({ length: 21 }, (_, index) => index / 20);

/**
 * Slack on the "as much as can ever be shown" ceiling. Landing exactly on it
 * would mean waiting for the element to fill the viewport to the pixel — one
 * scroll position, easily stepped over by a fast wheel.
 */
const CEILING_SLACK = 0.9;

/**
 * How much of the element to wait for, given the element and the viewport it
 * has to fit in. Normally just `amount`; for an element taller than the
 * viewport it is the largest fraction that can ever be on screen, minus slack.
 */
export function inViewThreshold(
  amount: number,
  elementHeight: number,
  rootHeight: number,
): number {
  if (elementHeight <= 0 || rootHeight <= 0) return amount;
  return Math.min(amount, (rootHeight / elementHeight) * CEILING_SLACK);
}

export interface InViewOptions {
  /** How much of the element turns the gate ON. */
  enter?: number;
  /** How little of it left on screen turns the gate back OFF. */
  exit?: number;
}

/**
 * True while at least `enter` (70%) of the ref'd element is on screen, false
 * once under `exit` (30%) of it is, and unchanged anywhere between the two.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  { enter = 0.7, exit = 0.3 }: InViewOptions = {},
): boolean {
  const [inside, setInside] = useState(false);

  useEffect(() => {
    const element = ref.current;
    // Without an observer there is no cheap way to answer this, and what it
    // gates is decoration — so the answer is simply "no", forever.
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const enterAt = inViewThreshold(
            enter,
            entry.boundingClientRect.height,
            entry.rootBounds?.height ?? 0,
          );
          // The exit line keeps its PROPORTION to whatever the entry line
          // turned out to be. A tall element whose ask was capped to 22% would
          // otherwise be given a floor of 30% — a gate that can never open.
          const leaveAt = enterAt * (exit / enter);
          // The reported ratio is a measured fraction, so "exactly the target"
          // routinely arrives a hair under it in floating point.
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
