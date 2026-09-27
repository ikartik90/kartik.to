"use client";

import { StaticMeshGradient } from "@paper-design/shaders-react";
import type { CSSProperties } from "react";
import type { BackgroundEffect } from "@/domain/nodes";

const MAX_PIXELS = 1280 * 1280;

// One object, not a literal per render: the shader redraws whenever a prop is a new value.
// `preserveDrawingBuffer` keeps its frame readable for the copies the drag and lightbox draw.
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = { preserveDrawingBuffer: true };

export interface BackgroundEffectLayerProps {
  effect: BackgroundEffect;
  className?: string;
  style?: CSSProperties;
}

export function BackgroundEffectLayer({
  effect,
  className,
  style,
}: BackgroundEffectLayerProps) {
  return (
    <StaticMeshGradient
      aria-hidden
      data-background-effect=""
      className={className}
      style={style}
      colors={effect.colors}
      positions={effect.positions}
      waveX={effect.waveX}
      waveXShift={effect.waveXShift}
      waveY={effect.waveY}
      waveYShift={effect.waveYShift}
      mixing={effect.mixing}
      grainMixer={effect.grainMixer}
      grainOverlay={effect.grainOverlay}
      scale={effect.scale}
      rotation={effect.rotation}
      offsetX={effect.offsetX}
      offsetY={effect.offsetY}
      fit="cover"
      speed={0}
      maxPixelCount={MAX_PIXELS}
      webGlContextAttributes={CONTEXT_ATTRIBUTES}
    />
  );
}
