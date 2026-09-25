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

/** "Eastern Daylight Time (UTC-4)" at `at` (default now), so a test can stand either side of a DST change. */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  const name = zonePart(timeZone, at, "long");
  const offset = zonePart(timeZone, at, "shortOffset").replace("GMT", "UTC");
  // A bare "UTC" would read as a zone rather than as an offset.
  return `${name} (${offset === "UTC" ? "UTC+0" : offset})`;
}
