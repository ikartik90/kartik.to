import type { Box } from "@/utils/lightbox-gesture";

/** Must match the `zoom` dialog's backdrop and the lightbox chrome's fade. */
export const ZOOM_MS = 300;

const ZOOM_EASE = "cubic-bezier(0.2, 0, 0, 1)";

function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/** Places the frame on `rect`; its resting centre (`rest`'s) never moves as it resizes. */
export function boxKeyframe(rect: Box, rest: Box) {
  const dx = rect.left + rect.width / 2 - (rest.left + rest.width / 2);
  const dy = rect.top + rect.height / 2 - (rest.top + rest.height / 2);
  return {
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    translate: `${dx}px ${dy}px`,
  };
}

export function sameBox(a: Box, b: Box) {
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** Null where there is nothing to wait for: no Web Animations, or reduced motion. */
export function animate(
  element: HTMLElement,
  keyframes: Keyframe[],
  { fill, duration = ZOOM_MS }: { fill?: FillMode; duration?: number } = {},
): Animation | null {
  if (typeof element.animate !== "function" || prefersReducedMotion()) {
    return null;
  }
  return element.animate(keyframes, { duration, easing: ZOOM_EASE, fill });
}

export function settle(element: HTMLElement) {
  element.getAnimations?.().forEach((animation) => animation.cancel());
}

/** Hands the frame back to its stylesheet size and place. */
export function clearBox(element: HTMLElement) {
  element.style.width = "";
  element.style.height = "";
  element.style.translate = "";
  element.style.opacity = "";
}
