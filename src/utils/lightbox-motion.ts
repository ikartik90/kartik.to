import type { Box } from "@/utils/lightbox-gesture";

/** Must match the `zoom` dialog's backdrop and the lightbox chrome's fade. */
export const ZOOM_MS = 300;

const ZOOM_EASE = "cubic-bezier(0.2, 0, 0, 1)";

function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * Lays the frame, laid out at `rest`, corner for corner on `rect`, wearing a corner of `radius`
 * there. Transforms only, so nothing inside reflows as it moves.
 */
export function boxKeyframe(rect: Box, rest: Box, radius: number) {
  const dx = rect.left + rect.width / 2 - (rest.left + rest.width / 2);
  const dy = rect.top + rect.height / 2 - (rest.top + rest.height / 2);
  const sx = rect.width / rest.width;
  const sy = rect.height / rest.height;
  return {
    translate: `${dx}px ${dy}px`,
    scale: `${sx} ${sy}`,
    borderRadius: `${radius / sx}px / ${radius / sy}px`,
  };
}

export function cornerRadius(element: HTMLElement) {
  return parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
}

export function sameBox(a: Box, b: Box) {
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * Null where there is nothing to wait for: no Web Animations, or reduced motion. `afterPaint`
 * holds the first keyframe until the frame it starts on has painted: Safari paints a change
 * slowly, and would otherwise skip the motion's first, fastest frames.
 */
export function animate(
  element: HTMLElement,
  keyframes: Keyframe[],
  {
    fill,
    duration = ZOOM_MS,
    afterPaint = false,
  }: { fill?: FillMode; duration?: number; afterPaint?: boolean } = {},
): Animation | null {
  if (typeof element.animate !== "function" || prefersReducedMotion()) {
    return null;
  }
  const animation = element.animate(keyframes, {
    duration,
    easing: ZOOM_EASE,
    fill,
  });
  if (afterPaint) {
    animation.pause();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (animation.playState === "paused") animation.play();
      }),
    );
  }
  return animation;
}

type AnimateOptions = Parameters<typeof animate>[2];

/**
 * Moves a box through `boxKeyframe`s, its corner as an animation of its own: WebKit runs an
 * animation on the compositor only when every property in it can go there, and a corner can't.
 */
export function animateBox(
  element: HTMLElement,
  keyframes: ReturnType<typeof boxKeyframe>[],
  options?: AnimateOptions,
): Animation | null {
  const motion = animate(
    element,
    keyframes.map(({ translate, scale }) => ({ translate, scale })),
    options,
  );
  animate(
    element,
    keyframes.map(({ borderRadius }) => ({ borderRadius })),
    options,
  );
  return motion;
}

/** Where the element's `translate` stands along x, part way through an animation included. */
export function translationX(element: HTMLElement) {
  return parseFloat(getComputedStyle(element).translate) || 0;
}

export function settle(element: HTMLElement) {
  element.getAnimations?.().forEach((animation) => animation.cancel());
}

/** Hands the frame back to its stylesheet place, scale and corner. */
export function clearBox(element: HTMLElement) {
  element.style.translate = "";
  element.style.scale = "";
  element.style.borderRadius = "";
  element.style.opacity = "";
}
