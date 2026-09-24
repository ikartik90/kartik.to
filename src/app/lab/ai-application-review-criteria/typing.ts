// ---------------------------------------------------------------------------
// How long a typist takes over each character of a criterion that is typed in.
//
// Deterministic, so the same text always types the same way (and the tests can
// say how long it takes); uneven, because an even beat reads as a machine. A
// word takes a moment to start, and a comma or full stop a longer one.
// ---------------------------------------------------------------------------

const BASE_MS = 30;

/** Added to the base in turn, character by character. Never below -BASE_MS. */
const RHYTHM_MS = [0, 14, -8, 22, -4, 10, -12, 26];

const WORD_START_MS = 28;
const AFTER_PUNCTUATION_MS = 150;

/** The breath between finishing one field and starting the next. */
export const BETWEEN_FIELDS_MS = 400;

/** The wait before each character of `text` appears, in milliseconds. */
export function keystrokeDelays(text: string): number[] {
  const chars = [...text];
  return chars.map((_, i) => {
    const previous = chars[i - 1] ?? "";
    let ms = BASE_MS + RHYTHM_MS[i % RHYTHM_MS.length];
    if (/[,.;:]/.test(previous)) ms += AFTER_PUNCTUATION_MS;
    else if (previous === " ") ms += WORD_START_MS;
    return ms;
  });
}
