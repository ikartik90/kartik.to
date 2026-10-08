/** `cubic-bezier()` as a function of progress, clamped to its ends. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number) => (t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const x = curve(x1, x2);
  const y = curve(y1, y2);
  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const t = (lo + hi) / 2;
      if (x(t) < progress) lo = t;
      else hi = t;
    }
    return y((lo + hi) / 2);
  };
}

// Two stops draw a visible line where the ramp starts; 26 on this curve show none.
const STOPS = 26;
const ease = cubicBezier(0.63, 0, 0.48, 1);

/** A top-to-bottom mask: whole down to `from`%, then fading out to clear at the foot. */
export function easedFadeOut(from: number): string {
  const ramp = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    return `rgb(0 0 0 / ${Number((1 - ease(t)).toFixed(3))}) ${Number((from + (100 - from) * t).toFixed(1))}%`;
  });
  return `linear-gradient(to bottom, ${ramp.join(", ")})`;
}
