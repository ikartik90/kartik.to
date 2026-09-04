/**
 * The one place the weather widget reports from.
 *
 * The widget shows MY sky, not the visitor's — which is why this is a constant
 * rather than a geolocation lookup. It makes the card a small piece of
 * self-portrait ("it is 23° and raining where I am") instead of a utility the
 * visitor already has a better version of on their phone, and it means the
 * homepage can cache one reading for everybody rather than doing per-request
 * IP work that is routinely tens of kilometres wrong anyway.
 *
 * `place` is rendered on the card and is doing real work there: without it a
 * visitor in London reads 23° as theirs.
 */
export const WEATHER_LOCATION = {
  latitude: 43.6532,
  longitude: -79.3832,
  place: "Toronto",
} as const;
