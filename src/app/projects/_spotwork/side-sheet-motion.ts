import { useEffect, useSyncExternalStore } from "react";
import type { Curve } from "./fade";

// How side sheets come and go; one saved in this browser wins over the defaults. Its CSS variables go on the
// document's root, and the side sheet's and its scrim's styles fall back to these defaults without them.

/** One way, in or out: where it starts or ends (in `unit`), its opacity and scale there, and its timing (ms). */
export interface Way {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  duration: number;
  delay: number;
  easing: Curve;
}

export interface SideSheetMotion {
  /** px, or % of the sheet's own size. */
  unit: "px" | "%";
  /** What it scales round. */
  origin: "center" | "end";
  enter: Way;
  /** `mirror` leaves the way it came, by the entrance's place, opacity and scale. */
  exit: Way & { mirror: boolean };
  /** A large sheet's scrim: its fades' lengths and its wait before fading in (ms). */
  scrim: { enter: number; exit: number; delay: number };
}

export const SIDE_SHEET_MOTION: SideSheetMotion = {
  unit: "px",
  origin: "end",
  enter: { x: 120, y: 0, opacity: 0, scale: 1, duration: 250, delay: 0, easing: [0.08, 0.59, 0.4, 1] },
  exit: { mirror: true, x: 24, y: 0, opacity: 0, scale: 1, duration: 250, delay: 0, easing: [0.6, 0, 0.92, 0.4] },
  scrim: { enter: 250, exit: 250, delay: 0 },
};

export type Range = { min: number; max: number; step: number };

export const WAY_RANGE: Record<Exclude<keyof Way, "easing">, Range> = {
  x: { min: -1300, max: 1300, step: 1 },
  y: { min: -1300, max: 1300, step: 1 },
  opacity: { min: 0, max: 1, step: 0.05 },
  scale: { min: 0.5, max: 1.5, step: 0.01 },
  duration: { min: 0, max: 2000, step: 10 },
  delay: { min: 0, max: 1000, step: 10 },
};

export const SCRIM_RANGE: Record<keyof SideSheetMotion["scrim"], Range> = {
  enter: { min: 0, max: 2000, step: 10 },
  exit: { min: 0, max: 2000, step: 10 },
  delay: { min: 0, max: 1000, step: 10 },
};

const bezier = ([x1, y1, x2, y2]: Curve) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

/** The CSS variables the side sheet and its scrim read. */
export function motionVars({ unit, origin, enter, exit, scrim }: SideSheetMotion): Record<`--${string}`, string> {
  const out = exit.mirror ? { ...exit, x: enter.x, y: enter.y, opacity: enter.opacity, scale: enter.scale } : exit;
  return {
    "--side-sheet-origin": origin === "end" ? "100% 50%" : "center",
    "--side-sheet-in-from": `${enter.x}${unit} ${enter.y}${unit}`,
    "--side-sheet-in-opacity": `${enter.opacity}`,
    "--side-sheet-in-scale": `${enter.scale}`,
    "--side-sheet-in-duration": `${enter.duration}ms`,
    "--side-sheet-in-delay": `${enter.delay}ms`,
    "--side-sheet-in-easing": bezier(enter.easing),
    "--side-sheet-out-to": `${out.x}${unit} ${out.y}${unit}`,
    "--side-sheet-out-opacity": `${out.opacity}`,
    "--side-sheet-out-scale": `${out.scale}`,
    "--side-sheet-out-duration": `${out.duration}ms`,
    "--side-sheet-out-delay": `${out.delay}ms`,
    "--side-sheet-out-easing": bezier(out.easing),
    "--side-sheet-scrim-in": `${scrim.enter}ms`,
    "--side-sheet-scrim-out": `${scrim.exit}ms`,
    "--side-sheet-scrim-delay": `${scrim.delay}ms`,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clamp = (value: number, { min, max }: Range) => Math.min(max, Math.max(min, value));

// A handle's time stays within 0 to 1, or CSS drops the curve; its value may overshoot.
const isCurve = (value: unknown): value is Curve =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
  value[0] >= 0 &&
  value[0] <= 1 &&
  value[2] >= 0 &&
  value[2] <= 1;

/** `values` over `base`, each kept within its range; null when `values` holds none. */
export function mergeMotion(base: SideSheetMotion, values: unknown): SideSheetMotion | null {
  if (!isRecord(values)) return null;
  const next: SideSheetMotion = { ...base, enter: { ...base.enter }, exit: { ...base.exit }, scrim: { ...base.scrim } };
  let found = false;
  if (values.unit === "px" || values.unit === "%") [next.unit, found] = [values.unit, true];
  if (values.origin === "center" || values.origin === "end") [next.origin, found] = [values.origin, true];
  const numbers = (given: unknown, into: Record<string, unknown>, ranges: Record<string, Range>) => {
    if (!isRecord(given)) return;
    for (const [key, range] of Object.entries(ranges)) {
      const value = given[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      into[key] = clamp(value, range);
      found = true;
    }
    if ("easing" in into && isCurve(given.easing)) [into.easing, found] = [[...given.easing], true];
  };
  numbers(values.enter, next.enter as unknown as Record<string, unknown>, WAY_RANGE);
  numbers(values.exit, next.exit as unknown as Record<string, unknown>, WAY_RANGE);
  numbers(values.scrim, next.scrim as unknown as Record<string, unknown>, SCRIM_RANGE);
  if (isRecord(values.exit) && typeof values.exit.mirror === "boolean") [next.exit.mirror, found] = [values.exit.mirror, true];
  return found ? next : null;
}

const STORE = "check-ins-side-sheet-motion";
const listeners = new Set<() => void>();
let current: SideSheetMotion | undefined;

function load(): SideSheetMotion {
  try {
    return mergeMotion(SIDE_SHEET_MOTION, JSON.parse(localStorage.getItem(STORE) ?? "null")) ?? SIDE_SHEET_MOTION;
  } catch {
    return SIDE_SHEET_MOTION;
  }
}

function save(next: SideSheetMotion) {
  current = next;
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {}
  for (const listener of listeners) listener();
}

/** The motion kept in this browser, and its setter; the server's markup has the defaults. */
export function useSideSheetMotion() {
  const motion = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    () => (current ??= load()),
    () => SIDE_SHEET_MOTION,
  );
  return [motion, save] as const;
}

/** Puts the kept motion's variables on the document's root, where every side sheet, portaled or not, inherits them. */
export function useApplySideSheetMotion() {
  const [motion] = useSideSheetMotion();
  useEffect(() => {
    const root = document.documentElement;
    const vars = motionVars(motion);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [motion]);
}
