import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  DEFAULT_DATE_FORMAT,
  formatCalendarDate,
  parseCalendarDate,
} from "../calendar-date";

const iso = (date: Temporal.PlainDate | null) => date?.toString() ?? null;

describe("parseCalendarDate", () => {
  const parse = parseCalendarDate(DEFAULT_DATE_FORMAT);

  it("reads a fully separated date in the pattern's token order", () => {
    expect(iso(parse("11/12/2026"))).toBe("2026-12-11");
  });

  it("orders the parts by the pattern, not by the input", () => {
    // Same digits, opposite meaning — the pattern is the only source of order.
    expect(iso(parseCalendarDate("MM/DD/YYYY")("11/12/2026"))).toBe(
      "2026-11-12",
    );
  });

  it("accepts any non-digit separator", () => {
    for (const input of ["11-12-2026", "11.12.2026", "11 12 2026"]) {
      expect(iso(parse(input))).toBe("2026-12-11");
    }
  });

  it("accepts unpadded day/month groups", () => {
    expect(iso(parse("1/2/2026"))).toBe("2026-02-01");
  });

  it("accepts an unseparated run, split on the pattern's token widths", () => {
    expect(iso(parse("11122026"))).toBe("2026-12-11");
    expect(iso(parseCalendarDate("YYYYMMDD")("20261211"))).toBe("2026-12-11");
  });

  it("ignores surrounding whitespace", () => {
    expect(iso(parse("  11/12/2026  "))).toBe("2026-12-11");
  });

  it("returns null while the input is still incomplete", () => {
    for (const input of ["", "1", "11", "11/", "11/12", "11/12/20"]) {
      expect(iso(parse(input))).toBeNull();
    }
  });

  it("returns null for out-of-range parts rather than rolling over", () => {
    expect(iso(parse("32/12/2026"))).toBeNull();
    expect(iso(parse("11/13/2026"))).toBeNull();
    expect(iso(parse("00/12/2026"))).toBeNull();
  });

  it("rejects a day the month does not have", () => {
    expect(iso(parse("31/11/2026"))).toBeNull();
    expect(iso(parse("29/02/2027"))).toBeNull();
    // …but 2028 is a leap year.
    expect(iso(parse("29/02/2028"))).toBe("2028-02-29");
  });

  it("requires a 4-digit year", () => {
    expect(iso(parse("11/12/26"))).toBeNull();
  });

  it("returns null for junk and for too many parts", () => {
    expect(iso(parse("hello"))).toBeNull();
    expect(iso(parse("11/12/2026/13"))).toBeNull();
  });

  it("throws on a malformed pattern — a developer error, not user input", () => {
    expect(() => parseCalendarDate("DD/MM")).toThrow(/DD, MM and YYYY/);
    expect(() => parseCalendarDate("DD/DD/YYYY")).toThrow(/DD, MM and YYYY/);
  });
});

describe("formatCalendarDate", () => {
  const date = Temporal.PlainDate.from("2026-02-05");

  it("pads each token and keeps the pattern's separators verbatim", () => {
    expect(formatCalendarDate("DD/MM/YYYY")(date)).toBe("05/02/2026");
    expect(formatCalendarDate("MM-DD-YYYY")(date)).toBe("02-05-2026");
    expect(formatCalendarDate("YYYY.MM.DD")(date)).toBe("2026.02.05");
    expect(formatCalendarDate("DDMMYYYY")(date)).toBe("05022026");
  });

  it("round-trips with parseCalendarDate on the same pattern", () => {
    for (const pattern of ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]) {
      const roundTripped = parseCalendarDate(pattern)(
        formatCalendarDate(pattern)(date),
      );
      expect(iso(roundTripped)).toBe("2026-02-05");
    }
  });

  it("throws on a malformed pattern", () => {
    expect(() => formatCalendarDate("MM/YYYY")).toThrow(/DD, MM and YYYY/);
  });
});
