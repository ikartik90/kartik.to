import { z } from "zod";
import { WEATHER_LOCATION } from "@/data/weather-location";
import {
  conditionFromWeatherCode,
  timeOfDayFromIsDay,
  type WeatherReading,
} from "@/domain/weather";

// Current weather from Open-Meteo. Returns null and never throws: a failure costs the widget, not the page.

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/** `visibility` isn't shown; it infers haze, which has no weather code. */
const CURRENT_FIELDS = [
  "temperature_2m",
  "is_day",
  "weather_code",
  "visibility",
] as const;

/** Matches the API's own 900s model refresh interval. */
const REVALIDATE_SECONDS = 900;

const OpenMeteoCurrentSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    is_day: z.number(),
    weather_code: z.number(),
    visibility: z.number().optional(),
  }),
});

function endpointUrl(): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", String(WEATHER_LOCATION.latitude));
  url.searchParams.set("longitude", String(WEATHER_LOCATION.longitude));
  url.searchParams.set("current", CURRENT_FIELDS.join(","));
  return url.toString();
}

export async function getCurrentWeather(): Promise<WeatherReading | null> {
  try {
    const response = await fetch(endpointUrl(), {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;

    const parsed = OpenMeteoCurrentSchema.safeParse(await response.json());
    if (!parsed.success) return null;

    const { temperature_2m, is_day, weather_code, visibility } =
      parsed.data.current;

    return {
      condition: conditionFromWeatherCode(weather_code, visibility),
      time: timeOfDayFromIsDay(is_day),
      temperatureC: temperature_2m,
      place: WEATHER_LOCATION.place,
    };
  } catch {
    return null;
  }
}
