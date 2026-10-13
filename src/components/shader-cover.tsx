"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { css } from "../../styled-system/css";
import { SHADER_SPECS } from "@/data/shader-specs";
import {
  paletteFor,
  shaderParamsFor,
  type ShaderPresetContent,
} from "@/domain/shader-preset";
import { MAX_PIXELS, ShaderStage } from "@/components/shaders/shader-stage";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { useNearView } from "@/hooks/use-near-view";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { shaderZoom } from "@/utils/shader-zoom";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// The preset's ground per theme in CSS: `isDark` is false until mounted, and this shows before the first frame.
const groundStyle = css({
  position: "absolute",
  inset: 0,
  backgroundColor: "var(--shader-ground-light)",
  _dark: { backgroundColor: "var(--shader-ground-dark)" },
});

const zoomedStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInlineStart: 0,
  width: "calc(100% / var(--shader-zoom))",
  height: "calc(100% / var(--shader-zoom))",
  transform: "scale(var(--shader-zoom))",
  transformOrigin: "top left",
});

export interface ShaderCoverProps {
  preset: ShaderPresetContent;
  /** The card's shape, which picks the preset's framing. */
  aspect: DemoFrameAspectRatio;
}

/**
 * A shader preset playing across its positioned parent, as the playground previews it, scaled to fit. Mounted only
 * near the screen: offscreen, the library still compiles and draws a few frames, which cost whole seconds on a
 * software renderer.
 */
export function ShaderCover({ preset, aspect }: ShaderCoverProps) {
  const groundRef = useRef<HTMLDivElement>(null);
  const near = useNearView(groundRef);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const { isDark } = useThemeToggle();
  const reducedMotion = useReducedMotion();
  const { settings } = preset;
  const palette = paletteFor(settings, isDark ? "dark" : "light");
  const params = shaderParamsFor(settings, aspect);

  useEffect(() => {
    const ground = groundRef.current;
    if (!ground) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(ground);
    return () => observer.disconnect();
  }, []);

  const zoom = size && shaderZoom(size.width, size.height, window.devicePixelRatio);

  return (
    <div
      ref={groundRef}
      className={groundStyle}
      style={
        {
          "--shader-ground-light": settings.colorBack?.light,
          "--shader-ground-dark": settings.colorBack?.dark,
        } as CSSProperties
      }
    >
      {near && zoom && (
        <div
          className={zoomedStyle}
          style={{ "--shader-zoom": zoom.zoom } as CSSProperties}
        >
          <ShaderStage
            spec={SHADER_SPECS[preset.shaderId]}
            params={reducedMotion ? { ...params, speed: 0 } : params}
            colors={palette.colors}
            colorBack={palette.colorBack}
            extraColors={palette.extraColors}
            minPixelRatio={zoom.minPixelRatio}
            maxPixelCount={Math.min(zoom.maxPixelCount, MAX_PIXELS)}
          />
        </div>
      )}
    </div>
  );
}
