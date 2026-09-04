"use client";

import { fetchCurrentWeather } from "@/app/actions/weather";
import { WeatherWidget } from "@/components/weather-widget";

// ---------------------------------------------------------------------------
// The widget's BROWSER half — the same card, fed from the browser instead of
// from the page.
//
// A second entry point rather than a second component, exactly as
// `shader-preset-reel-demo` is: the grid renders `WeatherWidget` on the server
// with the reading already in hand, which is better in every way that matters
// (it is in the initial HTML, it is cached for every visitor at once, and it
// needs no round trip). This covers the two places that render is not
// available — the insert dialog's live preview, and a card just added to an
// unsaved layout the server has never seen.
//
// The fetch happens in the LOAD rather than on mount, so `useDemoLoader` awaits
// it behind the frame's preloader and the card arrives with its number rather
// than opening blank and filling in later.
// ---------------------------------------------------------------------------

export async function prepareWeatherWidget() {
  const reading = await fetchCurrentWeather();

  return function WeatherWidgetDemo() {
    return <WeatherWidget reading={reading} />;
  };
}
