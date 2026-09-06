import { describe, expect, it } from "vitest";
import { timeZoneLabel } from "../time-zone-label";

const at = (iso: string) => new Date(iso);

describe("timeZoneLabel", () => {
  it("names the zone and its offset from UTC", () => {
    expect(timeZoneLabel("America/New_York", at("2026-07-01T12:00:00Z"))).toBe(
      "Eastern Daylight Time (UTC-4)",
    );
  });

  // The whole reason this is computed rather than written down: the label has
  // to change by itself twice a year.
  it("follows daylight saving in and out", () => {
    const eastern = (iso: string) => timeZoneLabel("America/New_York", at(iso));
    expect(eastern("2026-01-15T12:00:00Z")).toBe(
      "Eastern Standard Time (UTC-5)",
    );
    // 2026's US transitions, to the hour: 8 March and 1 November.
    expect(eastern("2026-03-08T06:00:00Z")).toBe(
      "Eastern Standard Time (UTC-5)",
    );
    expect(eastern("2026-03-08T07:00:00Z")).toBe(
      "Eastern Daylight Time (UTC-4)",
    );
    expect(eastern("2026-11-01T05:00:00Z")).toBe(
      "Eastern Daylight Time (UTC-4)",
    );
    expect(eastern("2026-11-01T06:00:00Z")).toBe(
      "Eastern Standard Time (UTC-5)",
    );
  });

  it("keeps a half-hour offset whole", () => {
    expect(timeZoneLabel("Asia/Kolkata", at("2026-07-01T12:00:00Z"))).toBe(
      "India Standard Time (UTC+5:30)",
    );
  });

  it("signs a zero offset rather than leaving it bare", () => {
    expect(timeZoneLabel("UTC", at("2026-07-01T12:00:00Z"))).toBe(
      "Coordinated Universal Time (UTC+0)",
    );
    expect(timeZoneLabel("Europe/London", at("2026-01-15T12:00:00Z"))).toBe(
      "Greenwich Mean Time (UTC+0)",
    );
  });
});
