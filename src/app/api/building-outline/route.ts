import { z } from "zod";
import { footprintOf } from "@/app/projects/_spotwork/geofence";

// Geoapify for the Spotwork prototype's geofences, its key kept on the server: `?lat=&lng=` answers with the outline of
// the building there. Without a key, or when Geoapify fails, the answer is null and the map draws its own square.
// Answers are remembered, since Geoapify can take seconds. Only the site's own pages are answered, and only for points
// in the United States and Canada, where the prototype's addresses are; outlines found are kept by the CDN.

const API = "https://api.geoapify.com";

/** How far from an address's point, in metres, its building may be. */
const BUILDING_REACH = 100;

// The United States and Canada, as a box: Alaska to Newfoundland, the Florida Keys to the Arctic.
const POINT = z.object({
  lat: z.coerce.number().min(24).max(84),
  lng: z.coerce.number().min(-170).max(-52),
});

// A building doesn't move: a month at the edge, a day more while it asks again.
const KEPT = "public, s-maxage=2592000, stale-while-revalidate=86400";

const REMEMBERED = 500;
const remembered = new Map<string, unknown>();

function remember(question: string, answer: unknown) {
  if (remembered.size >= REMEMBERED) remembered.delete(remembered.keys().next().value!);
  remembered.set(question, answer);
}

async function geoapify(path: string, params: Record<string, string>) {
  try {
    const response = await fetch(`${API}${path}?${new URLSearchParams(params)}`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// An address's point often sits on the street, outside any building, so the building is the nearest one to it.
async function footprint(lat: number, lon: number, apiKey: string) {
  const near = await geoapify("/v2/places", {
    categories: "building",
    filter: `circle:${lon},${lat},${BUILDING_REACH}`,
    bias: `proximity:${lon},${lat}`,
    limit: "1",
    apiKey,
  });
  const id = near?.features?.[0]?.properties?.place_id;
  if (typeof id !== "string") return null;
  const found = await geoapify("/v2/place-details", { id, features: "building", apiKey });
  return found && footprintOf(found);
}

export async function GET(request: Request) {
  // Browsers mark where a fetch came from; one without the mark is let through, as the mark can be forged anyway.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response(null, { status: 403 });
  const apiKey = process.env.GEOAPIFY_API_KEY;
  const query = new URL(request.url).searchParams;
  const point = POINT.safeParse({ lat: query.get("lat") ?? undefined, lng: query.get("lng") ?? undefined });
  if (!apiKey || !point.success) return Response.json({ footprint: null });
  const { lat, lng } = point.data;
  const question = `${lat},${lng}`;
  const answer = remembered.get(question) ?? (await footprint(lat, lng, apiKey));
  if (!answer) return Response.json({ footprint: null });
  remember(question, answer);
  return Response.json({ footprint: answer }, { headers: { "Cache-Control": KEPT } });
}
