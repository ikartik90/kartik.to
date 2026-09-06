import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  DEFAULT_TIME_FORMAT,
  formatClockTime,
  formatElapsed,
  matchesClockQuery,
  timeSlots,
} from "../clock-time";

const at = (iso: string) => Temporal.PlainTime.from(iso);

describe("formatClockTime", () => {
  it("writes the design's 12-hour clock", () => {
    const format = formatClockTime(DEFAULT_TIME_FORMAT);
    expect(format(at("00:00"))).toBe("12:00 AM");
    expect(format(at("00:30"))).toBe("12:30 AM");
    expect(format(at("12:00"))).toBe("12:00 PM");
    expect(format(at("13:05"))).toBe("1:05 PM");
    expect(format(at("23:30"))).toBe("11:30 PM");
  });

  it("pads the hour on hh and lowercases the meridiem on a", () => {
    expect(formatClockTime("hh:mm a")(at("01:05"))).toBe("01:05 am");
  });

  it("writes a 24-hour clock", () => {
    const format = formatClockTime("HH:mm");
    expect(format(at("00:00"))).toBe("00:00");
    expect(format(at("09:30"))).toBe("09:30");
    expect(format(at("23:30"))).toBe("23:30");
    expect(formatClockTime("H:mm")(at("09:30"))).toBe("9:30");
  });

  // The pattern is a developer's input, not a user's — so a bad one is a throw
  // at factory time rather than a wrong string on every row.
  it("rejects a pattern that is not a clock", () => {
    expect(() => formatClockTime("mm")).toThrow(/exactly one hour token/i);
    expect(() => formatClockTime("h:mm:mm A")).toThrow(/exactly one mm/i);
    expect(() => formatClockTime("h:mm")).toThrow(/meridiem/i);
    expect(() => formatClockTime("HH:mm A")).toThrow(/meridiem/i);
  });
});

describe("formatElapsed", () => {
  it("writes the design's decimal hours", () => {
    expect(formatElapsed(480)).toBe("+8 hours");
    expect(formatElapsed(510)).toBe("+8.5 hours");
    expect(formatElapsed(540)).toBe("+9 hours");
    expect(formatElapsed(600)).toBe("+10 hours");
  });

  it("singularises exactly one hour", () => {
    expect(formatElapsed(60)).toBe("+1 hour");
    expect(formatElapsed(90)).toBe("+1.5 hours");
  });

  it("stays in minutes below the hour, where decimal hours read as noise", () => {
    expect(formatElapsed(30)).toBe("+30 mins");
    expect(formatElapsed(1)).toBe("+1 min");
    expect(formatElapsed(0)).toBe("+0 mins");
  });

  it("keeps a quarter-hour grid legible", () => {
    expect(formatElapsed(495)).toBe("+8.25 hours");
  });
});

describe("timeSlots", () => {
  it("walks the whole day from midnight when unanchored", () => {
    const slots = timeSlots({ step: 30 });
    expect(slots).toHaveLength(48);
    expect(slots[0].time.toString()).toBe("00:00:00");
    expect(slots[1].time.toString()).toBe("00:30:00");
    expect(slots.at(-1)!.time.toString()).toBe("23:30:00");
    // Nothing to measure against, and no midnight to cross on the way out.
    expect(slots.every((s) => s.elapsed === null)).toBe(true);
    expect(slots.every((s) => !s.nextDay)).toBe(true);
  });

  it("honours the step", () => {
    expect(timeSlots({ step: 60 })).toHaveLength(24);
    expect(timeSlots({ step: 15 })).toHaveLength(96);
    expect(timeSlots({ step: 15 })[1].time.toString()).toBe("00:15:00");
  });

  // The Figma's list: anchored at 3:00 PM, 11:00 PM reads "+8 hours" and the
  // day rolls over at 12:00 AM.
  it("runs forward from the anchor when one is given", () => {
    const slots = timeSlots({ step: 30, from: at("15:00") });
    expect(slots).toHaveLength(48);
    expect(slots[0].time.toString()).toBe("15:30:00");
    expect(slots[0].elapsed).toBe(30);
    const eleven = slots.find((s) => s.time.equals(at("23:00")))!;
    expect(eleven.elapsed).toBe(480);
    expect(eleven.nextDay).toBe(false);
  });

  it("marks every slot past midnight as the next day", () => {
    const slots = timeSlots({ step: 30, from: at("15:00") });
    const midnight = slots.find((s) => s.time.equals(at("00:00")))!;
    expect(midnight.elapsed).toBe(540); // +9 hours
    expect(midnight.nextDay).toBe(true);
    // 15:30 → 23:30 is 17 slots on the day itself; the other 31 have crossed.
    expect(slots.filter((s) => s.nextDay)).toHaveLength(31);
    // Exactly one crossing, so the list can rule it once.
    const crossings = slots.filter((s, i) => s.nextDay && !slots[i - 1]?.nextDay);
    expect(crossings).toHaveLength(1);
    expect(crossings[0].time.toString()).toBe("00:00:00");
  });

  it("closes the anchored list a full day out", () => {
    const slots = timeSlots({ step: 30, from: at("15:00") });
    const last = slots.at(-1)!;
    expect(last.time.toString()).toBe("15:00:00");
    expect(last.elapsed).toBe(1440);
    expect(last.nextDay).toBe(true);
  });

  it("does not roll the day over for an anchor at midnight", () => {
    const slots = timeSlots({ step: 60, from: at("00:00") });
    expect(slots[0].time.toString()).toBe("01:00:00");
    expect(slots[0].nextDay).toBe(false);
    expect(slots.at(-1)!.time.toString()).toBe("00:00:00");
    expect(slots.at(-1)!.nextDay).toBe(true);
  });

  it("rejects a step that cannot walk a day", () => {
    expect(() => timeSlots({ step: 0 })).toThrow(/step/i);
    expect(() => timeSlots({ step: -30 })).toThrow(/step/i);
    expect(() => timeSlots({ step: 1441 })).toThrow(/step/i);
    expect(() => timeSlots({ step: 7.5 })).toThrow(/step/i);
  });
});

describe("matchesClockQuery", () => {
  it("keeps everything for an empty query", () => {
    expect(matchesClockQuery("12:30 AM", "")).toBe(true);
    expect(matchesClockQuery("12:30 AM", "   ")).toBe(true);
  });

  // The bug this exists for: a plain substring match makes "2:30" also hit
  // "12:30", so typing an exact time and pressing Enter can commit a DIFFERENT
  // one an hour and ten off.
  it("does not let a query match mid-number", () => {
    expect(matchesClockQuery("2:30 AM", "2:30")).toBe(true);
    expect(matchesClockQuery("12:30 AM", "2:30")).toBe(false);
    expect(matchesClockQuery("11:00 PM", "1:00")).toBe(false);
    expect(matchesClockQuery("1:00 PM", "1:00")).toBe(true);
  });

  // A boundary is the start of the string or anything non-alphanumeric before
  // it — so the parts of a clock stay searchable on their own.
  it("matches each part of the clock from its own start", () => {
    expect(matchesClockQuery("12:30 AM", "12")).toBe(true);
    expect(matchesClockQuery("12:30 AM", "30")).toBe(true);
    expect(matchesClockQuery("12:30 AM", "am")).toBe(true);
    expect(matchesClockQuery("12:30 AM", "12:30 am")).toBe(true);
    expect(matchesClockQuery("12:30 PM", "am")).toBe(false);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(matchesClockQuery("12:30 AM", "  12:30 Am ")).toBe(true);
  });

  it("works the same on a 24-hour clock", () => {
    expect(matchesClockQuery("23:30", "23")).toBe(true);
    expect(matchesClockQuery("23:30", "3:30")).toBe(false);
    expect(matchesClockQuery("03:30", "03")).toBe(true);
  });
});
