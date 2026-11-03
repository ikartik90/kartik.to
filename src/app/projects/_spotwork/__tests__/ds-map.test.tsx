import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPAND_MAP, LOCATION_HISTORY } from "../copy";
import { MAP_STORIES } from "../ds-map";
import { COMPANY_PLACE, GeoContext, type Geo } from "../geo";
import type { Geofence } from "../geofence";
import { renderStories } from "./story-harness";

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(() => Promise.reject(new Error("offline"))),
}));

afterEach(cleanup);

// CCLS's building at First Gulf, six corners.
const BUILDING: Geofence = [
  { lat: 43.6757, lng: -79.7152 },
  { lat: 43.6758, lng: -79.7136 },
  { lat: 43.6751, lng: -79.7135 },
  { lat: 43.6744, lng: -79.7134 },
  { lat: 43.6743, lng: -79.715 },
  { lat: 43.675, lng: -79.7151 },
];

const outline = (map: HTMLElement) => map.querySelector("polygon")?.getAttribute("points");
const cornersOf = (map: HTMLElement) => outline(map)?.split(" ").length;

/** The stories, given Geoapify's `footprint`. */
function setup(footprint: Geo["footprint"] = async () => null) {
  const geo: Geo = { suggest: async () => [], footprint: vi.fn(footprint), address: async () => null, mapKey: null };
  const wrapper = ({ children }: { children: ReactNode }) => <GeoContext value={geo}>{children}</GeoContext>;
  return { geo, ...renderStories(MAP_STORIES, wrapper) };
}

describe("the Maps page's examples", () => {
  it("shows Geofencing Polygon, editable then read-only, then Location Tracking, its location history last", () => {
    const { titles } = setup();
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Geofencing Polygon",
      "Location Tracking",
      "Range",
    ]);
    expect(titles("Geofencing Polygon")).toEqual(["Read-only"]);
    expect(titles("Location Tracking")).toEqual(["Location disabled", LOCATION_HISTORY.example]);
    expect(titles("Range")).toEqual(["Mini"]);
  });

  it("drags Range's pin, its circle following, and widens the mini one when it's pressed", () => {
    const { preview } = setup();
    const map = preview("Range");
    const pin = map.querySelector("[data-pin][data-draggable]")!;
    const before = outline(map);
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 130, clientY: 90 });
    fireEvent.pointerUp(pin, { pointerId: 1 });
    expect(outline(map)).not.toBe(before);
    const mini = preview("Range", "Mini");
    expect(mini.querySelector("[data-pin][data-draggable]")).toBeNull();
    fireEvent.click(within(mini).getByRole("button", { name: EXPAND_MAP }));
    expect(mini.querySelector("[data-map]")!.getAttribute("data-size")).toBe("wide");
    expect(mini.querySelector("[data-pin][data-draggable]")).not.toBeNull();
  });

  it("outlines the address's building, looked up for it, in both of Geofencing Polygon's versions", async () => {
    const { geo, preview } = setup(async () => BUILDING);
    for (const map of [preview("Geofencing Polygon"), preview("Geofencing Polygon", "Read-only")])
      await waitFor(() => expect(cornersOf(map)).toBe(BUILDING.length));
    expect(geo.footprint).toHaveBeenCalledWith(COMPANY_PLACE, expect.anything());
  });

  it("drags the editable polygon's corners and pin, and keeps a corner where it's dragged", async () => {
    const { preview } = setup(async () => BUILDING);
    const map = preview("Geofencing Polygon");
    await waitFor(() => expect(map.querySelectorAll("[data-anchor]")).toHaveLength(BUILDING.length));
    expect(map.querySelector("[data-pin][data-draggable]")).not.toBeNull();
    const before = outline(map);
    const corner = map.querySelector<SVGGElement>("[data-anchor]")!;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 120, clientY: 90 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(outline(map)).not.toBe(before);
    expect(map.querySelector("[data-worker]")).toBeNull();
  });

  it("draws the read-only polygon with no corners or pin to drag", async () => {
    const { preview } = setup(async () => BUILDING);
    const map = preview("Geofencing Polygon", "Read-only");
    await waitFor(() => expect(cornersOf(map)).toBe(BUILDING.length));
    expect(map.querySelector("[data-anchor], [data-pin][data-draggable], [data-worker]")).toBeNull();
  });

  it("draws a worker off the job site with an arc to its pin, over a geofence that doesn't drag", async () => {
    const { preview } = setup();
    const map = preview("Location Tracking");
    await waitFor(() => expect(map.querySelector("[data-worker]")).not.toBeNull());
    expect(map.querySelector("polygon")).not.toBeNull();
    expect(map.querySelector("[data-arc]")).not.toBeNull();
    expect(map.querySelector("[data-anchor], [data-pin][data-draggable]")).toBeNull();
    expect(within(map).queryByRole("dialog")).toBeNull();
    expect(map.querySelector("[data-last-known], [data-untracked]")).toBeNull();
  });

  it("rings a worker whose location is disabled where it was last known, their dot and arc marked untracked", async () => {
    const { preview } = setup();
    const map = preview("Location Tracking", "Location disabled");
    await waitFor(() => expect(map.querySelector("[data-worker][data-untracked]")).not.toBeNull());
    expect(map.querySelector("[data-arc][data-untracked]")).not.toBeNull();
    expect(map.querySelector("[data-last-known]")).not.toBeNull();
  });

  it("plays a worker's location history under Location Tracking's map, with no arc to its pin", async () => {
    const { preview } = setup();
    const map = preview("Location Tracking", LOCATION_HISTORY.example);
    await waitFor(() => expect(map.querySelector("[data-worker]")).not.toBeNull());
    expect(within(map).getByRole("slider", { name: LOCATION_HISTORY.timeline })).toBeDefined();
    expect(within(map).getByRole("button", { name: LOCATION_HISTORY.play })).toBeDefined();
    expect(map.querySelector("[data-trail]")).not.toBeNull();
    expect(map.querySelector("[data-arc], [data-untracked]")).toBeNull();
  });
});

