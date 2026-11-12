import { useSyncExternalStore } from "react";
import { PRISM_FOLD_MAX_COLORS, type PrismFoldParams } from "@/components/shaders/prism-fold-uniforms";
import { SHADER_SPECS, type SliderSpec } from "@/data/shader-specs";
import { PALETTE } from "./ds-tokens";
import { hexOf } from "./oklch";

// The overlay's ground (prism-fold.tsx); one saved in this browser wins over the defaults, which production draws.

export type PrismGround = PrismFoldParams & {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  speed: number;
};

/** The playground's sliders for Prism Fold, in its order; the ranges `mergeGround` keeps values in. */
export const GROUND_SLIDERS = SHADER_SPECS.prismFold.controls.filter((c): c is SliderSpec => c.kind === "slider");

const sw = (ramp: string, step: string) =>
  hexOf(PALETTE.find((r) => r.name === ramp)!.steps.find(([s]) => s === step)![1]);

// Still, as the ground is drawn once unless Speed is raised.
export const PRISM_GROUND: PrismGround = {
  colors: ["#B9CFFEFF", "#9AB6F9FF", sw("Blue Ribbon", "300"), sw("Blue Ribbon", "200"), "#4168D8FF", sw("Blue Ribbon", "400")],
  colorSeam: "#FFFFFFFF",
  folds: 2,
  fan: 60,
  curve: 0.4,
  lift: 0.6,
  softness: 0.1,
  spread: 0.8,
  warp: 0.2,
  sheen: 0.8,
  sheenWidth: 0.4,
  seam: 0.8,
  seamWidth: 2,
  seamFalloff: 0.1,
  dispersion: 0.5,
  grain: 0,
  scale: 1.01,
  rotation: 15,
  offsetX: 0.1,
  offsetY: -0.2,
  speed: 0,
};

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const isHex = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

/** `base` with whatever valid values `values` holds, numbers kept within their sliders; null if it holds none. */
export function mergeGround(base: PrismGround, values: unknown): PrismGround | null {
  if (typeof values !== "object" || values === null || Array.isArray(values)) return null;
  const given = values as Record<string, unknown>;
  const next: PrismGround = { ...base, colors: [...base.colors] };
  let found = false;

  for (const { key, min, max } of GROUND_SLIDERS) {
    const value = given[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    (next as unknown as Record<string, number>)[key] = Math.min(max, Math.max(min, value));
    found = true;
  }
  const { colors, colorSeam } = given;
  if (Array.isArray(colors) && colors.length > 0 && colors.length <= PRISM_FOLD_MAX_COLORS && colors.every(isHex)) {
    next.colors = [...colors];
    found = true;
  }
  if (isHex(colorSeam)) {
    next.colorSeam = colorSeam;
    found = true;
  }
  return found ? next : null;
}

const STORE = "spotwork-overlay-ground";
const listeners = new Set<() => void>();
let current: PrismGround | undefined;

function load(): PrismGround {
  try {
    return mergeGround(PRISM_GROUND, JSON.parse(localStorage.getItem(STORE) ?? "null")) ?? PRISM_GROUND;
  } catch {
    return PRISM_GROUND;
  }
}

function save(next: PrismGround) {
  current = next;
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {}
  for (const listener of listeners) listener();
}

/** The ground kept in this browser, and its setter; the server's markup has the defaults. */
export function usePrismGround() {
  const ground = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    () => (current ??= load()),
    () => PRISM_GROUND,
  );
  return [ground, save] as const;
}
