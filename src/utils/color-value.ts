const HEX_DIGITS = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Hex digits only, uppercased, capped at six. Incomplete values pass: it runs per keystroke. */
export function sanitizeHex(input: string): string {
  return input
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase()
    .slice(0, HEX_DIGITS);
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.round(clamp(value, 0, 100));
}

/** `#RRGGBBAA`; a short hex is zero-padded, since it runs per keystroke. */
export function formatColor(hex: string, opacity: number): string {
  const digits = sanitizeHex(hex).padEnd(HEX_DIGITS, "0");
  const alpha = Math.round((clampOpacity(opacity) / 100) * 255);
  return `#${digits}${alpha.toString(16).toUpperCase().padStart(2, "0")}`;
}

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

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `h` in degrees (0–360); `s` and `b` as 0–100. */
export interface Hsb {
  h: number;
  s: number;
  b: number;
}

export type ColorFormat = "hex" | "rgb" | "hsb";

export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 255));
}

export function hexToRgb(hex: string): Rgb {
  const digits = sanitizeHex(hex).padEnd(HEX_DIGITS, "0");
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return [r, g, b]
    .map((channel) =>
      clampChannel(channel).toString(16).toUpperCase().padStart(2, "0"),
    )
    .join("");
}

/** A grey has no hue and reads as 0°, so the picker holds the hue itself while on the map. */
export function rgbToHsb({ r, g, b }: Rgb): Hsb {
  const red = clampChannel(r) / 255;
  const green = clampChannel(g) / 255;
  const blue = clampChannel(b) / 255;

  const max = Math.max(red, green, blue);
  const chroma = max - Math.min(red, green, blue);

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

export function hsbToRgb({ h, s, b }: Hsb): Rgb {
  const hue = (((Number.isFinite(h) ? h : 0) % 360) + 360) % 360;
  const saturation = clamp(Number.isFinite(s) ? s : 0, 0, 100) / 100;
  const brightness = clamp(Number.isFinite(b) ? b : 0, 0, 100) / 100;

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
