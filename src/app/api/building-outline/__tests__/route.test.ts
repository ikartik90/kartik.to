import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

// The prototype's own fetch, which browsers mark as from the same site.
const SAME_SITE = { "sec-fetch-site": "same-origin" };
const answer = (query: string, headers: Record<string, string> = SAME_SITE) =>
  GET(new Request(`http://localhost/api/building-outline?${query}`, { headers }));
const ask = async (query: string, headers?: Record<string, string>) => (await answer(query, headers)).json();

const BUILDING = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { feature_type: "building" },
      geometry: { type: "Polygon", coordinates: [[[-79.715, 43.676], [-79.713, 43.676], [-79.713, 43.674], [-79.715, 43.676]]] },
    },
  ],
};

let fetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("GEOAPIFY_API_KEY", "geo-key");
  fetch = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const called = (call = 0) => new URL(String(fetch.mock.calls[call][0]));

describe("the building outline route", () => {
  it("answers with the outline of the building nearest the point: Places finds it, Place Details draws it", async () => {
    // An address often sits on the street, outside any building.
    fetch
      .mockResolvedValueOnce(Response.json({ features: [{ properties: { place_id: "near-1", distance: 24 } }] }))
      .mockResolvedValueOnce(Response.json(BUILDING));
    expect(await ask("lat=43.675&lng=-79.714")).toEqual({
      footprint: [
        { lat: 43.676, lng: -79.715 },
        { lat: 43.676, lng: -79.713 },
        { lat: 43.674, lng: -79.713 },
      ],
    });
    const places = called();
    expect(places.origin + places.pathname).toBe("https://api.geoapify.com/v2/places");
    expect(Object.fromEntries(places.searchParams)).toMatchObject({
      categories: "building",
      filter: "circle:-79.714,43.675,100",
      bias: "proximity:-79.714,43.675",
      limit: "1",
      apiKey: "geo-key",
    });
    const details = called(1);
    expect(details.origin + details.pathname).toBe("https://api.geoapify.com/v2/place-details");
    expect(Object.fromEntries(details.searchParams)).toMatchObject({ id: "near-1", features: "building", apiKey: "geo-key" });
  });

  it("answers null where no building is near, asking for no outline", async () => {
    fetch.mockResolvedValueOnce(Response.json({ type: "FeatureCollection", features: [] }));
    expect(await ask("lat=43.6&lng=-79.6")).toEqual({ footprint: null });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("answers nothing but outlines, asking Geoapify nothing for what's typed", async () => {
    expect(await ask("text=250%20First%20Gulf")).toEqual({ footprint: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  // Places finds the building near a point, Place Details draws it.
  const building = async (url: string | URL | Request) =>
    String(url).includes("/v2/places?") ? Response.json({ features: [{ properties: { place_id: "near-1" } }] }) : Response.json(BUILDING);

  it("answers no other site, calling nothing", async () => {
    for (const site of ["cross-site", "same-site"]) {
      const response = await answer("lat=43.675&lng=-79.714", { "sec-fetch-site": site });
      expect(response.status).toBe(403);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answers null outside the United States and Canada, calling nothing", async () => {
    for (const query of ["lat=51.5072&lng=-0.1276", "lat=-33.87&lng=151.21", "lat=19.43&lng=-99.13", "lat=abc&lng=-79.7"])
      expect(await ask(query)).toEqual({ footprint: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets the CDN keep an outline it found, and nothing else", async () => {
    fetch.mockImplementation(building);
    const found = await answer("lat=43.673&lng=-79.714");
    expect(found.headers.get("cache-control")).toMatch(/\bs-maxage=\d+/);
    fetch.mockRejectedValueOnce(new Error("offline"));
    const failed = await answer("lat=43.674&lng=-79.9");
    expect(failed.headers.get("cache-control") ?? "").not.toMatch(/s-maxage/);
  });

  it("answers null without a key, calling nothing", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    expect(await ask("lat=43.675&lng=-79.714")).toEqual({ footprint: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("answers null where Geoapify fails", async () => {
    fetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    expect(await ask("lat=43.8&lng=-79.9")).toEqual({ footprint: null });
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await ask("lat=43.9&lng=-79.9")).toEqual({ footprint: null });
  });

  it("answers a question it's been asked before from memory, not Geoapify", async () => {
    fetch.mockImplementation(building);
    const first = await ask("lat=43.671&lng=-79.714");
    expect(first.footprint).toHaveLength(3);
    expect(await ask("lat=43.671&lng=-79.714")).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("asks again after a failure, remembering only answers", async () => {
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await ask("lat=43.672&lng=-79.714")).toEqual({ footprint: null });
    fetch.mockImplementation(building);
    expect((await ask("lat=43.672&lng=-79.714")).footprint).toHaveLength(3);
  });
});
