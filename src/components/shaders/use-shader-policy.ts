"use client";

import { useSyncExternalStore } from "react";
import type { ShaderFit } from "@paper-design/shaders";

/**
 * Render-buffer ceiling in device pixels. The real cost is WebGL contexts: none are pooled or
 * restored, so past the browser's cap (~16 in Chrome) the oldest canvas goes blank for good.
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

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
}

export interface ShaderPolicyInput {
  /** Overridden to 0 under reduced motion. */
  speed?: number;
  maxPixelCount?: number;
  fit?: ShaderFit;
}

export interface ShaderPolicy {
  speed: number;
  maxPixelCount: number;
  fit: ShaderFit;
}

export function useShaderPolicy({
  speed = 0,
  maxPixelCount = SHADER_MAX_PIXELS,
  fit = "cover",
}: ShaderPolicyInput = {}): ShaderPolicy {
  const reducedMotion = useReducedMotion();
  return { speed: reducedMotion ? 0 : speed, maxPixelCount, fit };
}
