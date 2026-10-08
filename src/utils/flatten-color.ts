export type Rgba = readonly [number, number, number, number];

/** `top` painted over an opaque `bottom` at `share` of its own alpha, as `rgb()`: shaders read no alpha. */
export function flattenColor([r, g, b, a]: Rgba, [br, bg, bb]: Rgba, share: number): string {
  const k = a * share;
  const mix = (top: number, under: number) => Math.round(under + (top - under) * k);
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}
