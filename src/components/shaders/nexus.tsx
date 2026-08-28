"use client";

import { memo } from "react";
import { ShaderMount, type ShaderComponentProps } from "@paper-design/shaders-react";
import {
  ShaderFitOptions,
  defaultObjectSizing,
  type ShaderSizingParams,
} from "@paper-design/shaders";
import { nexusFragmentShader } from "./nexus-shader";
import {
  DEFAULT_NEXUS,
  toNexusUniforms,
  type NexusParams,
} from "./nexus-uniforms";
import { useShaderPolicy } from "./use-shader-policy";

// ---------------------------------------------------------------------------
// Nexus — coloured pixels running the lanes of a lattice, trailing as they go.
//
// Shaped exactly like `CosmicTrack`, which is shaped exactly like one of the
// library's own: friendly props in, a `uniforms` object out, straight into
// `ShaderMount`. No layer of ours in between to drift.
// ---------------------------------------------------------------------------

export interface NexusProps
  extends ShaderComponentProps,
    Partial<NexusParams>,
    ShaderSizingParams {
  /** Animation rate. Held at 0 under `prefers-reduced-motion`. */
  speed?: number;
  frame?: number;
}

function NexusImpl({
  colors = DEFAULT_NEXUS.colors,
  colorBack = DEFAULT_NEXUS.colorBack,
  colorGrid = DEFAULT_NEXUS.colorGrid,
  colorGridMajor = DEFAULT_NEXUS.colorGridMajor,
  pixelSize = DEFAULT_NEXUS.pixelSize,
  count = DEFAULT_NEXUS.count,
  seed = DEFAULT_NEXUS.seed,
  travel = DEFAULT_NEXUS.travel,
  tail = DEFAULT_NEXUS.tail,
  tailBlend = DEFAULT_NEXUS.tailBlend,
  falloff = DEFAULT_NEXUS.falloff,
  headGlow = DEFAULT_NEXUS.headGlow,
  headRadius = DEFAULT_NEXUS.headRadius,
  tailGlow = DEFAULT_NEXUS.tailGlow,
  tailRadius = DEFAULT_NEXUS.tailRadius,
  gridWidth = DEFAULT_NEXUS.gridWidth,
  majorGrid = DEFAULT_NEXUS.majorGrid,
  easing = DEFAULT_NEXUS.easing,
  easingBias = DEFAULT_NEXUS.easingBias,

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
}: NexusProps) {
  const policy = useShaderPolicy({ speed, maxPixelCount, fit });

  const uniforms = {
    ...toNexusUniforms({
      colors,
      colorBack,
      colorGrid,
      colorGridMajor,
      pixelSize,
      count,
      seed,
      travel,
      tail,
      tailBlend,
      falloff,
      headGlow,
      headRadius,
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
      fragmentShader={nexusFragmentShader}
      uniforms={uniforms}
    />
  );
}

/**
 * Memoised with a comparator that looks INSIDE `colors` — see `CosmicTrack`,
 * where the same note explains why the default `memo` is defeated by an array
 * prop and re-uploads every uniform on every parent render.
 */
export const Nexus = memo(NexusImpl, (prev, next) => {
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
