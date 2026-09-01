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

// ---------------------------------------------------------------------------
// The reel itself: a few saved presets, played one at a time.
//
// ONE LAYER PER SHADER, mounted for the life of the reel — not one mount that
// swaps preset. That is the whole design, and it is a context budget rather
// than a preference. The React wrapper builds its mount in an effect keyed on
// `fragmentShader`, and `dispose()` deletes the program and detaches the canvas
// but never calls `loseContext` (see `shader-mount.js`), so a single mount that
// re-keyed on every handover would spend a fresh webgl2 context each time two
// consecutive presets used different shaders. A reel loops forever; the
// thumbnailer's queue does not, which is why it can get away with re-keying and
// this cannot. Somewhere past the browser's cap the oldest context is dropped,
// and the oldest context on this site belongs to something else entirely.
//
// Mounted per shader, the count is `distinct shaders among the presets` — two
// today, and bounded by `SHADER_IDS` forever — and it never changes after the
// first render. Dark layers are held at `speed: 0`, which cancels the library's
// rAF outright, so an idle layer costs its context and nothing else.
//
// A HANDOVER IS TWO HALVES, not a crossfade, and that also follows from the
// layers. Two presets sharing a shader share a canvas, and a canvas cannot fade
// against itself — so a crossfade would be available for some pairs of presets
// and not others, and which ones would depend on what happened to be saved
// last. Instead every handover fades the current picture off, then fades the
// next one on.
//
// It fades through NOTHING — the host's own background, whatever the reel is
// standing on. There was a layer under the pictures painting the preset's
// colours as a CSS gradient, so the colours would arrive before the picture
// did; it read as a wash of unrelated colour sliding under the shader, which is
// worse than a plain gap and drew attention to exactly the moment that should
// pass unnoticed. A gap costs nothing, reads identically for every pair of
// presets, and is what "fading out" already implied.
// ---------------------------------------------------------------------------

/** What the reel needs off a preset. The row's other columns are the strip's. */
export interface ReelPreset {
  id: string;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
}

/**
 * How many presets a full reel plays.
 *
 * A CEILING, not a quota. Fewer than this is the ordinary case for a young
 * library and not a shortfall to pad out — the reel plays two, or one, or draws
 * nothing at all, and none of those is a different component.
 */
export const REEL_LENGTH = 3;

/**
 * The newest few presets, cut down to what a layer actually reads off one.
 *
 * HERE rather than in either half that calls it, because both do: the server
 * component fetches for the page and the demo wrapper fetches for the browser,
 * and "the newest three, narrowed" written twice is the rule that would end up
 * meaning two different things.
 *
 * It does not sort. `getShaderPresets` already answers newest-first, and a
 * second opinion about the order here is the one that would go stale.
 *
 * The narrowing earns its keep on the server side especially: everything that
 * crosses that boundary is serialised into the page, and a preset's row carries
 * a title, a publication date and two timestamps the ground has no use for.
 */
export function toReelPresets(presets: readonly ReelPreset[]): ReelPreset[] {
  return presets
    .slice(0, REEL_LENGTH)
    .map(({ id, shaderId, settings }) => ({ id, shaderId, settings }));
}

/**
 * How long a preset holds the reel, in milliseconds — the SETTLED time, not the
 * period. A full turn is this plus the two halves of the handover below.
 */
export const DWELL_MS = 5_000;

/** One half of a handover: the fade off, and later the fade on. */
export const FADE_MS = 400;

export type ReelPhase = "holding" | "fadingOut" | "fadingIn";

export interface ReelState {
  /** Which preset is the reel's CURRENT one — still the outgoing one mid-fade. */
  index: number;
  phase: ReelPhase;
}

export const REEL_START: ReelState = { index: 0, phase: "holding" };

/**
 * The next step of the machine.
 *
 * The index turns over at the BOTTOM of the fade rather than at the top of it,
 * which is the only place it can: at the top the outgoing picture is still on
 * screen, and advancing there would swap it in full view.
 *
 * Fewer than two presets is held still rather than cycled. A reel of one has
 * nothing to hand over to, and fading a preset out and back into itself is a
 * flicker with no content in it.
 */
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
  /** Which preset's uniforms this layer is currently carrying. */
  presetIndex: number;
  /** Whether this layer is the picture on screen. */
  lit: boolean;
}

/**
 * The layers to mount, and what each is doing right now.
 *
 * One per distinct shader, in the order the presets first ask for them — so the
 * list is stable for a given set of presets and React keeps every mount across
 * the whole reel.
 */
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
    // The last preset this layer actually SHOWED — found by walking back from
    // the current index, wrapping — rather than the first in the list that uses
    // the shader. A dark layer holding its old uniforms is a canvas nobody is
    // looking at costing nothing; resetting it would be a `setUniforms` upload
    // per handover for a picture that is not on screen.
    presetIndex: carriedIndex(presets, shaderId, state.index),
    // Nothing is lit at the bottom of a handover. That is what makes the two
    // halves read identically whether or not the shader changed between them.
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

// Fills its host, which owns the shape — a preset records none, so the reel
// records none either. See the `ShaderPreset` model's own note on being
// shapeless.
const reelStyle = css({ position: "absolute", inset: 0, overflow: "hidden" });

// Every layer is this same box, stacked in document order and fading on its
// own opacity. Nothing sits under them: the gap between two pictures is the
// host's background, by design.
const fadeStyle = css({
  position: "absolute",
  inset: 0,
  transitionProperty: "opacity",
  transitionTimingFunction: "ease",
});

export interface ShaderPresetReelPlayerProps {
  /** Newest first, as `getShaderPresets` hands them over. */
  presets: ReelPreset[];
  /**
   * The shape the reel is being drawn in, which the HOST knows and the reel
   * does not. A preset holds a placement per shape and names none of them as
   * its own, so this is what picks between them — the same call the thumbnailer
   * makes when it says its tile is a square.
   */
  aspect?: DemoFrameAspectRatio;
}

export function ShaderPresetReelPlayer({
  presets,
  aspect = DEFAULT_SHADER_PRESET_ASPECT,
}: ShaderPresetReelPlayerProps) {
  const { isDark } = useThemeToggle();
  const theme = isDark ? "dark" : "light";
  // `useShaderPolicy` already holds every shader at a still under reduced
  // motion. This is the other half of that promise: a slideshow of stills is
  // still a slideshow, so the reel stops advancing too and shows the newest.
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
    // Decorative through and through: the reel is a ground, and a screen reader
    // announcing a shader changing every few seconds is noise with no content.
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
              // Held at a still unless this layer is carrying the CURRENT
              // preset — which is not the same as being lit. The outgoing layer
              // keeps animating all the way through its fade off; a layer that
              // has been handed over goes to zero, and zero cancels the
              // library's rAF rather than merely slowing it.
              params={{
                ...shaderParamsFor(preset.settings, aspect),
                ...(layer.presetIndex === state.index ? {} : { speed: 0 }),
              }}
              colors={palette.colors}
              // Spelled out rather than spread: `paletteFor` leaves the key OFF
              // a shader with no ground, and the stage's prop is
              // required-but-optional.
              colorBack={palette.colorBack}
              extraColors={palette.extraColors}
            />
          </div>
        );
      })}
    </div>
  );
}
