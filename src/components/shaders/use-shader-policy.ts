"use client";

import { useSyncExternalStore } from "react";
import type { ShaderFit } from "@paper-design/shaders";

// ---------------------------------------------------------------------------
// The house rules every shader in this app renders under.
//
// A HOOK rather than a wrapper component, because the two kinds of shader here
// have no common element to sit inside: `BackgroundEffectLayer` wraps a
// built-in (`StaticMeshGradient`), `CosmicTrack` wraps our own GLSL through
// `ShaderMount`. A hook returns values both spread into whatever they render;
// a wrapper could only ever serve one of them.
// ---------------------------------------------------------------------------

/**
 * Ceiling on the render buffer, in device pixels. Sized for the largest surface
 * a shader currently fills (a lightbox-scale card at 2×) — beyond it there is
 * nothing to resolve, since what is being sampled is a soft blend with no fine
 * detail in it.
 *
 * The cost of a shader here is its WEBGL CONTEXT, not its fill rate: the
 * library pools nothing and registers no `webglcontextlost` handler, so past
 * the browser's cap (~16 in Chrome, fewer in Safari) the oldest canvas goes
 * blank permanently. Budget by counting simultaneous instances on a screen.
 */
export const SHADER_MAX_PIXELS = 1280 * 1280;

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Live `prefers-reduced-motion`, re-read when the user changes it mid-session. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    // The server cannot know, and guessing "reduced" would ship a still frame
    // to everyone for one hydration.
    () => false,
  );
}

export interface ShaderPolicyInput {
  /** The animation rate the caller asked for. Overridden to 0 under reduced motion. */
  speed?: number;
  maxPixelCount?: number;
  fit?: ShaderFit;
}

export interface ShaderPolicy {
  speed: number;
  maxPixelCount: number;
  fit: ShaderFit;
}

/**
 * Resolves a shader's motion and buffer settings against the house rules.
 *
 * `speed: 0` is not merely slow — the library cancels the rAF entirely at zero,
 * so a shader held still costs nothing per frame. That makes it the honest
 * answer to `prefers-reduced-motion` rather than a compromise.
 *
 * `fit` defaults to `cover` because these are GROUNDS, and a ground with
 * margins is just a smaller picture.
 */
export function useShaderPolicy({
  speed = 0,
  maxPixelCount = SHADER_MAX_PIXELS,
  fit = "cover",
}: ShaderPolicyInput = {}): ShaderPolicy {
  const reducedMotion = useReducedMotion();
  return { speed: reducedMotion ? 0 : speed, maxPixelCount, fit };
}
