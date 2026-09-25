"use client";

import { useEffect, useState } from "react";
import { css } from "../../styled-system/css";
import { SHADER_SPECS, type ShaderId } from "@/data/shader-specs";
import {
  DEFAULT_SHADER_PRESET_ASPECT,
  paletteFor,
  shaderParamsFor,
  type ShaderPresetSettings,
} from "@/domain/shader-preset";
import { ShaderStage } from "@/components/shaders/shader-stage";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// One layer per distinct shader, mounted for the reel's life: re-keying one mount would spend a
// fresh WebGL context per handover, since dispose() never calls loseContext.

export interface ReelPreset {
  id: string;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
}

/** A ceiling, not a quota. */
export const REEL_LENGTH = 3;

/** The newest few, narrowed to what a layer reads; relies on `getShaderPresets`'s newest-first order. */
export function toReelPresets(presets: readonly ReelPreset[]): ReelPreset[] {
  return presets
    .slice(0, REEL_LENGTH)
    .map(({ id, shaderId, settings }) => ({ id, shaderId, settings }));
}

/** The settled hold per preset; a full turn adds both fade halves. */
export const DWELL_MS = 5_000;

/** One half of a handover: the fade off, and later the fade on. */
export const FADE_MS = 400;

export type ReelPhase = "holding" | "fadingOut" | "fadingIn";

export interface ReelState {
  /** The current preset; still the outgoing one mid-fade. */
  index: number;
  phase: ReelPhase;
}

export const REEL_START: ReelState = { index: 0, phase: "holding" };

/** Turns the index over at the bottom of the fade, never in view; fewer than two presets hold still. */
export function advanceReel(state: ReelState, count: number): ReelState {
  if (count < 2) return REEL_START;
  switch (state.phase) {
    case "holding":
      return { index: state.index, phase: "fadingOut" };
    case "fadingOut":
      return { index: (state.index + 1) % count, phase: "fadingIn" };
    case "fadingIn":
      return { index: state.index, phase: "holding" };
  }
}

export interface ReelLayer {
  shaderId: ShaderId;
  presetIndex: number;
  lit: boolean;
}

/** One layer per distinct shader, in first-use order, so React keeps every mount. */
export function reelLayers(
  presets: ReelPreset[],
  state: ReelState,
): ReelLayer[] {
  const shaders: ShaderId[] = [];
  for (const preset of presets) {
    if (!shaders.includes(preset.shaderId)) shaders.push(preset.shaderId);
  }

  return shaders.map((shaderId) => ({
    shaderId,
    // The last preset this layer showed, so a dark layer never re-uploads uniforms.
    presetIndex: carriedIndex(presets, shaderId, state.index),
    lit:
      state.phase !== "fadingOut" &&
      presets[state.index]?.shaderId === shaderId,
  }));
}

function carriedIndex(
  presets: ReelPreset[],
  shaderId: ShaderId,
  from: number,
): number {
  for (let step = 0; step < presets.length; step++) {
    const index = (from - step + presets.length) % presets.length;
    if (presets[index].shaderId === shaderId) return index;
  }
  // Unreachable: every shader in the list came off a preset in the list.
  return 0;
}

const reelStyle = css({ position: "absolute", inset: 0, overflow: "hidden" });

const fadeStyle = css({
  position: "absolute",
  inset: 0,
  transitionProperty: "opacity",
  transitionTimingFunction: "ease",
});

export interface ShaderPresetReelPlayerProps {
  /** Newest first. */
  presets: ReelPreset[];
  /** The host's shape, which picks the preset's placement. */
  aspect?: DemoFrameAspectRatio;
}

export function ShaderPresetReelPlayer({
  presets,
  aspect = DEFAULT_SHADER_PRESET_ASPECT,
}: ShaderPresetReelPlayerProps) {
  const { isDark } = useThemeToggle();
  const theme = isDark ? "dark" : "light";
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<ReelState>(REEL_START);

  useEffect(() => {
    if (reducedMotion || presets.length < 2) return;
    const timer = setTimeout(
      () => setState((was) => advanceReel(was, presets.length)),
      state.phase === "holding" ? DWELL_MS : FADE_MS,
    );
    return () => clearTimeout(timer);
  }, [state, reducedMotion, presets.length]);

  if (presets.length === 0) return null;

  return (
    <div className={reelStyle} aria-hidden>
      {reelLayers(presets, state).map((layer) => {
        const preset = presets[layer.presetIndex];
        const palette = paletteFor(preset.settings, theme);
        return (
          <div
            key={layer.shaderId}
            data-testid={`reel-layer-${layer.shaderId}`}
            className={fadeStyle}
            style={{
              opacity: layer.lit ? 1 : 0,
              transitionDuration: `${FADE_MS}ms`,
            }}
          >
            <ShaderStage
              spec={SHADER_SPECS[layer.shaderId]}
              // Speed 0 (which cancels the rAF) unless this layer carries the current preset, lit or not.
              params={{
                ...shaderParamsFor(preset.settings, aspect),
                ...(layer.presetIndex === state.index ? {} : { speed: 0 }),
              }}
              colors={palette.colors}
              // Spelled out, not spread: `paletteFor` omits the key, and the prop is required-but-optional.
              colorBack={palette.colorBack}
              extraColors={palette.extraColors}
            />
          </div>
        );
      })}
    </div>
  );
}
