// ---------------------------------------------------------------------------
// What a field says about the clock it is quoting: "Eastern Daylight Time
// (UTC-4)".
//
// Computed from the platform's own zone database rather than written down,
// because the half of it that matters is the half that changes: a shift form
// that still reads "Daylight" in January is quoting an offset an hour off the
// times printed above it. Both halves come from `Intl` at a given INSTANT, so
// the label turns over by itself on the two nights a year that it must, and a
// test can stand on either side of one.
// ---------------------------------------------------------------------------

function zonePart(
  timeZone: string,
  at: Date,
  timeZoneName: "long" | "shortOffset",
): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

/**
 * The zone's full name at `at`, with its offset from UTC in brackets. `at`
 * defaults to now; pass one to ask what the label WILL read on a given night,
 * which is the only way to test a rule that turns over twice a year.
 *
 * The offset is `Intl`'s short form retitled — "GMT-4" is the same number under
 * a name half the world does not use for it, and the zone name beside it
 * already says which standard is in force.
 */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  const name = zonePart(timeZone, at, "long");
  const offset = zonePart(timeZone, at, "shortOffset").replace("GMT", "UTC");
  // Every engine that supports `shortOffset` signs a zero ("GMT+0"), but a bare
  // "UTC" would read as a zone rather than as an offset if one ever did not.
  return `${name} (${offset === "UTC" ? "UTC+0" : offset})`;
}
