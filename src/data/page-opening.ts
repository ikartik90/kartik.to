import { HOME_HERO } from "./home-hero";

// The homepage's opening stagger: the hero's lines, then its steps, then what's on screen below it. The parts the
// page renders run it in CSS (`pageOpening`); what mounts later joins it in step (`joinOpening`).

export const PAGE_OPENING = {
  lineMs: 1000,
  lineGapMs: 100,
  lineEase: "ease",
  lineBlur: "0.16em",
  stepMs: 750,
  stepGapMs: 150,
  stepEase: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** The hero's pills, then each line of its heading. */
export const HERO_OPENING_LINES = HOME_HERO.heading.length + 1;
/** Its lede and its buttons. */
export const HERO_OPENING_STEPS = 2;

/** When the opening's `i`th line starts, in ms. */
export const openingLineDelay = (i: number) => i * PAGE_OPENING.lineGapMs;

/** When its `i`th step starts, after `lines` lines, in ms. */
export const openingStepDelay = (lines: number, i: number) =>
  openingLineDelay(lines - 1) + (i + 1) * PAGE_OPENING.stepGapMs;
