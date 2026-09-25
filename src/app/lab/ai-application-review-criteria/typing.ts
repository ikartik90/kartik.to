const BASE_MS = 30;

/** Cycled per character; every entry must stay above -BASE_MS. */
const RHYTHM_MS = [0, 14, -8, 22, -4, 10, -12, 26];

const WORD_START_MS = 28;
const AFTER_PUNCTUATION_MS = 150;

export const BETWEEN_FIELDS_MS = 400;

/** Milliseconds to wait before each character of `text` appears. */
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
