import { z } from "zod";

// ---------------------------------------------------------------------------
// Weather — the sky the graphic draws, as two independent facts.
//
// The Figma component set (1995:24) is a variant matrix of Weather × Time, but
// only eleven of the fourteen cells exist: Rain, Thundershower and Snow are
// drawn ONCE, as `Time=Anytime`. That is not a gap in the design — it is the
// design saying that an overcast sky hides whatever is behind it, so a night
// downpour and a noon downpour are the same picture.
//
// The schema keeps `time` anyway, on every condition, and that is deliberate.
// The graphic never unmounts a layer; the sun and the moon are both always in
// the DOM, cross-fading against each other. So while it rains, the body behind
// the cloud is still tracking day/night — invisibly — and the moment the
// weather clears, the right one is already there to be revealed. Collapsing
// `time` to "anytime" at the data layer would throw that away and make
// rain → clear at 2am resolve to a sunrise.
//
// `isOvercast` is therefore a question about PRESENTATION (does a viewer see a
// time of day?), not about what the state is allowed to hold.
// ---------------------------------------------------------------------------

/**
 * Every condition the graphic has layers for, in the order the Figma frame
 * lays them out — clear through to snow, sky opening to sky closing.
 */
export const WEATHER_CONDITIONS = [
  "clear",
  "cloudy",
  "haze",
  "fog",
  "rain",
  "thundershower",
  "snow",
] as const;

export const WeatherConditionSchema = z.enum(WEATHER_CONDITIONS);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const TIMES_OF_DAY = ["day", "night"] as const;

export const TimeOfDaySchema = z.enum(TIMES_OF_DAY);
export type TimeOfDay = z.infer<typeof TimeOfDaySchema>;

export const WeatherSchema = z.object({
  condition: WeatherConditionSchema,
  time: TimeOfDaySchema.default("day"),
});
export type Weather = z.infer<typeof WeatherSchema>;

/** The three conditions Figma draws once, as `Time=Anytime`. */
const OVERCAST = new Set<WeatherCondition>(["rain", "thundershower", "snow"]);

/**
 * Whether the cloud deck closes over the sky entirely — in which case no sun
 * or moon is visible and the time of day, though still tracked, has nothing to
 * show for it.
 */
export function isOvercast(condition: WeatherCondition): boolean {
  return OVERCAST.has(condition);
}

const VARIANT_CASE: Record<WeatherCondition, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  haze: "Haze",
  fog: "Fog",
  rain: "Rain",
  thundershower: "Thundershower",
  snow: "Snow",
};

/**
 * The name of the Figma variant a state resolves to, exactly as the component
 * set spells it. Carried onto the rendered node as `data-variant` so a drawing
 * on screen can be traced back to the frame it came from without counting
 * layers.
 */
export function weatherVariantName(
  condition: WeatherCondition,
  time: TimeOfDay,
): string {
  const when = isOvercast(condition) ? "Anytime" : time === "day" ? "Day" : "Night";
  return `Weather=${VARIANT_CASE[condition]}, Time=${when}`;
}

/**
 * What the graphic is called: the condition, and nothing else.
 *
 * It used to qualify by the hour — "Clear night", "Haze, daytime" — which is
 * more information and worse writing. Half the conditions took a comma to stay
 * grammatical, so a caption walking the set read as a list of different KINDS
 * of thing rather than one label changing its value. The hour is not lost: it
 * is in `time`, in `weatherVariantName`, and in the drawing itself.
 */
export function weatherLabel(condition: WeatherCondition): string {
  return VARIANT_CASE[condition];
}

// ---------------------------------------------------------------------------
// Reading the sky off a weather service.
//
// Open-Meteo reports the current condition as a WMO 4677 code, and the set of
// codes it actually emits is much smaller than the standard's — twenty-eight
// values, listed in the groups below. Seven drawings have to cover all of them,
// so this is a widening: five kinds of rain and three kinds of drizzle are one
// picture, because they are one picture in the Figma set.
//
// The mapping lives in the domain rather than in the fetch for the usual
// reason — it is a rule about what the weather IS, testable without a network
// — and for one particular one: `haze` has no code behind it at all, so the
// rule is the only place that fact is written down.
// ---------------------------------------------------------------------------

/**
 * The codes Open-Meteo documents, grouped by the drawing they resolve to.
 *
 * Written as groups rather than a flat map so the widening is legible: you can
 * see that 51–57 (drizzle), 61–67 (rain) and 80–82 (showers) all land on the
 * same picture, which is a decision, not an accident of table entry.
 */
const WMO_GROUPS: ReadonlyArray<
  readonly [codes: readonly number[], condition: WeatherCondition]
> = [
  // 0 clear sky, 1 mainly clear. "Mainly clear" is a sky with a few clouds in
  // it, and the cloudy drawing is a deck of them — so it reads as clear.
  [[0, 1], "clear"],
  // 2 partly cloudy, 3 overcast.
  [[2, 3], "cloudy"],
  // 45 fog, 48 depositing rime fog.
  [[45, 48], "fog"],
  // 51/53/55 drizzle, 56/57 freezing drizzle, 61/63/65 rain,
  // 66/67 freezing rain, 80/81/82 rain showers.
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], "rain"],
  // 71/73/75 snow fall, 77 snow grains, 85/86 snow showers.
  [[71, 73, 75, 77, 85, 86], "snow"],
  // 95 thunderstorm, 96/99 thunderstorm with hail. The set has no hail
  // drawing, and a storm is the louder half of that sentence anyway.
  [[95, 96, 99], "thundershower"],
];

const WMO_CONDITION = new Map<number, WeatherCondition>(
  WMO_GROUPS.flatMap(([codes, condition]) =>
    codes.map((code) => [code, condition] as const),
  ),
);

/**
 * How short the view has to get before an otherwise open sky reads as hazy, in
 * metres.
 *
 * 5km is the conventional aviation threshold for haze, and it sits well clear
 * of fog (which the WMO puts under 1km, and which arrives as its own code
 * anyway). Toronto reports around 13km under an ordinary overcast, so this
 * does not fire on a merely grey afternoon.
 */
export const HAZE_VISIBILITY_M = 5_000;

/** The two drawings that show a sky open enough for visibility to matter. */
const OPEN_SKY = new Set<WeatherCondition>(["clear", "cloudy"]);

/**
 * The drawing a reported condition resolves to.
 *
 * `visibilityMetres` is optional and only ever gets to speak when the code
 * itself reports nothing happening: haze is the one condition in the set with
 * no WMO code behind it — Open-Meteo's list goes straight from overcast (3) to
 * fog (45) — so it has to be inferred, and inference must never overrule an
 * observation. Rain seen through a murk is still rain.
 *
 * An unrecognised code falls back to `clear` rather than throwing. A widget
 * that renders an empty sky on a code nobody has seen before is a much smaller
 * failure than a homepage that will not render.
 */
export function conditionFromWeatherCode(
  code: number,
  visibilityMetres?: number,
): WeatherCondition {
  const condition = WMO_CONDITION.get(code) ?? "clear";

  return OPEN_SKY.has(condition) &&
    visibilityMetres !== undefined &&
    visibilityMetres < HAZE_VISIBILITY_M
    ? "haze"
    : condition;
}

/**
 * Day or night, from the service's own `is_day` flag.
 *
 * Taken from the API rather than computed from a clock because the answer is
 * a sunrise/sunset question at a specific latitude on a specific date, and the
 * API already knows all three. A local-hours heuristic would be wrong twice a
 * day at the edges and wrong for months at high latitudes.
 */
export function timeOfDayFromIsDay(isDay: number): TimeOfDay {
  return isDay ? "day" : "night";
}

/**
 * One observation, as the widget needs it — the drawing, the hour, the number
 * and the place it belongs to.
 *
 * Separate from `WeatherSchema`, which is what the GRAPHIC takes: the graphic
 * draws a sky and knows nothing about thermometers or cities, and keeping it
 * that way is what lets it be used for a scripted sequence with no data behind
 * it at all.
 */
export const WeatherReadingSchema = z.object({
  condition: WeatherConditionSchema,
  time: TimeOfDaySchema,
  /** Celsius, unrounded — the rounding is a rendering decision. */
  temperatureC: z.number(),
  /**
   * Where this was measured, as it should be read. Non-empty because it is the
   * only thing telling a visitor the reading is not theirs.
   */
  place: z.string().min(1),
});
export type WeatherReading = z.infer<typeof WeatherReadingSchema>;

/**
 * The ring, kept out of the number rather than templated onto it.
 *
 * It is a layout split, not a data one. The widget centres every line on one
 * vertical axis, and a temperature set as the single string "23°" is centred as
 * that string — which puts the DIGITS half a ring's width to the left of the
 * axis, and the digits are what the eye reads a column's alignment from. So the
 * card renders the ring as its own element and hangs it off the number; the two
 * halves are still adjacent in the DOM, so a screen reader hears "23°"
 * unchanged.
 *
 * Named here rather than written into the component because it is the other
 * half of `formatDegrees` — the pair only means a temperature together, and a
 * literal "°" sitting in some JSX is exactly how they would drift apart.
 */
export const DEGREE_RING = "°";

/**
 * A temperature as a widget shows one: whole degrees, no unit and no ring.
 *
 * `+ 0` normalises the negative zero `Math.round` returns for anything in
 * [-0.5, 0), which would otherwise template as "-0".
 */
export function formatDegrees(celsius: number): string {
  return `${Math.round(celsius) + 0}`;
}
