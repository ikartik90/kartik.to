import { z } from "zod";

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

// `time` is kept even while overcast: the hidden sun and moon keep tracking day/night,
// so clearing reveals the right one.
export const WeatherSchema = z.object({
  condition: WeatherConditionSchema,
  time: TimeOfDaySchema.default("day"),
});
export type Weather = z.infer<typeof WeatherSchema>;

const OVERCAST = new Set<WeatherCondition>(["rain", "thundershower", "snow"]);

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

/** The design's variant name for a state; rendered as `data-variant`. */
export function weatherVariantName(
  condition: WeatherCondition,
  time: TimeOfDay,
): string {
  const when = isOvercast(condition) ? "Anytime" : time === "day" ? "Day" : "Night";
  return `Weather=${VARIANT_CASE[condition]}, Time=${when}`;
}

export function weatherLabel(condition: WeatherCondition): string {
  return VARIANT_CASE[condition];
}

/** Open-Meteo's WMO 4677 codes, grouped by the drawing they resolve to. */
const WMO_GROUPS: ReadonlyArray<
  readonly [codes: readonly number[], condition: WeatherCondition]
> = [
  // 0 clear sky, 1 mainly clear.
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
  // 95 thunderstorm, 96/99 with hail (there is no hail drawing).
  [[95, 96, 99], "thundershower"],
];

const WMO_CONDITION = new Map<number, WeatherCondition>(
  WMO_GROUPS.flatMap(([codes, condition]) =>
    codes.map((code) => [code, condition] as const),
  ),
);

/** Metres. The aviation threshold for haze, well clear of fog (under 1km). */
export const HAZE_VISIBILITY_M = 5_000;

const OPEN_SKY = new Set<WeatherCondition>(["clear", "cloudy"]);

/**
 * Haze has no WMO code, so it's inferred from visibility, and only for an open sky.
 * Unknown codes fall back to `clear` rather than throwing.
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

export function timeOfDayFromIsDay(isDay: number): TimeOfDay {
  return isDay ? "day" : "night";
}

export const WeatherReadingSchema = z.object({
  condition: WeatherConditionSchema,
  time: TimeOfDaySchema,
  /** Celsius, unrounded. */
  temperatureC: z.number(),
  place: z.string().min(1),
});
export type WeatherReading = z.infer<typeof WeatherReadingSchema>;

/** Rendered as its own element so the digits, not the whole string, centre on the axis. */
export const DEGREE_RING = "°";

/** `+ 0` turns `Math.round`'s -0 into 0. */
export function formatDegrees(celsius: number): string {
  return `${Math.round(celsius) + 0}`;
}
