import type { BackgroundEffect, MediaNode } from "@/domain/nodes";

/** A clip's shader ground, the walkthroughs' own wave. */
export const clipGround = (colors: string[], rest: Partial<BackgroundEffect>): BackgroundEffect => ({
  colors,
  positions: 2,
  waveX: 1,
  waveXShift: 0.6,
  waveY: 1,
  waveYShift: 0.21,
  mixing: 0.93,
  grainMixer: 0,
  grainOverlay: 0,
  scale: 1,
  rotation: -90,
  offsetX: 0,
  offsetY: 0,
  ...rest,
});

/** A 2160 × 1350 screen recording, inset on its ground. */
export const walkthroughClip = (
  src: string,
  poster: string,
  alt: string,
  backgroundEffect: BackgroundEffect,
): MediaNode => ({
  type: "media",
  kind: "video",
  src,
  poster,
  alt,
  width: 2160,
  height: 1350,
  padding: 40,
  objectFit: "contain",
  borderRadius: 6,
  backgroundEffect,
});
