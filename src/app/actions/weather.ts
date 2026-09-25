"use server";

import { getCurrentWeather } from "@/lib/weather";
import type { WeatherReading } from "@/domain/weather";

// Deliberately public: a read of the public weather, for client-only previews.

export async function fetchCurrentWeather(): Promise<WeatherReading | null> {
  return getCurrentWeather();
}
