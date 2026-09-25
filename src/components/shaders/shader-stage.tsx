"use client";

import type { ComponentProps } from "react";
import { css } from "../../../styled-system/css";
import { CosmicTrack } from "./cosmic-track";
import { PixelComets } from "./pixel-comets";
import type { Params, ShaderSpec } from "@/data/shader-specs";

export const MAX_PIXELS = 1280 * 1280;

/** Fills its parent, which must be positioned. */
export const layerStyle = css({ position: "absolute", inset: 0 });

export interface ShaderStageProps {
  spec: ShaderSpec;
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
  maxPixelCount?: number;
  /** Floor on device pixels per CSS pixel; raising it pins the buffer size for a picture that is kept. */
  minPixelRatio?: number;
  /** Read once, at context creation. `toDataURL` needs `preserveDrawingBuffer`, or it returns an empty picture. */
  webGlContextAttributes?: WebGLContextAttributes;
}

// Every mount costs a WebGL2 context the library never pools or restores; keep mounts few.
export function ShaderStage({
  spec,
  params,
  colors,
  colorBack,
  extraColors,
  maxPixelCount = MAX_PIXELS,
  minPixelRatio,
  webGlContextAttributes,
}: ShaderStageProps) {
  const props = {
    ...params,
    ...extraColors,
    ...(spec.hasColorBack ? { colorBack } : {}),
    colors,
    className: layerStyle,
    fit: "cover" as const,
    maxPixelCount,
    minPixelRatio,
    webGlContextAttributes,
  };

  switch (spec.id) {
    case "cosmicTrack":
      return <CosmicTrack {...(props as ComponentProps<typeof CosmicTrack>)} />;
    case "pixelComets":
      return <PixelComets {...(props as ComponentProps<typeof PixelComets>)} />;
  }
}
