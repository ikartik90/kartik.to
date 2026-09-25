import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_TIME_FORMAT = "h:mm A";

const MINUTES_PER_DAY = 1440;

/** Longest-first, so `hh` is claimed before `h`. */
const TOKEN = /HH|hh|mm|H|h|A|a/g;

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

/** Tokens: `h`/`hh` (12-hour), `H`/`HH` (24-hour), `mm`, `A`/`a` (meridiem); anything else is literal. */
export function formatClockTime(
  format: string,
): (time: Temporal.PlainTime) => string {
  assertFormat(format);

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

/** Decimal hours from one hour up ("+8.5 hours"), minutes below ("+30 mins"). */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) {
    return `+${minutes} ${minutes === 1 ? "min" : "mins"}`;
  }
  const hours = Number((minutes / 60).toFixed(2));
  return `+${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export interface TimeSlot {
  time: Temporal.PlainTime;
  /** Minutes since the anchor, or null unanchored; the last anchored slot is the anchor, a day on. */
  elapsed: number | null;
  nextDay: boolean;
}

export interface TimeSlotOptions {
  /** In minutes. */
  step: number;
  /** Lists the full day from one step after this time, wrapping past midnight. */
  from?: Temporal.PlainTime | null;
}

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
    const elapsed = from ? (i + 1) * step : i * step;
    const total = anchor + elapsed;
    return {
      time: midnight.add({ minutes: total % MINUTES_PER_DAY }),
      elapsed: from ? elapsed : null,
      nextDay: Boolean(from) && total >= MINUTES_PER_DAY,
    };
  });
}

/** Matches only at a boundary, so "2:30" finds "2:30 AM" but not "12:30 AM". */
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
