"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Dithering } from "@paper-design/shaders-react";
import type { DitheringShape, DitheringType } from "@paper-design/shaders";
import { flattenColor, type Rgba } from "@/utils/flatten-color";
import { SHADER_MAX_PIXELS, useReducedMotion } from "./use-shader-policy";

// Paper's Dithering in the site's colours. The shader reads only rgb()/hex, so each token is resolved to pixels
// through a 1×1 canvas, again whenever the theme turns.

function resolve(variable: string): Rgba | null {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  return () => observer.disconnect();
};
const readTheme = () => document.documentElement.dataset.theme ?? "";

export interface DitherGroundProps {
  shape: DitheringShape;
  type: DitheringType;
  /** The dither's pixel, in CSS px. */
  size: number;
  scale: number;
  speed: number;
  /** The CSS variable the pattern is drawn in, e.g. `--colors-border-divider`. */
  ink: string;
  /** The ink's share against the canvas colour, 0–1. */
  strength: number;
  className?: string;
  style?: CSSProperties;
}

export function DitherGround({ shape, type, size, scale, speed, ink, strength, className, style }: DitherGroundProps) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "");
  const reducedMotion = useReducedMotion();
  const [colors, setColors] = useState<{ back: string; front: string } | null>(null);

  useEffect(() => {
    // After the theme's styles apply, so the probe reads the new values.
    const frame = requestAnimationFrame(() => {
      const back = resolve("--colors-bg-canvas");
      const front = resolve(ink);
      if (back && front) setColors({ back: flattenColor(back, back, 1), front: flattenColor(front, back, strength) });
    });
    return () => cancelAnimationFrame(frame);
  }, [theme, ink, strength]);

  if (!colors) return null;
  return (
    <Dithering
      className={className}
      style={style}
      colorBack={colors.back}
      colorFront={colors.front}
      shape={shape}
      type={type}
      size={size}
      scale={scale}
      speed={reducedMotion ? 0 : speed}
      fit="cover"
      maxPixelCount={SHADER_MAX_PIXELS}
    />
  );
}
