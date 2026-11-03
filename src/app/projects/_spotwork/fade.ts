import { cubicBezier } from "@/utils/eased-fade";

export type Curve = [number, number, number, number];
/** A fade: `start` and `length` in px, eased by `amount` (0 linear, 1 `curve`). */
export type Fade = { start: number; length: number; amount: number; curve: Curve };

export function eased({ amount, curve }: Pick<Fade, "amount" | "curve">) {
  const ease = cubicBezier(...curve);
  return (t: number) => Math.min(1, Math.max(0, t + (ease(t) - t) * amount));
}

// From `from` px down, its lengths at the drawing's scale `k`; 65 stops, so the ramp shows no edge.
export const fadeBelow = (from: number, fade: Fade, k: number) => {
  const alpha = eased(fade);
  return `linear-gradient(to bottom, ${Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    return `rgb(0 0 0 / ${alpha(t).toFixed(4)}) ${(from + (fade.start + fade.length * t) * k).toFixed(1)}px`;
  }).join(", ")})`;
};
