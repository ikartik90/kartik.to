"use client";

import type { CSSProperties } from "react";
import { css } from "../../styled-system/css";
import { SHADER_SPECS } from "@/data/shader-specs";
import {
  paletteFor,
  shaderParamsFor,
  type ShaderPresetContent,
} from "@/domain/shader-preset";
import { ShaderStage } from "@/components/shaders/shader-stage";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// The preset's ground per theme in CSS: `isDark` is false until mounted, and this shows before the first frame.
const groundStyle = css({
  position: "absolute",
  inset: 0,
  backgroundColor: "var(--shader-ground-light)",
  _dark: { backgroundColor: "var(--shader-ground-dark)" },
});

export interface ShaderCoverProps {
  preset: ShaderPresetContent;
  /** The card's shape, which picks the preset's framing. */
  aspect: DemoFrameAspectRatio;
}

/** A shader preset playing across its positioned parent. */
export function ShaderCover({ preset, aspect }: ShaderCoverProps) {
  const { isDark } = useThemeToggle();
  const reducedMotion = useReducedMotion();
  const { settings } = preset;
  const palette = paletteFor(settings, isDark ? "dark" : "light");
  const params = shaderParamsFor(settings, aspect);

  return (
    <div
      className={groundStyle}
      style={
        {
          "--shader-ground-light": settings.colorBack?.light,
          "--shader-ground-dark": settings.colorBack?.dark,
        } as CSSProperties
      }
    >
      <ShaderStage
        spec={SHADER_SPECS[preset.shaderId]}
        params={reducedMotion ? { ...params, speed: 0 } : params}
        colors={palette.colors}
        colorBack={palette.colorBack}
        extraColors={palette.extraColors}
      />
    </div>
  );
}
