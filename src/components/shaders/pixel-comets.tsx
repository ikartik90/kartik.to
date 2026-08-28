"use client";

import { memo } from "react";
import { ShaderMount, type ShaderComponentProps } from "@paper-design/shaders-react";
import {
  ShaderFitOptions,
  defaultObjectSizing,
  type ShaderSizingParams,
} from "@paper-design/shaders";
import { pixelCometsFragmentShader } from "./pixel-comets-shader";
import {
  DEFAULT_PIXEL_COMETS,
  toPixelCometsUniforms,
  type PixelCometsParams,
} from "./pixel-comets-uniforms";
import { useShaderPolicy } from "./use-shader-policy";

// ---------------------------------------------------------------------------
// Pixel Comets — coloured pixels running the lanes of a lattice, trailing as
// they go.
//
// Shaped exactly like `CosmicTrack`, which is shaped exactly like one of the
// library's own: friendly props in, a `uniforms` object out, straight into
// `ShaderMount`. No layer of ours in between to drift.
// ---------------------------------------------------------------------------

export interface PixelCometsProps
  extends ShaderComponentProps,
    Partial<PixelCometsParams>,
    ShaderSizingParams {
  /** Animation rate. Held at 0 under `prefers-reduced-motion`. */
  speed?: number;
  frame?: number;
}

function PixelCometsImpl({
  colors = DEFAULT_PIXEL_COMETS.colors,
  colorBack = DEFAULT_PIXEL_COMETS.colorBack,
  colorGrid = DEFAULT_PIXEL_COMETS.colorGrid,
  colorGridMajor = DEFAULT_PIXEL_COMETS.colorGridMajor,
  pixelSize = DEFAULT_PIXEL_COMETS.pixelSize,
  count = DEFAULT_PIXEL_COMETS.count,
  originMin = DEFAULT_PIXEL_COMETS.originMin,
  originMax = DEFAULT_PIXEL_COMETS.originMax,
  travelSpans = DEFAULT_PIXEL_COMETS.travelSpans,
  parallax = DEFAULT_PIXEL_COMETS.parallax,
  tail = DEFAULT_PIXEL_COMETS.tail,
  tailBlend = DEFAULT_PIXEL_COMETS.tailBlend,
  falloff = DEFAULT_PIXEL_COMETS.falloff,
  headGlow = DEFAULT_PIXEL_COMETS.headGlow,
  headRadius = DEFAULT_PIXEL_COMETS.headRadius,
  headStretch = DEFAULT_PIXEL_COMETS.headStretch,
  tailGlow = DEFAULT_PIXEL_COMETS.tailGlow,
  tailRadius = DEFAULT_PIXEL_COMETS.tailRadius,
  gridWidth = DEFAULT_PIXEL_COMETS.gridWidth,
  majorGrid = DEFAULT_PIXEL_COMETS.majorGrid,
  easing = DEFAULT_PIXEL_COMETS.easing,
  easingBias = DEFAULT_PIXEL_COMETS.easingBias,

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
}: PixelCometsProps) {
  const policy = useShaderPolicy({ speed, maxPixelCount, fit });

  const uniforms = {
    ...toPixelCometsUniforms({
      colors,
      colorBack,
      colorGrid,
      colorGridMajor,
      pixelSize,
      count,
      originMin,
      originMax,
      travelSpans,
      parallax,
      tail,
      tailBlend,
      falloff,
      headGlow,
      headRadius,
      headStretch,
      tailGlow,
      tailRadius,
      gridWidth,
      majorGrid,
      easing,
      easingBias,
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
      fragmentShader={pixelCometsFragmentShader}
      uniforms={uniforms}
    />
  );
}

/**
 * Memoised with a comparator that looks INSIDE `colors` — see `CosmicTrack`,
 * where the same note explains why the default `memo` is defeated by an array
 * prop and re-uploads every uniform on every parent render.
 */
export const PixelComets = memo(PixelCometsImpl, (prev, next) => {
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
