"use client";

import { memo } from "react";
import { ShaderMount, type ShaderComponentProps } from "@paper-design/shaders-react";
import {
  ShaderFitOptions,
  defaultObjectSizing,
  type ShaderSizingParams,
} from "@paper-design/shaders";
import { cosmicTrackFragmentShader } from "./cosmic-track-shader";
import {
  DEFAULT_COSMIC_TRACK,
  toCosmicTrackUniforms,
  type CosmicTrackParams,
} from "./cosmic-track-uniforms";
import { useShaderPolicy } from "./use-shader-policy";

// ---------------------------------------------------------------------------
// CosmicTrack — a fan of creased ribbons radiating from a point, on a flat ground.
//
// Shaped exactly like one of the library's own components (see `GodRays`):
// friendly props in, a `uniforms` object out, straight into `ShaderMount`. No
// layer of our own in between — the library's components call the mount
// directly, and an extra wrapper here would only be a passthrough to drift.
//
// Consumers write `<CosmicTrack colors={…} angle={…} />` and never see a
// uniform or a mount, which is the whole point of the shape.
// ---------------------------------------------------------------------------

export interface CosmicTrackProps
  extends ShaderComponentProps,
    Partial<CosmicTrackParams>,
    ShaderSizingParams {
  /** Animation rate. Held at 0 under `prefers-reduced-motion`. */
  speed?: number;
  frame?: number;
}

function CosmicTrackImpl({
  colors = DEFAULT_COSMIC_TRACK.colors,
  colorBack = DEFAULT_COSMIC_TRACK.colorBack,
  angle = DEFAULT_COSMIC_TRACK.angle,
  travel = DEFAULT_COSMIC_TRACK.travel,
  stagger = DEFAULT_COSMIC_TRACK.stagger,
  spread = DEFAULT_COSMIC_TRACK.spread,
  bandwidth = DEFAULT_COSMIC_TRACK.bandwidth,
  roundness = DEFAULT_COSMIC_TRACK.roundness,
  apex = DEFAULT_COSMIC_TRACK.apex,
  rampLength = DEFAULT_COSMIC_TRACK.rampLength,
  bandCount = DEFAULT_COSMIC_TRACK.bandCount,
  curve = DEFAULT_COSMIC_TRACK.curve,
  tilt = DEFAULT_COSMIC_TRACK.tilt,
  fold = DEFAULT_COSMIC_TRACK.fold,
  softness = DEFAULT_COSMIC_TRACK.softness,
  tail = DEFAULT_COSMIC_TRACK.tail,
  dither = DEFAULT_COSMIC_TRACK.dither,
  ditherSize = DEFAULT_COSMIC_TRACK.ditherSize,

  speed = 0,
  frame = 0,
  maxPixelCount,

  fit,
  scale = defaultObjectSizing.scale,
  rotation = defaultObjectSizing.rotation,
  originX = defaultObjectSizing.originX,
  originY = defaultObjectSizing.originY,
  offsetX = defaultObjectSizing.offsetX,
  offsetY = defaultObjectSizing.offsetY,
  worldWidth = defaultObjectSizing.worldWidth,
  worldHeight = defaultObjectSizing.worldHeight,
  ...props
}: CosmicTrackProps) {
  const policy = useShaderPolicy({ speed, maxPixelCount, fit });

  const uniforms = {
    ...toCosmicTrackUniforms({
      colors,
      colorBack,
      angle,
      travel,
      stagger,
      spread,
      bandwidth,
      roundness,
      apex,
      rampLength,
      bandCount,
      curve,
      tilt,
      fold,
      softness,
      tail,
      dither,
      ditherSize,
    }),
    u_fit: ShaderFitOptions[policy.fit],
    u_scale: scale,
    u_rotation: rotation,
    u_originX: originX,
    u_originY: originY,
    u_offsetX: offsetX,
    u_offsetY: offsetY,
    u_worldWidth: worldWidth,
    u_worldHeight: worldHeight,
  };

  return (
    <ShaderMount
      {...props}
      speed={policy.speed}
      frame={frame}
      maxPixelCount={policy.maxPixelCount}
      fragmentShader={cosmicTrackFragmentShader}
      uniforms={uniforms}
    />
  );
}

/**
 * Memoised with a comparator that looks INSIDE `colors`.
 *
 * The library memoises its own shaders the same way, and the reason is easy to
 * miss: `colors` is an array, so a caller passing a literal hands over a new
 * identity on every render and defeats a default `memo` completely — the
 * uniforms would be rebuilt and re-uploaded for every parent update.
 */
export const CosmicTrack = memo(CosmicTrackImpl, (prev, next) => {
  const { colors: prevColors, ...prevRest } = prev;
  const { colors: nextColors, ...nextRest } = next;

  if (prevColors?.length !== nextColors?.length) return false;
  if (prevColors && nextColors) {
    for (let i = 0; i < prevColors.length; i++) {
      if (prevColors[i] !== nextColors[i]) return false;
    }
  }

  const keys = Object.keys(prevRest) as (keyof typeof prevRest)[];
  if (keys.length !== Object.keys(nextRest).length) return false;
  return keys.every((key) => prevRest[key] === nextRest[key]);
});
