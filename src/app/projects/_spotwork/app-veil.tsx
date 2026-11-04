"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { css, cx } from "../../../../styled-system/css";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";

// Linear's hero: the picture comes up slowly out of its frame and settles slowly.
const REVEAL: KeyframeAnimationOptions = { duration: 1500, easing: "cubic-bezier(0.455, 0.03, 0.515, 0.955)" };

const veilStyle = css({ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" });

/**
 * The app's ground over its window until it's `shown`, then faded off; the theme's class (`className`) gives its colour.
 * Shown from the start, it's never drawn.
 */
export function AppVeil({ shown, className, style }: { shown: boolean; className?: string; style?: CSSProperties }) {
  const [lifted, setLifted] = useState(shown);
  const reduced = useReducedMotion();
  const veil = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = veil.current;
    if (!shown || !node) return;
    const fade = node.animate([{ opacity: 1 }, { opacity: 0 }], { ...REVEAL, fill: "forwards" });
    // Timed from the first frame the app draws, after the frames it takes to build.
    fade.pause();
    const frame = requestAnimationFrame(() => (fade.startTime = document.timeline.currentTime));
    fade.finished.then(
      () => setLifted(true),
      () => {},
    );
    return () => {
      cancelAnimationFrame(frame);
      fade.cancel();
    };
  }, [shown]);
  if (lifted || (shown && reduced)) return null;
  return <span ref={veil} className={cx(className, veilStyle)} style={style} data-app-veil="" aria-hidden />;
}
