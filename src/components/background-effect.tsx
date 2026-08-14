"use client";

import { StaticMeshGradient } from "@paper-design/shaders-react";
import type { CSSProperties } from "react";
import type { BackgroundEffect } from "@/domain/nodes";

// ---------------------------------------------------------------------------
// BackgroundEffectLayer — the gradient painted behind one image.
//
// The SAME component in all three places an image appears (the editor cell, the
// reader's grid, the lightbox), because the effect is a property of the image
// rather than of the surface showing it: a backdrop that read differently while
// authoring would make the panel a guess rather than a preview.
//
// `Static`MeshGradient, not the animated one. It renders a single frame and
// stops — there is no rAF loop to pause, nothing for `prefers-reduced-motion`
// to object to, and no per-frame cost once the first draw has landed. `speed`
// is pinned to 0 regardless, so a future swap to an animated shader can't
// silently start moving behind every picture in an article.
// ---------------------------------------------------------------------------

/**
 * Ceiling on the render buffer. A static gradient costs ONE draw, so this is
 * about texture memory rather than frame time — a 2× buffer for the largest
 * tile the reader draws (the featured 2×2 at ~640px) with nothing to gain
 * above it, since the thing being sampled is a soft blend with no detail a
 * higher resolution could resolve.
 */
const MAX_PIXELS = 1280 * 1280;

export interface BackgroundEffectLayerProps {
  effect: BackgroundEffect;
  className?: string;
  /**
   * Anything about the layer a surface has to state at runtime. The corner is
   * NOT one of them — the ground fills the card it is on, so it takes the
   * card's corner from its own class, and the picture in front of it wears the
   * one the properties panel gave it.
   */
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
      // Fill the frame rather than letterboxing inside it: the gradient is a
      // ground, and a ground with margins is just a smaller picture.
      fit="cover"
      speed={0}
      maxPixelCount={MAX_PIXELS}
      // So the canvas can be READ BACK. The editor's drag preview is a plain
      // cloned <img> riding the cursor, and a cloned canvas is blank — cloning
      // copies the element, never its drawing buffer — so the gradient is
      // carried as a snapshot (`toDataURL`) taken when the drag begins.
      //
      // Without this the buffer is cleared once composited, and that snapshot
      // comes back empty for any shader drawn more than a frame ago — which is
      // every one of them, since these draw exactly once. It reads as "the
      // gradient works until you pick the picture up".
      //
      // The usual objection to `preserveDrawingBuffer` is the cost of keeping
      // the buffer alive across frames; there are no frames here to pay it on.
      webGlContextAttributes={{ preserveDrawingBuffer: true }}
    />
  );
}
