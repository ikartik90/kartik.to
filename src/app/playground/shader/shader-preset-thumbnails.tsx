"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { SHADER_SPECS } from "@/data/shader-specs";
import {
  paletteFor,
  shaderParamsFor,
  type ShaderPreset,
  type ShaderPresetContent,
  type ShaderPresetTheme,
} from "@/domain/shader-preset";
import { ShaderStage } from "@/components/shaders/shader-stage";

// One preset is mounted at a time, off-screen, and photographed: every mount holds its own
// WebGL context. `preserveDrawingBuffer` keeps the frame readable for `toDataURL`.

type Preset = ShaderPreset & ShaderPresetContent;

export function thumbnailKey(preset: Preset, theme: ShaderPresetTheme): string {
  // Theme is required, not defaulted: a default files pictures under the wrong ground.
  return `${preset.id}:${new Date(preset.updatedAt).getTime()}:${theme}`;
}

/** What is left to draw, grouped by shader so consecutive presets reuse a context. */
export function captureOrder(
  presets: Preset[],
  captured: ReadonlySet<string>,
  theme: ShaderPresetTheme,
): Preset[] {
  const pending = presets.filter(
    (preset) => !captured.has(thumbnailKey(preset, theme)),
  );
  const byShader = new Map<string, Preset[]>();
  for (const preset of pending) {
    const group = byShader.get(preset.shaderId);
    if (group) group.push(preset);
    else byShader.set(preset.shaderId, [preset]);
  }
  return [...byShader.values()].flat();
}

const cache = new Map<string, string>();

export function thumbnailSnapshot(): Record<string, string> {
  return Object.fromEntries(cache);
}

/** Tests only — module state outlives a component, so it outlives a test too. */
export function clearThumbnailCache(): void {
  cache.clear();
}

// Invisible but laid out: `display: none` would leave nothing to size or photograph.
const rendererStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  // Must match `TILE_PX`.
  width: "token(spacing.5xl)",
  height: "token(spacing.5xl)",
  opacity: 0,
  pointerEvents: "none",
  zIndex: -1,
});

/** `spacing.5xl` as a number, for the buffer arithmetic; must match `rendererStyle`. */
const TILE_PX = 80;

/** Pinned at 3, not the library's 2: a photograph taken at 2 is upscaled on 3× screens. */
const THUMBNAIL_SCALE = 3;
const THUMBNAIL_SIZE = TILE_PX * THUMBNAIL_SCALE;
const THUMBNAIL_PIXELS = THUMBNAIL_SIZE * THUMBNAIL_SIZE;

/** Frames to wait for one capture before giving up and keeping the swatch. */
const CAPTURE_FRAMES = 30;

export interface ShaderPresetThumbnailsProps {
  presets: Preset[];
  onCaptured: (key: string, dataUrl: string) => void;
  theme: ShaderPresetTheme;
}

export function ShaderPresetThumbnails({
  presets,
  onCaptured,
  theme,
}: ShaderPresetThumbnailsProps) {
  // An index, not a shrinking list, so a failed capture cannot stall the queue.
  const [index, setIndex] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  // A reused mount keeps its last frame, so a read matching this is still the previous preset.
  const lastCapture = useRef<string | null>(null);

  const queue = useMemo(() => {
    // Both grounds stay live, so a theme flip does not re-photograph the strip.
    const live = new Set([
      ...presets.map((preset) => thumbnailKey(preset, "light")),
      ...presets.map((preset) => thumbnailKey(preset, "dark")),
    ]);
    for (const key of cache.keys()) if (!live.has(key)) cache.delete(key);
    return captureOrder(presets, new Set(cache.keys()), theme);
  }, [presets, theme]);

  const [queueRef, setQueueRef] = useState(queue);
  if (queueRef !== queue) {
    setQueueRef(queue);
    setIndex(0);
  }

  const current = queue[index];

  useEffect(() => {
    if (!current) return;
    let frames = 0;
    let raf = 0;

    const tick = () => {
      frames += 1;
      const canvas = hostRef.current?.querySelector("canvas");
      // Three frames' grace: the mount renders a frame behind its uniforms.
      if (canvas && canvas.width > 0 && frames > 3) {
        try {
          const url = canvas.toDataURL("image/png");
          if (url !== lastCapture.current || frames > CAPTURE_FRAMES) {
            lastCapture.current = url;
            cache.set(thumbnailKey(current, theme), url);
            onCaptured(thumbnailKey(current, theme), url);
            setIndex((was) => was + 1);
            return;
          }
        } catch {
          setIndex((was) => was + 1);
          return;
        }
      }
      if (frames > CAPTURE_FRAMES) {
        setIndex((was) => was + 1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, onCaptured, theme]);

  if (!current) return null;

  const spec = SHADER_SPECS[current.shaderId];
  const palette = paletteFor(current.settings, theme);
  return (
    <div ref={hostRef} className={rendererStyle} aria-hidden>
      <ShaderStage
        spec={spec}
        // A still, framed for the square tile; speed 0 stops the library's loop.
        params={{ ...shaderParamsFor(current.settings, "1/1"), speed: 0 }}
        colors={palette.colors}
        // Spelled out, not spread: `paletteFor` omits the key for a shader with no ground.
        colorBack={palette.colorBack}
        extraColors={palette.extraColors}
        maxPixelCount={THUMBNAIL_PIXELS}
        minPixelRatio={THUMBNAIL_SCALE}
        webGlContextAttributes={{ preserveDrawingBuffer: true }}
      />
    </div>
  );
}
