import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { createContext } from "react";
import type { Geofence, LatLng, Place } from "./geofence";

// Where an address comes from: Google's Places, which suggests them in the US and Canada and finds the one picked,
// and its geocoder, which names a point. A building's outline is Geoapify's, through the prototype's own route, which
// holds its key. The context's default asks the network for nothing, so the live figures and the tests never do; the
// full-screen prototype provides `ONLINE`.

/** An address suggested for what's typed, found in full once it's picked. */
export interface Suggestion {
  id: string;
  label: string;
  place(): Promise<Place | null>;
}

export interface Geo {
  /** The addresses suggested for what's typed. */
  suggest(text: string, signal?: AbortSignal): Promise<Suggestion[]>;
  /** The outline of the building at a place, or null where none is known. */
  footprint(place: Place, signal?: AbortSignal): Promise<Geofence | null>;
  /** The address at a point, or null where none is known. */
  address(at: LatLng, signal?: AbortSignal): Promise<Place | null>;
  /** Google Maps' key, where the map is Google's rather than the static picture. */
  mapKey: string | null;
}

/** The company's site, CCLS at First Gulf, which a new template starts at. */
export const COMPANY_PLACE: Place = {
  id: "osm-way-97308751",
  label: "250 First Gulf Boulevard, Brampton, ON",
  city: "Brampton",
  lat: 43.6750237,
  lng: -79.7143516,
  timezone: "America/Toronto",
};

/** Where CCLS's building at First Gulf is entered. */
const COMPANY_ENTRANCE: LatLng = { lat: 43.6750896, lng: -79.7128896 };

/** The entrance a template at `place` starts with: CCLS's door at First Gulf, elsewhere none, for the wall nearest the address. */
export const entranceAt = (place: Place | null) => (place?.id === COMPANY_PLACE.id ? COMPANY_ENTRANCE : null);

/** A place already known, suggested as itself. */
export const suggestionOf = (place: Place): Suggestion => ({ id: place.id, label: place.label, place: async () => place });

/** GoodLeaf Farms' farm, where the activation demo puts its team. */
export const GOODLEAF_PLACE: Place = {
  id: "osm-way-802538841",
  label: "35 Cooper Drive, Guelph, ON",
  city: "Guelph",
  lat: 43.4852796,
  lng: -80.2127833,
  timezone: "America/Toronto",
};

const OFFLINE_PLACES = [COMPANY_PLACE, GOODLEAF_PLACE];

const wordsOf = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** The places each of whose typed words begins one of theirs: what's still worth suggesting as more is typed. */
export function narrowed<T extends { label: string }>(places: T[], typed: string) {
  const words = wordsOf(typed);
  return words.length
    ? places.filter((place) => {
        const own = wordsOf(place.label);
        return words.every((word) => own.some((that) => that.startsWith(word)));
      })
    : [];
}

const offlineSuggestions = async (text: string) => narrowed(OFFLINE_PLACES, text).map(suggestionOf);

export const OFFLINE: Geo = { suggest: offlineSuggestions, footprint: async () => null, address: async () => null, mapKey: null };

let keyed = false;

/** Gives Google its key, once, before any of its libraries load. */
export function keyGoogle(key: string) {
  if (keyed) return;
  keyed = true;
  setOptions({ key, v: "weekly" });
}

const REGIONS = ["us", "ca"];

// Google bills an address's suggestions and the place picked from them as one session.
let session: google.maps.places.AutocompleteSessionToken | null = null;

async function googleSuggestions(key: string, text: string): Promise<Suggestion[]> {
  keyGoogle(key);
  const { AutocompleteSuggestion, AutocompleteSessionToken } = await importLibrary("places");
  session ??= new AutocompleteSessionToken();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: text,
    includedRegionCodes: REGIONS,
    sessionToken: session,
  });
  return suggestions.flatMap(({ placePrediction: prediction }) => {
    if (!prediction) return [];
    const label = prediction.text.toString();
    return [{ id: prediction.placeId, label, place: () => googlePlace(prediction, label) }];
  });
}

async function googlePlace(prediction: google.maps.places.PlacePrediction, label: string): Promise<Place | null> {
  session = null;
  const { place } = await prediction.toPlace().fetchFields({ fields: ["location", "addressComponents", "timeZone"] });
  if (!place.location) return null;
  const city = place.addressComponents?.find((part) => part.types.includes("locality"))?.longText;
  const timezone = place.timeZone?.id;
  return {
    id: prediction.placeId,
    label,
    ...(city && { city }),
    lat: place.location.lat(),
    lng: place.location.lng(),
    ...(timezone && { timezone }),
  };
}

async function googleAddress(key: string, at: LatLng): Promise<Place | null> {
  keyGoogle(key);
  const { Geocoder } = await importLibrary("geocoding");
  const [found] = (await new Geocoder().geocode({ location: at })).results;
  if (!found) return null;
  const city = found.address_components.find((part) => part.types.includes("locality"))?.long_name;
  return { id: found.place_id, label: found.formatted_address, ...(city && { city }), ...at };
}

const ROUTE = "/api/building-outline";

async function ask<T>(query: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(`${ROUTE}?${query}`, { signal });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The prototype's addresses from Google, given its key, and its buildings from Geoapify. */
export const online = (mapKey: string | null): Geo => ({
  async suggest(text) {
    if (!mapKey) return offlineSuggestions(text);
    return googleSuggestions(mapKey, text).catch(() => offlineSuggestions(text));
  },
  async footprint({ lat, lng }, signal) {
    const answer = await ask<{ footprint: Geofence | null }>(new URLSearchParams({ lat: `${lat}`, lng: `${lng}` }).toString(), signal);
    return answer?.footprint ?? null;
  },
  async address(at) {
    return mapKey ? googleAddress(mapKey, at).catch(() => null) : null;
  },
  mapKey,
});

export const ONLINE = online(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null);

export const GeoContext = createContext<Geo>(OFFLINE);
