"use client";

import { StaticMeshGradient } from "@paper-design/shaders-react";
import { useRef, type CSSProperties } from "react";
import type { BackgroundEffect } from "@/domain/nodes";
import { useFirstFoldSettled } from "@/hooks/use-first-fold-settled";
import { useNearView } from "@/hooks/use-near-view";

const MAX_PIXELS = 1280 * 1280;

// One object, not a literal per render: the shader redraws whenever a prop is a new value.
// `preserveDrawingBuffer` keeps its frame readable for the copies the drag and lightbox draw.
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = { preserveDrawingBuffer: true };

export interface BackgroundEffectLayerProps {
  effect: BackgroundEffect;
  className?: string;
  style?: CSSProperties;
  /** Makes no WebGL context until it comes near the screen, after the first fold. */
  lazy?: boolean;
}

export function BackgroundEffectLayer({
  effect,
  className,
  style,
  lazy = false,
}: BackgroundEffectLayerProps) {
  const ground = useRef<HTMLDivElement>(null);
  const near = useNearView(ground);
  const settled = useFirstFoldSettled();
  if (lazy && !(near && settled)) return <div ref={ground} aria-hidden className={className} style={style} />;

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
