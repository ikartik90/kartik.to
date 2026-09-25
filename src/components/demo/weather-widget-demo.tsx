"use client";

import { fetchCurrentWeather } from "@/app/actions/weather";
import { WeatherWidget } from "@/components/weather-widget";

// The widget's browser half, for the insert dialog's preview and unsaved inserts.

export async function prepareWeatherWidget() {
  const reading = await fetchCurrentWeather();

  return function WeatherWidgetDemo() {
    return <WeatherWidget reading={reading} />;
  };
}
