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
