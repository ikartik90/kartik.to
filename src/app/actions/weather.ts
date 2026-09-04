"use server";

import { getCurrentWeather } from "@/lib/weather";
import type { WeatherReading } from "@/domain/weather";

// ---------------------------------------------------------------------------
// The current reading, for the two places that cannot get it from the page.
//
// The homepage renders the widget on the SERVER (`server-demos.tsx`) and that
// is strictly the better path — the reading arrives in the initial HTML. This
// exists for the insert dialog's preview and for a card in a layout the server
// has never seen, both of which are client-only by nature and both of which are
// admin surface.
//
// A read rather than a mutation, which is unusual for an action, but it beats
// the alternative: a route handler would be a second public URL doing the same
// thing with its own cache story. Nothing here is sensitive or parameterised —
// it is the public weather at one fixed place — so there is nothing to
// authorise and nothing an caller could ask it for that it does not already
// give everybody.
// ---------------------------------------------------------------------------

export async function fetchCurrentWeather(): Promise<WeatherReading | null> {
  return getCurrentWeather();
}
