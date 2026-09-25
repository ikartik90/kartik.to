// A CSS ramp, not the real shader: each paper-shaders mount holds its own WebGL context, and browsers cap them (~16).

/** Flat colours: the caller resolves the theme pair (`paletteFor`). */
export interface ShaderPresetSwatchSource {
  colors: string[];
  colorBack?: string;
}

/** A `background` shorthand; the ground goes last, the only layer a colour may sit in. */
export function shaderPresetSwatch({ colors, colorBack }: ShaderPresetSwatchSource): string {
  // An empty `linear-gradient()` would invalidate the whole declaration.
  if (colors.length === 0) return colorBack ?? "transparent";

  // A one-stop gradient is invalid CSS, so a single colour is stated twice.
  const stops = colors.length === 1 ? [colors[0], colors[0]] : colors;
  const ramp = `linear-gradient(135deg, ${stops.join(", ")})`;

  return colorBack ? `${ramp}, ${colorBack}` : ramp;
}
