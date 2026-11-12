"use client";

import { memo } from "react";
import { ShaderMount, type ShaderComponentProps } from "@paper-design/shaders-react";
import {
  ShaderFitOptions,
  defaultObjectSizing,
  type ShaderSizingParams,
} from "@paper-design/shaders";
import { prismFoldFragmentShader } from "./prism-fold-shader";
import {
  DEFAULT_PRISM_FOLD,
  toPrismFoldUniforms,
  type PrismFoldParams,
} from "./prism-fold-uniforms";
import { useShaderPolicy } from "./use-shader-policy";

export interface PrismFoldProps
  extends ShaderComponentProps,
    Partial<PrismFoldParams>,
    ShaderSizingParams {
  /** Held at 0 under `prefers-reduced-motion`. */
  speed?: number;
  frame?: number;
}

function PrismFoldImpl({
  colors = DEFAULT_PRISM_FOLD.colors,
  colorSeam = DEFAULT_PRISM_FOLD.colorSeam,
  folds = DEFAULT_PRISM_FOLD.folds,
  fan = DEFAULT_PRISM_FOLD.fan,
  curve = DEFAULT_PRISM_FOLD.curve,
  lift = DEFAULT_PRISM_FOLD.lift,
  softness = DEFAULT_PRISM_FOLD.softness,
  spread = DEFAULT_PRISM_FOLD.spread,
  warp = DEFAULT_PRISM_FOLD.warp,
  sheen = DEFAULT_PRISM_FOLD.sheen,
  sheenWidth = DEFAULT_PRISM_FOLD.sheenWidth,
  seam = DEFAULT_PRISM_FOLD.seam,
  seamWidth = DEFAULT_PRISM_FOLD.seamWidth,
  seamFalloff = DEFAULT_PRISM_FOLD.seamFalloff,
  dispersion = DEFAULT_PRISM_FOLD.dispersion,
  grain = DEFAULT_PRISM_FOLD.grain,

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
}: PrismFoldProps) {
  const policy = useShaderPolicy({ speed, maxPixelCount, fit });

  const uniforms = {
    ...toPrismFoldUniforms({
      colors,
      colorSeam,
      folds,
      fan,
      curve,
      lift,
      softness,
      spread,
      warp,
      sheen,
      sheenWidth,
      seam,
      seamWidth,
      seamFalloff,
      dispersion,
      grain,
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
      fragmentShader={prismFoldFragmentShader}
      uniforms={uniforms}
    />
  );
}

/** Compares `colors` by value: a literal array would otherwise defeat memo on every render. */
export const PrismFold = memo(PrismFoldImpl, (prev, next) => {
  const { colors: prevColors, ...prevRest } = prev;
  const { colors: nextColors, ...nextRest } = next;

  if (prevColors?.length !== nextColors?.length) return false;
  if (prevColors && nextColors && prevColors.some((color, i) => color !== nextColors[i])) {
    return false;
  }

  const keys = Object.keys(prevRest) as (keyof typeof prevRest)[];
  if (keys.length !== Object.keys(nextRest).length) return false;
  return keys.every((key) => prevRest[key] === nextRest[key]);
});
