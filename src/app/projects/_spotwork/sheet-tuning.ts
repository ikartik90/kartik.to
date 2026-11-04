import { useSyncExternalStore } from "react";
import { css } from "../../../../styled-system/css";
import { eased, type Curve } from "./fade";

// The About sheet's look; one saved in this browser wins over the defaults. The defaults are the tuned
// look: three layers whole behind the cards' column, each ramping in over a short edge to its left, and
// `bg.surfaceGlass` cards (the surface at 75%, frosted by md) with lg corners, xxl padding and lg gaps.

export const LAYERS = ["outer", "middle", "inner"] as const;
export type Layer = (typeof LAYERS)[number];

/**
 * A blur layer: its backdrop's blur (px), saturation and brightness (%); how far it reaches in from the right edge (px)
 * and how much of that ramps up from clear at its left edge (%), the rest whole; the ramp's easing (0 linear, 100
 * `curve`, plotted clear to whole); its strength and its surface tint (%).
 */
export interface LayerTuning {
  blur: number;
  saturation: number;
  brightness: number;
  width: number;
  fade: number;
  easing: number;
  curve: Curve;
  opacity: number;
  tint: number;
}

export interface SheetTuning {
  outer: LayerTuning;
  middle: LayerTuning;
  inner: LayerTuning;
  /** The cards' surface (%), backdrop, corners, padding and gaps (px), and shadow (%, then its blur and drop in px). */
  cards: {
    opacity: number;
    blur: number;
    saturation: number;
    brightness: number;
    radius: number;
    padding: number;
    gap: number;
    shadow: number;
    shadowBlur: number;
    shadowY: number;
  };
  /** The cards' column: its width and the room around it (px). */
  column: { width: number; inset: number };
  /** How long the sheet takes to come and go (ms). */
  motion: { duration: number };
}

const LAYER = { saturation: 100, brightness: 100, easing: 100, curve: [0.24, 0.32, 0.36, 1] as Curve };

export const SHEET_TUNING: SheetTuning = {
  outer: { ...LAYER, blur: 8, width: 420, fade: 16, opacity: 72, tint: 0 },
  middle: { ...LAYER, blur: 16, width: 400, fade: 12, opacity: 80, tint: 4 },
  inner: { ...LAYER, blur: 24, width: 380, fade: 24, opacity: 100, tint: 8 },
  cards: {
    opacity: 75,
    blur: 8,
    saturation: 100,
    brightness: 100,
    radius: 12,
    padding: 20,
    gap: 12,
    shadow: 0,
    shadowBlur: 16,
    shadowY: 4,
  },
  column: { width: 400, inset: 32 },
  motion: { duration: 300 },
};

type Range = { min: number; max: number; step: number };
const PERCENT = { min: 0, max: 100, step: 1 };
const BLUR = { min: 0, max: 64, step: 1 };
const SATURATION = { min: 0, max: 300, step: 5 };
const BRIGHTNESS = { min: 0, max: 200, step: 5 };
const LAYER_RANGE: Record<Exclude<keyof LayerTuning, "curve">, Range> = {
  blur: BLUR,
  saturation: SATURATION,
  brightness: BRIGHTNESS,
  width: { min: 0, max: 1440, step: 10 },
  fade: PERCENT,
  easing: PERCENT,
  opacity: PERCENT,
  tint: PERCENT,
};

/** Each number's slider. */
export const TUNING_RANGE: { [S in keyof SheetTuning]: Partial<Record<keyof SheetTuning[S], Range>> } = {
  outer: LAYER_RANGE,
  middle: LAYER_RANGE,
  inner: LAYER_RANGE,
  cards: {
    opacity: PERCENT,
    blur: BLUR,
    saturation: SATURATION,
    brightness: BRIGHTNESS,
    radius: { min: 0, max: 40, step: 1 },
    padding: { min: 0, max: 64, step: 1 },
    gap: { min: 0, max: 64, step: 1 },
    shadow: PERCENT,
    shadowBlur: BLUR,
    shadowY: { min: 0, max: 32, step: 1 },
  },
  column: { width: { min: 240, max: 720, step: 10 }, inset: { min: 0, max: 64, step: 1 } },
  motion: { duration: { min: 0, max: 1000, step: 10 } },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCurve = (value: unknown): value is Curve =>
  Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number" && Number.isFinite(n));

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, value));

/** `base` with whatever values `values` holds, section by section, kept within their ranges; null if it holds none. */
export function mergeTuning(base: SheetTuning, values: unknown): SheetTuning | null {
  if (!isRecord(values)) return null;
  const next = Object.fromEntries(Object.entries(base).map(([section, held]) => [section, { ...held }])) as SheetTuning;
  let found = false;
  for (const section of Object.keys(TUNING_RANGE) as (keyof SheetTuning)[]) {
    const given = values[section];
    if (!isRecord(given)) continue;
    const into = next[section] as unknown as Record<string, unknown>;
    for (const [key, range] of Object.entries(TUNING_RANGE[section]) as [string, Range][]) {
      const value = given[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      into[key] = clamp(value, range);
      found = true;
    }
    // A handle's time stays across the curve; its value may overshoot.
    if ((LAYERS as readonly string[]).includes(section) && isCurve(given.curve)) {
      const [x1, y1, x2, y2] = given.curve;
      into.curve = [clamp(x1, { min: 0, max: 1 }), y1, clamp(x2, { min: 0, max: 1 }), y2];
      found = true;
    }
  }
  return found ? next : null;
}

// Two stops draw a visible line where a ramp starts; 26 show none.
const STOPS = 26;

/** A layer's mask, from the right edge: whole up to where its fade starts, then easing out to clear at its left edge. */
export function rampMask({ fade, easing, curve }: Pick<LayerTuning, "fade" | "easing" | "curve">): string {
  const strength = eased({ amount: easing / 100, curve });
  const stops = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    return `rgb(0 0 0 / ${Number(strength(1 - t).toFixed(3))}) ${Number((100 - fade + fade * t).toFixed(1))}%`;
  });
  return `linear-gradient(to left, ${stops.join(", ")})`;
}

/**
 * A layer's mask turned a quarter clockwise, for a sheet under the window: easing in from clear at its top edge over
 * the length its fade takes of its width, then whole however tall the layer grows.
 */
export function turnedMask({ width, fade, easing, curve }: Pick<LayerTuning, "width" | "fade" | "easing" | "curve">) {
  const strength = eased({ amount: easing / 100, curve });
  const ramp = (width * fade) / 100;
  const stops = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    return `rgb(0 0 0 / ${Number(strength(t).toFixed(3))}) ${Number((ramp * t).toFixed(1))}px`;
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

/** A layer's mask for the scrim under the sheet's Close: whole down to a 4xl above its foot, then easing out to clear. */
export function footMask({ easing, curve }: Pick<LayerTuning, "easing" | "curve">): string {
  const strength = eased({ amount: easing / 100, curve });
  const stops = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    return `rgb(0 0 0 / ${Number(strength(1 - t).toFixed(3))}) calc(100% - var(--spacing-4xl) * ${Number((1 - t).toFixed(3))})`;
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

const backdrop = ({ blur, saturation, brightness }: { blur: number; saturation: number; brightness: number }) =>
  `blur(${blur}px) saturate(${saturation}%) brightness(${brightness}%)`;

const shade = (percent: number) => `color-mix(in srgb, var(--colors-neutral-900) ${percent}%, transparent)`;

/** The cards' CSS variables, which `cardGroundStyle`, `FROSTED` and the About sheet's cards read. */
export const cardVars = (cards: SheetTuning["cards"]): Record<`--${string}`, string> => ({
  "--sheet-card-opacity": `${cards.opacity}%`,
  "--sheet-card-filter": backdrop(cards),
  "--sheet-card-radius": `${cards.radius}px`,
  "--sheet-card-padding": `${cards.padding}px`,
  "--sheet-card-gap": `${cards.gap}px`,
  "--sheet-card-shadow": `0 ${cards.shadowY}px ${cards.shadowBlur}px ${shade(cards.shadow)}`,
});

// The project sheets' ground, under the About sheet's cards and the walk-through's comments.
export const cardGroundStyle = css({
  borderRadius: "var(--sheet-card-radius)",
  backgroundColor: "color-mix(in srgb, token(colors.bg.canvas) var(--sheet-card-opacity), transparent)",
  boxShadow: "var(--sheet-card-shadow)",
});

// Inline: css() rejects `backdrop-filter`, and Panda's utility emits only the -webkit- form.
export const FROSTED = { backdropFilter: "var(--sheet-card-filter)", WebkitBackdropFilter: "var(--sheet-card-filter)" };

/** The sheet's CSS variables, which its blur layers, cards, column and motion read. */
export function sheetVars(tuning: SheetTuning): Record<`--${string}`, string> {
  const { cards, column, motion } = tuning;
  return {
    ...Object.fromEntries(
      LAYERS.flatMap((layer) => {
        const t = tuning[layer];
        return [
          [`--sheet-${layer}-width`, `${t.width}px`],
          [`--sheet-${layer}-filter`, backdrop(t)],
          [`--sheet-${layer}-mask`, rampMask(t)],
          [`--sheet-${layer}-turned-mask`, turnedMask(t)],
          [`--sheet-${layer}-foot-mask`, footMask(t)],
          [`--sheet-${layer}-opacity`, `${t.opacity / 100}`],
          [`--sheet-${layer}-tint`, `${t.tint}%`],
        ];
      }),
    ),
    ...cardVars(cards),
    "--sheet-column-width": `${column.width}px`,
    "--sheet-column-inset": `${column.inset}px`,
    "--sheet-duration": `${motion.duration}ms`,
  };
}

/** The room the docked sheet takes beside the window (px): from its cards' left edge to the right edge. */
export const sheetRoom = ({ column }: SheetTuning) => column.width - column.inset;

const STORE = "check-ins-about-sheet";
const listeners = new Set<() => void>();
let current: SheetTuning | undefined;

function load(): SheetTuning {
  try {
    return mergeTuning(SHEET_TUNING, JSON.parse(localStorage.getItem(STORE) ?? "null")) ?? SHEET_TUNING;
  } catch {
    return SHEET_TUNING;
  }
}

function save(next: SheetTuning) {
  current = next;
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {}
  for (const listener of listeners) listener();
}

/** The tuning kept in this browser, and its setter; the server's markup has the defaults. */
export function useSheetTuning() {
  const tuning = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    () => (current ??= load()),
    () => SHEET_TUNING,
  );
  return [tuning, save] as const;
}
