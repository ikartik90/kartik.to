import { openingStepDelay, PAGE_OPENING } from "@/data/page-opening";
import { ZOOM_MS } from "@/utils/lightbox-motion";

// How things that arrive in turn come in: each rises from below as it fades in, a step apart.

export const RISE_CURVE = [0, 0, 0.2, 1] as const;
export const RISE_MS = ZOOM_MS;
export const STEP_MS = 70;

// A sheet's panel fades in as it slides up, and fades as it drops when it closes.
export const OPEN_MS = 800;
export const OPEN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const CLOSE_MS = ZOOM_MS;
export const CLOSE_EASE = "ease";

export const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** How far below its place a thing starts, in px. */
export const riseOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--spacing-3xl"));

/** How far a sheet's panel slides as it opens or closes, and its content as it goes to another card's, in px. */
export const slideOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--spacing-5xl"));

/**
 * Holds `animations` at their start until the first frame is drawn. Building a sheet's content can take frames, and
 * WebKit otherwise starts their clock at the click, so the sheet first shows already most of the way in. `onStart` runs
 * as they start.
 */
export function fromFirstFrame(animations: Animation[], onStart?: () => void) {
  animations.forEach((a) => a.pause());
  requestAnimationFrame(() => {
    const now = document.timeline.currentTime;
    animations.forEach((a) => a.playState === "paused" && (a.startTime = now));
    onStart?.();
  });
  return animations;
}

/** `elements` rise in, in order. They hold their start through their wait, so none shows early. */
export function riseIn(elements: HTMLElement[]) {
  if (reducedMotion() || !elements.length) return;
  const rise = riseOf(elements[0]);
  elements.forEach((el, i) =>
    el.animate(
      [
        { opacity: 0, translate: `0px ${rise}px` },
        { opacity: 1, translate: "0px 0px" },
      ],
      {
        duration: RISE_MS,
        delay: i * STEP_MS,
        easing: `cubic-bezier(${RISE_CURVE.join(", ")})`,
        fill: "backwards",
      },
    ),
  );
}

/** As the page's opening draws its steps (`openingStep` in the theme's keyframes), rising from below or from the right. */
export function stepIn(step: HTMLElement, delay: number, from: "below" | "right" = "below") {
  const blur = parseFloat(getComputedStyle(step).getPropertyValue("--spacing-md"));
  const rise = riseOf(step);
  return step.animate(
    [
      { opacity: 0, translate: from === "below" ? `0px ${rise}px` : `${rise}px 0px`, filter: `blur(${blur}px)` },
      { opacity: 1, translate: "0px 0px", filter: "blur(0px)" },
    ],
    { duration: PAGE_OPENING.stepMs, delay, easing: PAGE_OPENING.stepEase, fill: "backwards" },
  );
}

/** Lines coming into focus a line's step apart, as the hero's do, then `steps` a line's step apart after them. */
export function focusIn(lines: HTMLElement[][], steps: HTMLElement[]) {
  if (reducedMotion()) return [];
  const { lineMs, lineGapMs, lineEase, lineBlur } = PAGE_OPENING;
  const focused = lines.flatMap((line, i) =>
    line.map((el) =>
      el.animate(
        [
          { opacity: 0, translate: "0px 20%", filter: `blur(${lineBlur})` },
          { opacity: 1, translate: "0px 0px", filter: "blur(0px)" },
        ],
        { duration: lineMs, delay: i * lineGapMs, easing: lineEase, fill: "backwards" },
      ),
    ),
  );
  const lastLine = (lines.length - 1) * lineGapMs;
  return [...focused, ...steps.map((step, i) => stepIn(step, lastLine + (i + 1) * lineGapMs))];
}

// How many have joined each run of the opening, past the steps the page drew.
const joined = new WeakMap<Animation, number>();

/**
 * `elements` take the page opening's next steps, in order, timed off its first line's animation (each joiner's own
 * first frame comes later, so a delay counted from it would land early). False, and nothing runs, once it's over.
 */
export function joinOpening(elements: HTMLElement[]) {
  if (reducedMotion()) return false;
  const lines = document.querySelectorAll<HTMLElement>("[data-opening-line]");
  const lead = lines[0]?.getAnimations?.()?.find((animation) => animation.playState !== "finished");
  if (!lead) return false;
  const before = joined.get(lead) ?? 0;
  const next = openingStepDelay(lines.length, document.querySelectorAll("[data-opening-step]").length + before);
  const now = document.timeline.currentTime;
  if (lead.startTime !== null && typeof now === "number" && now - Number(lead.startTime) > next) return false;
  joined.set(lead, before + elements.length);
  const animations = elements.map((el, i) => stepIn(el, next + i * PAGE_OPENING.stepGapMs));
  lead.ready.then(() => animations.forEach((animation) => (animation.startTime = lead.startTime)));
  return true;
}
