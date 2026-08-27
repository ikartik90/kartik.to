// ---------------------------------------------------------------------------
// Colour value algebra
//
// The two representations a colour field constantly converts between — what the
// author types (six hex digits, and a 0–100 opacity) and what a shader is
// handed (one `#RRGGBBAA` string) — kept pure and out of the component because
// this is the only part of a colour field with anything to get wrong.
//
// The `#` is NOT part of the typed value. It is punctuation the field draws for
// you, so a pasted `#FFAB6F` and a typed `FFAB6F` have to mean the same thing —
// hence sanitizing strips it wherever it lands rather than only in front.
// ---------------------------------------------------------------------------

/** Digits an authored hex carries — `RRGGBB`, no alpha and no `#`. */
const HEX_DIGITS = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * What the hex field should hold for a given keystroke: hex digits only,
 * uppercased, capped at six.
 *
 * Deliberately permits an INCOMPLETE value. The field is sanitized on every
 * keystroke, and a version that only accepted six digits would reject the first
 * five and make the input untypable.
 */
export function sanitizeHex(input: string): string {
  return input
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
    .slice(0, HEX_DIGITS);
}

/** A whole percentage inside 0–100. Non-numbers read as fully opaque. */
export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.round(clamp(value, 0, 100));
}

/**
 * The single string the shader is given: the hex and the opacity combined into
 * `#RRGGBBAA`.
 *
 * A short hex is zero-padded rather than rejected — this runs on every
 * keystroke, so a half-typed colour must still produce something a shader can
 * parse. The preview simply walks towards the colour as you type.
 */
export function formatColor(hex: string, opacity: number): string {
  const digits = sanitizeHex(hex).padEnd(HEX_DIGITS, "0");
  const alpha = Math.round((clampOpacity(opacity) / 100) * 255);
  return `#${digits}${alpha.toString(16).toUpperCase().padStart(2, "0")}`;
}

/**
 * The inverse: the stored colour split back into the two fields that edit it.
 *
 * Accepts a 6-digit value as fully opaque, so a colour written by hand (a
 * default, a fixture) doesn't have to spell out `FF`. Anything unreadable falls
 * back to opaque black rather than throwing — a malformed colour in a stored
 * document should render a wrong swatch you can see and fix, not break the
 * panel that edits it.
 */
export function parseColor(value: string): { hex: string; opacity: number } {
  const digits = value.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (digits.length === HEX_DIGITS) return { hex: digits, opacity: 100 };
  if (digits.length === HEX_DIGITS + 2) {
    return {
      hex: digits.slice(0, HEX_DIGITS),
      opacity: clampOpacity((parseInt(digits.slice(HEX_DIGITS), 16) / 255) * 100),
    };
  }
  return { hex: "000000", opacity: 100 };
}

// ---------------------------------------------------------------------------
// Colour spaces
//
// The picker offers three ways to write the SAME colour — six hex digits, three
// 0–255 channels, or a hue/saturation/brightness triple — and draws itself in
// the third: the map is an (s, b) plane at a fixed hue and the slider under it
// is the hue. Hex and RGB are one representation written two ways; HSB is a
// genuine change of coordinates, and the only one with anything to get wrong.
//
// Everything here rounds to whole numbers on the way out, because every one of
// these values is something the author can type. A field that showed 171.4 for
// a channel it will only accept 171 in would be lying about its own contents.
// ---------------------------------------------------------------------------

/** Red, green and blue as whole 0–255 channels. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Hue in whole degrees (0–360), saturation and brightness as 0–100. */
export interface Hsb {
  h: number;
  s: number;
  b: number;
}

/** How the colour is written in the input row — the format menu's three options. */
export type ColorFormat = "hex" | "rgb" | "hsb";

/** A whole channel inside 0–255. */
export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 255));
}

/**
 * Six hex digits split into three channels.
 *
 * Zero-pads a short value rather than rejecting it, for the same reason
 * `formatColor` does: this runs on every keystroke, and a half-typed colour
 * still has to resolve to something the map and the sliders can be placed at.
 */
export function hexToRgb(hex: string): Rgb {
  const digits = sanitizeHex(hex).padEnd(HEX_DIGITS, "0");
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

/** The inverse: three channels as six uppercase digits, with no `#`. */
export function rgbToHex({ r, g, b }: Rgb): string {
  return [r, g, b]
    .map((channel) =>
      clampChannel(channel).toString(16).toUpperCase().padStart(2, "0"),
    )
    .join("");
}

/**
 * RGB read as coordinates on the hue wheel.
 *
 * Brightness is the largest channel and saturation is how far the smallest
 * falls below it, so a grey — every channel equal — has no saturation and, with
 * it, no hue to speak of. That is why this returns 0° for one: it is not a
 * measurement, it is the absence of one, and the picker must NOT let the value
 * round-trip through here while the author is on the map (see `color-picker`,
 * which holds the hue itself for exactly this reason).
 */
export function rgbToHsb({ r, g, b }: Rgb): Hsb {
  const red = clampChannel(r) / 255;
  const green = clampChannel(g) / 255;
  const blue = clampChannel(b) / 255;

  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);

  // The wheel in sixths: which channel is largest picks the sector, and the
  // difference of the other two places the colour inside it.
  const sector =
    chroma === 0
      ? 0
      : max === red
        ? ((green - blue) / chroma + 6) % 6
        : max === green
          ? (blue - red) / chroma + 2
          : (red - green) / chroma + 4;

  return {
    h: Math.round(sector * 60) % 360,
    s: Math.round((max === 0 ? 0 : chroma / max) * 100),
    b: Math.round(max * 100),
  };
}

/** The inverse: a point on the wheel as three channels. */
export function hsbToRgb({ h, s, b }: Hsb): Rgb {
  // A hue is an angle, so a full turn is no turn — the slider's own max (360)
  // and its min are the same red, and neither is out of range.
  const hue = (((Number.isFinite(h) ? h : 0) % 360) + 360) % 360;
  const saturation = clamp(Number.isFinite(s) ? s : 0, 0, 100) / 100;
  const brightness = clamp(Number.isFinite(b) ? b : 0, 0, 100) / 100;

  // The standard triangle: `chroma` is the span between the largest and
  // smallest channel, `second` walks it across each sixth, and `floor` lifts
  // the whole triple to the requested brightness.
  const chroma = brightness * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const floor = brightness - chroma;

  const sector = Math.floor(hue / 60) % 6;
  const [red, green, blue] = (
    [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ] as const
  )[sector];

  return {
    r: Math.round((red + floor) * 255),
    g: Math.round((green + floor) * 255),
    b: Math.round((blue + floor) * 255),
  };
}
