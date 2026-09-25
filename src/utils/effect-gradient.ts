import { hexToRgb, parseColor } from "@/utils/color-value";
import type { BackgroundEffect } from "@/domain/nodes";

// A CSS approximation of the mesh-gradient shader, for Satori, which has no WebGL.

const SPREAD = 70;

const SPOT_SIZE = 85;

export interface EffectSpot {
  /** `rgba()`: Satori does not read an eight-digit hex. */
  color: string;
  /** The same colour at zero alpha: `transparent` is transparent black and greys the fade. */
  fade: string;
  /** Percent of the box, from its top-left. */
  x: number;
  y: number;
}

function toRgba(value: string, alpha?: number): string {
  const { hex, opacity } = parseColor(value);
  const { r, g, b } = hexToRgb(hex);
  const a = alpha ?? Number((opacity / 100).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Screen coordinates, so `y` grows downward, as in the shader. */
export function effectSpots(effect: BackgroundEffect): EffectSpot[] {
  const colors = effect.colors;
  const radians = (effect.rotation * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);

  // As the shader's `graphicOffset`: a positive offset moves the ground right and down.
  const centreX = 50 + effect.offsetX * 50;
  const centreY = 50 + effect.offsetY * 50;

  return colors.map((color, index) => {
    const along = colors.length === 1 ? 0 : index / (colors.length - 1) - 0.5;
    return {
      color: toRgba(color),
      fade: toRgba(color, 0),
      x: centreX + dx * along * SPREAD,
      y: centreY + dy * along * SPREAD,
    };
  });
}

export function effectStyle(effect: BackgroundEffect): {
  backgroundColor: string;
  backgroundImage: string;
} {
  const spots = effectSpots(effect);
  const fill = spots[spots.length - 1]?.color ?? "rgba(0, 0, 0, 0)";

  if (spots.length === 1) {
    return { backgroundColor: fill, backgroundImage: "" };
  }

  // The first CSS layer paints on top, so the first colour stays visible at its end.
  return {
    backgroundColor: fill,
    backgroundImage: spots
      .map(
        ({ color, fade, x, y }) =>
          `radial-gradient(${SPOT_SIZE}% ${SPOT_SIZE}% at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${color} 0%, ${fade} 100%)`,
      )
      .join(", "),
  };
}
