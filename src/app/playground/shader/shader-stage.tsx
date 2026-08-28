"use client";

import type { ComponentProps } from "react";
import { css } from "../../../../styled-system/css";
import { CosmicTrack } from "@/components/shaders/cosmic-track";
import type { Params, ShaderSpec } from "@/data/shader-specs";

// ---------------------------------------------------------------------------
// One mounted shader, filling whatever it is put in.
//
// Its own module because there are two callers now — the playground's preview
// and the presets strip's thumbnailer — and they must mount the SAME thing: a
// thumbnail drawn by a second, slightly different switch would be a picture of
// a preset the page cannot produce.
//
// Every mount here costs a webgl2 context. The library pools nothing and
// registers no `webglcontextlost` handler, so the two callers between them are
// responsible for keeping the count down: the playground mounts exactly one,
// and the thumbnailer mounts exactly one at a time. See `preset-thumbnails`.
// ---------------------------------------------------------------------------

/** The preview is at most 680×680 at 2×; no detail in a soft gradient survives above it. */
export const MAX_PIXELS = 1280 * 1280;

/** Fills its parent, which must be positioned. */
export const layerStyle = css({ position: "absolute", inset: 0 });

export interface ShaderStageProps {
  spec: ShaderSpec;
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
  /** Defaults to the preview's ceiling; a thumbnail wants far less. */
  maxPixelCount?: number;
  /**
   * The floor on how many device pixels are drawn per CSS pixel. The library
   * renders at `max(devicePixelRatio, minPixelRatio)`, so raising this pins the
   * buffer's size regardless of the screen it is drawn on — which is what a
   * picture that will be KEPT needs, and a live shader does not. Left alone,
   * the library's own floor of 2 applies.
   */
  minPixelRatio?: number;
  /**
   * Read ONCE, when the context is created — the library keeps the first value
   * in a ref and never revisits it. `preserveDrawingBuffer` is the one that
   * matters here: without it the drawing buffer is cleared as soon as the frame
   * is composited, and `toDataURL` a moment later returns an empty picture.
   */
  webGlContextAttributes?: WebGLContextAttributes;
}

/**
 * The params object is spread in wholesale — the control table is what
 * guarantees the keys match the uniforms, and `shader-specs.test.ts` is what
 * guarantees the table does. The component ignores anything it does not
 * recognise.
 */
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
    // Pinned, not exposed: the surface IS the canvas here, and a ground with
    // margins is just a smaller picture. See `FRAMING_CONTROLS`.
    fit: "cover" as const,
    maxPixelCount,
    minPixelRatio,
    webGlContextAttributes,
  };

  // A SWITCH over one id, rather than the mount written straight out. The
  // table is the list of shaders (see `shader-specs.ts`) and this is where an
  // id becomes a component; collapsing it would move that mapping into an
  // assumption, and the second shader would have to reinstate it. TypeScript
  // reads the union, so a new id fails to compile here until it is mounted.
  switch (spec.id) {
    case "cosmicTrack":
      return <CosmicTrack {...(props as ComponentProps<typeof CosmicTrack>)} />;
  }
}
