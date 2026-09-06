import { Temporal } from "@js-temporal/polyfill";

// ---------------------------------------------------------------------------
// The clock edge of the time field, on Temporal (never JS `Date`) — the
// `calendar-date` of times, and deliberately its smaller sibling.
//
// It does three things:
//
//   • FORMATS a PlainTime through a pattern (`h:mm A` → "12:00 AM"), the same
//     factory shape as `formatCalendarDate`: the pattern is validated once, up
//     front, and the returned function is a plain (input → output) a component
//     can hold in a `useMemo`.
//   • GENERATES the day's selectable slots at a step, either from midnight (a
//     plain time field) or running forward from an ANCHOR — a start time, so an
//     end-time field lists what can follow it, in order, across midnight.
//   • NAMES the distance from that anchor ("+8 hours"), which is what makes an
//     anchored list readable as a duration rather than as a second clock.
//   • MATCHES a type-ahead query against one of those strings, on clock rules
//     rather than the option list's substring ones.
//
// There is no PARSER here on purpose. The date field needs one because a
// calendar cannot list every date, so its search has to interpret what you
// typed; a day holds 48 half-hours, so the time field lists them all and its
// search only has to pick from strings the formatter already wrote. One clock
// format, one set of strings, one thing to match against.
// ---------------------------------------------------------------------------

/** h:mm AM/PM — the design's clock (Figma 1204:9823 "12:00 AM"). */
export const DEFAULT_TIME_FORMAT = "h:mm A";

const MINUTES_PER_DAY = 1440;

/**
 * The pattern's tokens, longest-first so `hh` is claimed before `h`. `H`/`HH`
 * are the 24-hour hour, `h`/`hh` the 12-hour one, `A`/`a` the meridiem.
 */
const TOKEN = /HH|hh|mm|H|h|A|a/g;

/**
 * Validate a pattern. A malformed one is a developer error, not bad user input,
 * so it throws at factory time rather than writing a wrong string onto every
 * row of the list.
 */
function assertFormat(format: string): void {
  const tokens = format.match(TOKEN) ?? [];
  const count = (token: string) => tokens.filter((t) => t === token).length;

  const hour12 = count("h") + count("hh");
  const hour24 = count("H") + count("HH");
  if (hour12 + hour24 !== 1) {
    throw new Error(
      `Invalid time format "${format}" — expected exactly one hour token (h, hh, H or HH).`,
    );
  }
  if (count("mm") !== 1) {
    throw new Error(
      `Invalid time format "${format}" — expected exactly one mm.`,
    );
  }

  const meridiem = count("A") + count("a");
  // The two halves of a clock have to agree: a 12-hour hour with no meridiem
  // cannot say which noon it means, and a meridiem on a 24-hour clock is a
  // contradiction rather than a decoration.
  if (hour12 === 1 && meridiem !== 1) {
    throw new Error(
      `Invalid time format "${format}" — a 12-hour clock needs exactly one meridiem token (A or a).`,
    );
  }
  if (hour24 === 1 && meridiem !== 0) {
    throw new Error(
      `Invalid time format "${format}" — a 24-hour clock takes no meridiem token.`,
    );
  }
}

/**
 * Build a formatter for `format` — `h`/`hh` (12-hour, unpadded/padded),
 * `H`/`HH` (24-hour), `mm`, and `A`/`a` (AM/PM, upper/lower). Everything else in
 * the pattern is a literal, so the separator is yours to choose.
 */
export function formatClockTime(
  format: string,
): (time: Temporal.PlainTime) => string {
  assertFormat(format); // validate once, not per call

  return (time) =>
    format.replace(TOKEN, (token) => {
      // Midnight and noon are 12 on a 12-hour clock, not 0.
      const twelve = time.hour % 12 === 0 ? 12 : time.hour % 12;
      switch (token) {
        case "h":
          return String(twelve);
        case "hh":
          return String(twelve).padStart(2, "0");
        case "H":
          return String(time.hour);
        case "HH":
          return String(time.hour).padStart(2, "0");
        case "mm":
          return String(time.minute).padStart(2, "0");
        case "A":
          return time.hour < 12 ? "AM" : "PM";
        default:
          return time.hour < 12 ? "am" : "pm";
      }
    });
}

/**
 * Name a span in the design's own units: decimal HOURS once there is at least
 * one ("+8 hours", "+8.5 hours"), minutes below that ("+30 mins"), where a
 * decimal hour would read as noise rather than as a duration. Trailing zeros
 * are trimmed, so a whole hour never shows as "+8.00".
 */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) {
    return `+${minutes} ${minutes === 1 ? "min" : "mins"}`;
  }
  // Two decimals covers every step that divides an hour and reads as a number
  // (a quarter is .25); `Number` then drops the zeros a whole hour leaves.
  const hours = Number((minutes / 60).toFixed(2));
  return `+${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export interface TimeSlot {
  /** The selectable time. */
  time: Temporal.PlainTime;
  /**
   * Minutes since the anchor, or `null` when the list is unanchored and there
   * is nothing to measure from. Runs from one `step` up to a full day, so the
   * final slot of an anchored list is the anchor itself, 24 hours on.
   */
  elapsed: number | null;
  /**
   * Whether the slot falls on the day AFTER the anchor. Always false when
   * unanchored — a plain day list starts at midnight and never crosses one.
   */
  nextDay: boolean;
}

export interface TimeSlotOptions {
  /** Grid in minutes — 30 draws the design's half-hours. */
  step: number;
  /**
   * Start the list one step AFTER this time and run it forward for a full day,
   * wrapping past midnight — an end-time field listing what can follow its
   * start. Omit for the plain midnight-to-midnight list.
   */
  from?: Temporal.PlainTime | null;
}

/**
 * The day's selectable times at `step`, in the order they should be listed.
 *
 * Unanchored, that is midnight through to one step short of the next — the
 * ordinary time field. Anchored, it is the same set ROTATED to begin one step
 * after the anchor, each slot carrying how far it is from it and whether it has
 * crossed into the next day. Same count either way: a day is a day.
 */
export function timeSlots({ step, from }: TimeSlotOptions): TimeSlot[] {
  if (!Number.isInteger(step) || step <= 0 || step > MINUTES_PER_DAY) {
    throw new Error(
      `Invalid time step "${step}" — expected a whole number of minutes between 1 and ${MINUTES_PER_DAY}.`,
    );
  }

  const count = Math.floor(MINUTES_PER_DAY / step);
  const anchor = from ? from.hour * 60 + from.minute : 0;
  const midnight = Temporal.PlainTime.from("00:00");

  return Array.from({ length: count }, (_, i) => {
    // Unanchored the list simply starts AT midnight; anchored it starts one
    // step past the anchor, so the anchor itself lands at the far end as the
    // full-day option rather than as a no-op first row.
    const elapsed = from ? (i + 1) * step : i * step;
    const total = anchor + elapsed;
    return {
      time: midnight.add({ minutes: total % MINUTES_PER_DAY }),
      elapsed: from ? elapsed : null,
      nextDay: Boolean(from) && total >= MINUTES_PER_DAY,
    };
  });
}

/**
 * Whether a clock string answers a type-ahead query — the time field's matcher,
 * in place of the option list's default substring one.
 *
 * The difference is the whole reason it exists: a substring match makes "2:30"
 * hit "12:30 AM" as well as "2:30 AM", so typing an exact time and pressing
 * Enter can commit a different one ten hours away. In a clock the leading digit
 * is not incidental text, it is part of the number, so a match must begin at a
 * BOUNDARY — the start of the string, or immediately after something that is
 * not a letter or digit. That still leaves every part of the clock searchable
 * on its own ("30" finds the half hours, "pm" the afternoon), because the colon
 * and the space are boundaries too.
 */
export function matchesClockQuery(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = label.toLowerCase();

  for (let at = haystack.indexOf(needle); at !== -1; ) {
    if (at === 0 || !/[a-z0-9]/.test(haystack[at - 1])) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}
