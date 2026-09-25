import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

const TOKEN_WIDTH = { DD: 2, MM: 2, YYYY: 4 } as const;

type Token = keyof typeof TOKEN_WIDTH;

function tokensOf(format: string): Token[] {
  const tokens = (format.match(/YYYY|MM|DD/g) ?? []) as Token[];
  if (tokens.length !== 3 || new Set(tokens).size !== 3) {
    throw new Error(
      `Invalid date format "${format}" — expected exactly one each of DD, MM and YYYY.`,
    );
  }
  return tokens;
}

export function parseCalendarDate(
  format: string,
): (input: string) => Temporal.PlainDate | null {
  const tokens = tokensOf(format);
  const packedWidth = tokens.reduce((sum, t) => sum + TOKEN_WIDTH[t], 0);

  return (input) => {
    const groups = input.trim().split(/\D+/).filter(Boolean);

    let parts: string[];
    if (groups.length === 3) {
      parts = groups;
    } else if (groups.length === 1 && groups[0].length === packedWidth) {
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
      // A 2-digit year is incomplete, not 26 AD.
      const shortYear = token === "YYYY" && part.length !== width;
      if (shortYear || part.length > width) return null;
      value[token] = Number(part);
    }

    try {
      // `reject` makes 31/11 fail instead of rolling into the next month.
      return Temporal.PlainDate.from(
        { year: value.YYYY, month: value.MM, day: value.DD },
        { overflow: "reject" },
      );
    } catch {
      return null;
    }
  };
}

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
