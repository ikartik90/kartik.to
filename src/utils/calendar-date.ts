import { Temporal } from "@js-temporal/polyfill";

// ---------------------------------------------------------------------------
// The string ↔ Temporal.PlainDate edge of the date field, on Temporal (never
// JS `Date`). One pattern — `DD`, `MM` and `YYYY` in any order, with whatever
// separators you like between them — drives BOTH directions, so a field can
// never format one way and parse another.
//
//   const parse  = parseCalendarDate("MM/DD/YYYY");
//   const format = formatCalendarDate("MM/DD/YYYY");
//   parse("12/11/2026")   // → PlainDate 2026-12-11
//   format(someDate)      // → "12/11/2026"
//
// Both are factories: the pattern is validated once, up front, and the returned
// function is a plain (input → output) that a component can hold in a `useMemo`.
// Parsing is deliberately forgiving about SHAPE (any separator, unpadded parts,
// no separators at all) and strict about MEANING — an impossible date is `null`,
// never a rolled-over one, so `31/11` can't silently become December 1st.
// ---------------------------------------------------------------------------

/** DD/MM/YYYY — the design's format (Figma 563:1253 "11/12/2026"). */
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

const TOKEN_WIDTH = { DD: 2, MM: 2, YYYY: 4 } as const;

type Token = keyof typeof TOKEN_WIDTH;

/**
 * The pattern's tokens in the order they appear. A pattern missing a token (or
 * repeating one) is a developer error, not bad user input, so it throws at
 * factory time rather than failing per-keystroke later.
 */
function tokensOf(format: string): Token[] {
  const tokens = (format.match(/YYYY|MM|DD/g) ?? []) as Token[];
  if (tokens.length !== 3 || new Set(tokens).size !== 3) {
    throw new Error(
      `Invalid date format "${format}" — expected exactly one each of DD, MM and YYYY.`,
    );
  }
  return tokens;
}

/**
 * Build a parser for `format`. Returns the date, or `null` for anything that
 * isn't yet (or ever) a real date — so it's safe to call on every keystroke.
 */
export function parseCalendarDate(
  format: string,
): (input: string) => Temporal.PlainDate | null {
  const tokens = tokensOf(format);
  const packedWidth = tokens.reduce((sum, t) => sum + TOKEN_WIDTH[t], 0);

  return (input) => {
    // Split on runs of anything non-numeric, so `/`, `-`, `.` and spaces all
    // work without the pattern having to declare which one it expects.
    const groups = input.trim().split(/\D+/).filter(Boolean);

    let parts: string[];
    if (groups.length === 3) {
      parts = groups;
    } else if (groups.length === 1 && groups[0].length === packedWidth) {
      // No separators at all — slice the run at the pattern's token widths.
      let at = 0;
      parts = tokens.map((token) => {
        const part = groups[0].slice(at, at + TOKEN_WIDTH[token]);
        at += TOKEN_WIDTH[token];
        return part;
      });
    } else {
      return null;
    }

    const value = {} as Record<Token, number>;
    for (const [i, token] of tokens.entries()) {
      const part = parts[i];
      const width = TOKEN_WIDTH[token];
      // Day/month may be unpadded; a year must be given in full, so a 2-digit
      // year reads as incomplete rather than as the year 26 AD.
      const shortYear = token === "YYYY" && part.length !== width;
      if (shortYear || part.length > width) return null;
      value[token] = Number(part);
    }

    try {
      // `reject` is what makes 31/11 and 29/02/2027 fail instead of rolling
      // forward into the next month.
      return Temporal.PlainDate.from(
        { year: value.YYYY, month: value.MM, day: value.DD },
        { overflow: "reject" },
      );
    } catch {
      return null;
    }
  };
}

/** Build a formatter for `format` — the exact inverse of `parseCalendarDate`. */
export function formatCalendarDate(
  format: string,
): (date: Temporal.PlainDate) => string {
  tokensOf(format); // validate the pattern once, not per call
  return (date) =>
    format.replace(/YYYY|MM|DD/g, (token) => {
      const part =
        token === "YYYY" ? date.year : token === "MM" ? date.month : date.day;
      return String(part).padStart(TOKEN_WIDTH[token as Token], "0");
    });
}
