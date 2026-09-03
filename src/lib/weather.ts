import { z } from "zod";
import { WEATHER_LOCATION } from "@/data/weather-location";
import {
  conditionFromWeatherCode,
  timeOfDayFromIsDay,
  type WeatherReading,
} from "@/domain/weather";

// ---------------------------------------------------------------------------
// The current sky at `WEATHER_LOCATION`, from Open-Meteo.
//
// Open-Meteo rather than one of the commercial services for the reasons that
// actually matter here: no API key (so nothing to keep out of the repo and
// nothing to rotate), no attribution requirement on a personal site, and a
// free tier that a homepage revalidating four times an hour does not come
// close to. It is also the one that reports `is_day` and `visibility` on the
// same call as the temperature, which is exactly the four fields this needs.
//
// This is the first outbound HTTP call in the app, so it is worth being
// explicit about the failure posture: it returns `null` and never throws. The
// homepage awaits this, and a weather service having a bad afternoon must cost
// the widget its numbers, not the page its render.
// ---------------------------------------------------------------------------

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/**
 * The four measurements the widget draws from, and nothing else.
 *
 * `visibility` is the odd one out — nothing on the card displays it. It is
 * there because `haze` has no weather code behind it and has to be inferred
 * from the length of the view instead; see `conditionFromWeatherCode`.
 */
const CURRENT_FIELDS = [
  "temperature_2m",
  "is_day",
  "weather_code",
  "visibility",
] as const;

/**
 * How long a reading stands before it is fetched again, in seconds.
 *
 * 900 is not a taste decision: the API stamps every response with
 * `"interval": 900`, which is how often the underlying model is refreshed.
 * Asking more often than that returns the same numbers.
 */
const REVALIDATE_SECONDS = 900;

/**
 * The wire format, validated at the boundary.
 *
 * The response is much larger than this and the extra keys are allowed through
 * unread — the point is not to describe Open-Meteo, it is to refuse to hand the
 * widget a `temperature_2m` that has quietly become a string or gone missing.
 * Without this an upstream rename renders as `undefined°` on the homepage.
 *
 * `visibility` is optional because it is the one field the mapping can do
 * without: absent, the sky is simply read off the code.
 */
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

/**
 * The current reading, or `null` if the service could not supply one.
 *
 * `null` rather than a thrown error or a fabricated default: the widget can
 * draw itself without numbers (see `WeatherWidget`), and a made-up "clear, 20°"
 * would be the one outcome worse than saying nothing — a card that is
 * confidently wrong looks exactly like a card that is right.
 */
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
    // Network refused, DNS gone, JSON unparseable — all the same answer.
    return null;
  }
}
