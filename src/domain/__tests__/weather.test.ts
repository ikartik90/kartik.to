import { describe, expect, it } from "vitest";
import {
  WEATHER_CONDITIONS,
  HAZE_VISIBILITY_M,
  conditionFromWeatherCode,
  timeOfDayFromIsDay,
  WeatherConditionSchema,
  WeatherReadingSchema,
  formatDegrees,
  DEGREE_RING,
  WeatherSchema,
  TimeOfDaySchema,
  isOvercast,
  weatherLabel,
  weatherVariantName,
} from "../weather";

describe("WeatherConditionSchema", () => {
  it("accepts every condition the Figma component set draws", () => {
    for (const condition of WEATHER_CONDITIONS) {
      expect(WeatherConditionSchema.safeParse(condition).success).toBe(true);
    }
  });

  it("rejects a condition the graphic has no layers for", () => {
    expect(WeatherConditionSchema.safeParse("hail").success).toBe(false);
  });
});

describe("TimeOfDaySchema", () => {
  it("accepts day and night", () => {
    expect(TimeOfDaySchema.safeParse("day").success).toBe(true);
    expect(TimeOfDaySchema.safeParse("night").success).toBe(true);
  });

  it("rejects Figma's 'anytime' — that is a property of the CONDITION", () => {
    expect(TimeOfDaySchema.safeParse("anytime").success).toBe(false);
  });
});

describe("WeatherSchema", () => {
  it("defaults an unstated time to day", () => {
    const parsed = WeatherSchema.parse({ condition: "cloudy" });
    expect(parsed).toEqual({ condition: "cloudy", time: "day" });
  });

  it("keeps a stated time on an overcast condition", () => {
    // The sky is hidden, but the body behind it still has to be the right one
    // for the moment the weather clears.
    expect(WeatherSchema.parse({ condition: "rain", time: "night" })).toEqual({
      condition: "rain",
      time: "night",
    });
  });
});

describe("isOvercast", () => {
  it("is true for the three conditions Figma draws as Time=Anytime", () => {
    expect(isOvercast("rain")).toBe(true);
    expect(isOvercast("thundershower")).toBe(true);
    expect(isOvercast("snow")).toBe(true);
  });

  it("is false for every condition that shows a sun or a moon", () => {
    expect(isOvercast("clear")).toBe(false);
    expect(isOvercast("cloudy")).toBe(false);
    expect(isOvercast("haze")).toBe(false);
    expect(isOvercast("fog")).toBe(false);
  });
});

describe("weatherVariantName", () => {
  it("names the Figma variant a sun-bearing condition resolves to", () => {
    expect(weatherVariantName("cloudy", "night")).toBe(
      "Weather=Cloudy, Time=Night",
    );
    expect(weatherVariantName("fog", "day")).toBe("Weather=Fog, Time=Day");
  });

  it("collapses an overcast condition onto its single Anytime variant", () => {
    expect(weatherVariantName("rain", "night")).toBe(
      "Weather=Rain, Time=Anytime",
    );
    expect(weatherVariantName("thundershower", "day")).toBe(
      "Weather=Thundershower, Time=Anytime",
    );
  });
});

describe("weatherLabel", () => {
  it("names the condition and nothing else", () => {
    // Deliberately NOT qualified by the hour. A caption walking the set has to
    // read as one label changing its value, and half the conditions needed a
    // comma to stay grammatical once the time was in there.
    expect(weatherLabel("clear")).toBe("Clear");
    expect(weatherLabel("haze")).toBe("Haze");
    expect(weatherLabel("thundershower")).toBe("Thundershower");
  });

  it("has a name for every condition", () => {
    for (const condition of WEATHER_CONDITIONS) {
      expect(weatherLabel(condition).length).toBeGreaterThan(0);
    }
  });
});

describe("conditionFromWeatherCode", () => {
  it("maps every WMO code Open-Meteo emits onto a drawing", () => {
    // The API's documented code list. If a code here has no case, the widget
    // falls through to its default and quietly draws the wrong sky — so the
    // test is the list, not a sample of it.
    const codes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
      77, 80, 81, 82, 85, 86, 95, 96, 99,
    ];
    for (const code of codes) {
      expect(
        WEATHER_CONDITIONS,
        `code ${code} has no drawing`,
      ).toContain(conditionFromWeatherCode(code));
    }
  });

  it("reads an open sky as clear and a closing one as cloudy", () => {
    expect(conditionFromWeatherCode(0)).toBe("clear");
    expect(conditionFromWeatherCode(1)).toBe("clear");
    expect(conditionFromWeatherCode(2)).toBe("cloudy");
    expect(conditionFromWeatherCode(3)).toBe("cloudy");
  });

  it("draws both of the fog codes as fog", () => {
    expect(conditionFromWeatherCode(45)).toBe("fog");
    expect(conditionFromWeatherCode(48)).toBe("fog");
  });

  it("collapses drizzle, rain and rain showers onto the one rain drawing", () => {
    for (const code of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]) {
      expect(conditionFromWeatherCode(code), `code ${code}`).toBe("rain");
    }
  });

  it("collapses snowfall, grains and snow showers onto the one snow drawing", () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect(conditionFromWeatherCode(code), `code ${code}`).toBe("snow");
    }
  });

  it("draws every thunderstorm, hail or not, as a thundershower", () => {
    for (const code of [95, 96, 99]) {
      expect(conditionFromWeatherCode(code), `code ${code}`).toBe(
        "thundershower",
      );
    }
  });

  it("falls back to clear for a code the API has never documented", () => {
    expect(conditionFromWeatherCode(7)).toBe("clear");
    expect(conditionFromWeatherCode(-1)).toBe("clear");
  });
});

describe("conditionFromWeatherCode — haze", () => {
  // Haze is the one drawing in the set with NO weather code behind it: the
  // WMO list Open-Meteo emits goes straight from overcast to fog. It is
  // reached from visibility instead, which rides along on the same request.
  it("reads a short view under an open sky as haze", () => {
    for (const code of [0, 1, 2, 3]) {
      expect(conditionFromWeatherCode(code, 3000), `code ${code}`).toBe("haze");
    }
  });

  it("leaves a long view alone", () => {
    expect(conditionFromWeatherCode(0, 18640)).toBe("clear");
    expect(conditionFromWeatherCode(3, 18640)).toBe("cloudy");
  });

  it("takes the threshold as the first CLEAR reading, not the last hazy one", () => {
    expect(conditionFromWeatherCode(0, HAZE_VISIBILITY_M - 1)).toBe("haze");
    expect(conditionFromWeatherCode(0, HAZE_VISIBILITY_M)).toBe("clear");
  });

  it("never talks a reported condition down to haze", () => {
    // Fog is already the shorter view, and rain through a murk is still rain.
    // Visibility only gets to speak when the code says nothing is happening.
    expect(conditionFromWeatherCode(45, 200)).toBe("fog");
    expect(conditionFromWeatherCode(65, 800)).toBe("rain");
    expect(conditionFromWeatherCode(95, 900)).toBe("thundershower");
    expect(conditionFromWeatherCode(75, 400)).toBe("snow");
  });

  it("stays on the code when visibility is missing", () => {
    // The field is optional on the response; absent must not read as zero.
    expect(conditionFromWeatherCode(0, undefined)).toBe("clear");
    expect(conditionFromWeatherCode(3, undefined)).toBe("cloudy");
  });
});

describe("timeOfDayFromIsDay", () => {
  it("takes the API's own answer rather than guessing from a clock", () => {
    expect(timeOfDayFromIsDay(1)).toBe("day");
    expect(timeOfDayFromIsDay(0)).toBe("night");
  });
});

describe("WeatherReadingSchema", () => {
  const reading = {
    condition: "cloudy",
    time: "night",
    temperatureC: 22.6,
    place: "Toronto",
  };

  it("accepts a complete reading", () => {
    expect(WeatherReadingSchema.parse(reading)).toEqual(reading);
  });

  it("rejects a reading with no place to attach it to", () => {
    // The place name is what stops a visitor in London reading 22° as theirs,
    // so an empty one is a broken widget rather than a cosmetic gap.
    expect(
      WeatherReadingSchema.safeParse({ ...reading, place: "" }).success,
    ).toBe(false);
  });

  it("rejects a temperature that arrived as a string", () => {
    expect(
      WeatherReadingSchema.safeParse({ ...reading, temperatureC: "22.6" })
        .success,
    ).toBe(false);
  });
});

describe("formatDegrees", () => {
  it("rounds to whole degrees", () => {
    expect(formatDegrees(22.6)).toBe("23");
    expect(formatDegrees(22.4)).toBe("22");
  });

  it("keeps a negative reading negative", () => {
    expect(formatDegrees(-4.2)).toBe("-4");
  });

  it("never renders a signed zero", () => {
    // Math.round(-0.4) is -0, which templates as "-0" — a temperature no
    // thermometer has ever shown.
    expect(formatDegrees(-0.4)).toBe("0");
  });

  it("carries no ring of its own", () => {
    // The ring is a separate string because the widget POSITIONS it separately
    // — it hangs off the digits rather than sitting inside the centred text, so
    // that the number lands on the card's axis. A `formatDegrees` that quietly
    // appended it would put the widget straight back where it started.
    expect(formatDegrees(22.6)).not.toContain(DEGREE_RING);
  });

  it("still reads as a temperature once the two are put back together", () => {
    // Split for LAYOUT only. Whatever a screen reader ends up hearing has to
    // be the thing a thermometer says.
    expect(`${formatDegrees(22.6)}${DEGREE_RING}`).toBe("23°");
  });
});
