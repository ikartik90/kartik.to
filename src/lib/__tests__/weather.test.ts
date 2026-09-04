import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWeather } from "../weather";
import { WEATHER_LOCATION } from "@/data/weather-location";

// A response shaped exactly like the one the endpoint returns — copied from a
// real call rather than invented, so a field the API renames breaks this too.
function currentPayload(over: Record<string, unknown> = {}) {
  return {
    latitude: 43.646603,
    longitude: -79.38272,
    timezone: "America/Toronto",
    current_units: { temperature_2m: "°C", weather_code: "wmo code" },
    current: {
      time: "2026-09-02T13:00",
      interval: 900,
      temperature_2m: 23.7,
      is_day: 1,
      weather_code: 3,
      visibility: 13100,
      ...over,
    },
  };
}

function respondWith(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

describe("getCurrentWeather", () => {
  beforeEach(() => vi.stubGlobal("fetch", respondWith(currentPayload())));
  afterEach(() => vi.unstubAllGlobals());

  it("reads the current sky at the configured place", async () => {
    expect(await getCurrentWeather()).toEqual({
      condition: "cloudy",
      time: "day",
      temperatureC: 23.7,
      place: WEATHER_LOCATION.place,
    });
  });

  it("asks for exactly the four fields it uses, at the configured coordinates", async () => {
    await getCurrentWeather();
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe(
      "https://api.open-meteo.com/v1/forecast",
    );
    expect(url.searchParams.get("latitude")).toBe(
      String(WEATHER_LOCATION.latitude),
    );
    expect(url.searchParams.get("longitude")).toBe(
      String(WEATHER_LOCATION.longitude),
    );
    expect(url.searchParams.get("current")?.split(",").sort()).toEqual([
      "is_day",
      "temperature_2m",
      "visibility",
      "weather_code",
    ]);
  });

  it("takes the hour from the service rather than from a clock", async () => {
    // The base fixture is a daytime response, so this pins the other branch:
    // the widget must not work the hour out from the visitor's own timezone,
    // which is not the timezone the reading was taken in.
    vi.stubGlobal("fetch", respondWith(currentPayload({ is_day: 0 })));
    expect((await getCurrentWeather())?.time).toBe("night");
  });

  it("lets visibility pick out haze from an otherwise open sky", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(currentPayload({ weather_code: 0, visibility: 2200 })),
    );
    expect((await getCurrentWeather())?.condition).toBe("haze");
  });

  it("returns nothing when the service answers with an error status", async () => {
    vi.stubGlobal("fetch", respondWith({ error: true }, false));
    expect(await getCurrentWeather()).toBeNull();
  });

  it("returns nothing when the service answers with a shape it does not know", async () => {
    // A silently renamed field must not reach the widget as `undefined°`.
    vi.stubGlobal("fetch", respondWith({ current: { temp: 22.6 } }));
    expect(await getCurrentWeather()).toBeNull();
  });

  it("returns nothing when the request throws outright", async () => {
    // The homepage renders this. A DNS failure must cost the widget, not
    // the page.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));
    expect(await getCurrentWeather()).toBeNull();
  });

  it("survives a response with no visibility field at all", async () => {
    const payload = currentPayload();
    delete (payload.current as Record<string, unknown>).visibility;
    vi.stubGlobal("fetch", respondWith(payload));
    expect((await getCurrentWeather())?.condition).toBe("cloudy");
  });
});
