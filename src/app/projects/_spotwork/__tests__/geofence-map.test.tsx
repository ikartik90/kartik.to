import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Wireframe } from "@/components/ui/wireframe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { EXPAND_MAP as EXPAND } from "../copy";
import { GeoContext, type Geo } from "../geo";
import { FRAMES, GeofenceMap, RangeMap } from "../geofence-map";
import { centroid, offset, squareAround, type Geofence, type LatLng, type Place } from "../geofence";

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(() => Promise.reject(new Error("offline"))),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PLACE: Place = { id: "first-gulf", label: "250 First Gulf Boulevard, Brampton, ON", lat: 43.6750237, lng: -79.7143516 };

const FOOTPRINT: Geofence = [
  { lat: 43.6756, lng: -79.7151 },
  { lat: 43.6757, lng: -79.7135 },
  { lat: 43.6744, lng: -79.7134 },
  { lat: 43.6743, lng: -79.715 },
];

function Held({
  place = PLACE,
  initial = null,
  editable,
  onChange,
  onEntranceChange,
}: {
  place?: Place;
  initial?: Geofence | null;
  editable?: boolean;
  onChange?: (fence: Geofence) => void;
  onEntranceChange?: (entrance: LatLng | null) => void;
}) {
  const [fence, setFence] = useState(initial);
  const [entrance, setEntrance] = useState<LatLng | null>(null);
  return (
    <GeofenceMap
      place={place}
      value={fence}
      editable={editable}
      onChange={(next) => {
        setFence(next);
        onChange?.(next);
      }}
      entrance={entrance}
      onEntranceChange={(next) => {
        setEntrance(next);
        onEntranceChange?.(next);
      }}
    />
  );
}

const geo = (overrides: Partial<Geo>): Geo => ({
  suggest: vi.fn(async () => []),
  footprint: vi.fn(async () => null),
  address: vi.fn(async () => null),
  mapKey: null,
  ...overrides,
});

const corners = () => [...document.querySelectorAll<SVGGElement>("[data-anchor]")];
const edges = () => [...document.querySelectorAll<SVGElement>("[data-edge]")];
const addMarker = () => {
  const plus = document.querySelector("[data-add-marker] circle");
  return plus && { x: Number(plus.getAttribute("cx")), y: Number(plus.getAttribute("cy")) };
};
// Where the pointer is to be over a point in the drawing's pixels; jsdom lays the drawing at the window's corner.
const pointerAt = ({ x, y }: { x: number; y: number }) => {
  const drawing = document.querySelector("polygon")!.closest("svg")!;
  return { clientX: x - parseFloat(drawing.style.left), clientY: y - parseFloat(drawing.style.top) };
};
// The wide pin's tip, from its top left.
const pinTip = () => {
  const pin = document.querySelector<SVGElement>("[data-pin]")!;
  return { x: parseFloat(pin.style.left) + 13, y: parseFloat(pin.style.top) + 22 };
};
const fromOutline = ({ x, y }: { x: number; y: number }) =>
  Math.min(
    ...outline().map(([ax, ay], i, ring) => {
      const [bx, by] = ring[(i + 1) % ring.length];
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
    }),
  );
const outline = () =>
  document
    .querySelector("polygon")!
    .getAttribute("points")!
    .split(" ")
    .map((point) => point.split(",").map(Number));

describe("GeofenceMap", () => {
  it("draws the building's footprint from the API until it's edited", async () => {
    const onChange = vi.fn();
    const service = geo({ footprint: vi.fn(async () => FOOTPRINT) });
    render(
      <GeoContext value={service}>
        <Held onChange={onChange} />
      </GeoContext>,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(FOOTPRINT));
    expect(service.footprint).toHaveBeenCalledWith(PLACE, expect.any(AbortSignal));
    expect(corners()).toHaveLength(4);
    expect(outline()).toHaveLength(4);
  });

  it("is a blank box of its size while loading, asking the API for nothing", () => {
    const service = geo({});
    render(
      <GeoContext value={service}>
        <Wireframe mode="loading">
          <Held />
        </Wireframe>
      </GeoContext>,
    );
    const map = document.querySelector("[data-map]")!;
    expect(map.getAttribute("data-size")).toBe("wide");
    expect(map.childElementCount).toBe(0);
    expect(service.footprint).not.toHaveBeenCalled();
  });

  it("keeps a geofence it's given, asking the API for nothing", () => {
    const service = geo({});
    render(
      <GeoContext value={service}>
        <Held initial={FOOTPRINT} />
      </GeoContext>,
    );
    expect(service.footprint).not.toHaveBeenCalled();
    expect(corners()).toHaveLength(4);
  });

  it("stands a square round the address where the API knows no building", async () => {
    const onChange = vi.fn();
    render(
      <GeoContext value={geo({})}>
        <Held onChange={onChange} />
      </GeoContext>,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(squareAround(PLACE)));
  });

  it("moves a dragged corner with the pointer, and the outline with it", () => {
    const onChange = vi.fn();
    render(<Held initial={FOOTPRINT} onChange={onChange} />);
    const before = outline();
    const corner = corners()[1];
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 120, clientY: 90 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 200, clientY: 200 });

    const after = outline();
    expect(after[1][0]).toBeCloseTo(before[1][0] + 20, 6);
    expect(after[1][1]).toBeCloseTo(before[1][1] - 10, 6);
    expect([after[0], after[2], after[3]]).toEqual([before[0], before[2], before[3]]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const [moved] = onChange.mock.calls[0] as [Geofence];
    expect(moved[1].lng).toBeGreaterThan(FOOTPRINT[1].lng);
    expect(moved[1].lat).toBeGreaterThan(FOOTPRINT[1].lat);
    expect([moved[0], moved[2], moved[3]]).toEqual([FOOTPRINT[0], FOOTPRINT[2], FOOTPRINT[3]]);
  });

  it("fills a corner only while it's pressed or dragged", () => {
    render(<Held initial={FOOTPRINT} />);
    const pressed = () => corners().map((corner) => corner.hasAttribute("data-pressed"));
    const corner = corners()[1];
    expect(pressed()).toEqual([false, false, false, false]);
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(pressed()).toEqual([false, true, false, false]);
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 120, clientY: 90 });
    expect(pressed()).toEqual([false, true, false, false]);
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(pressed()).toEqual([false, false, false, false]);
    fireEvent.pointerDown(corner, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(corner, { pointerId: 2 });
    expect(pressed()).toEqual([false, false, false, false]);
  });

  it("shows Add Marker on an edge pointed at, following the pointer along it clear of its corners, until it leaves", () => {
    render(<Held initial={FOOTPRINT} />);
    expect(edges()).toHaveLength(4);
    expect(addMarker()).toBeNull();
    const [[ax, ay], [bx, by]] = outline();
    const length = Math.hypot(bx - ax, by - ay);
    const along = (distance: number, off = 0) => ({
      x: ax + ((bx - ax) * distance - (by - ay) * off) / length,
      y: ay + ((by - ay) * distance + (bx - ax) * off) / length,
    });
    const close = ({ x, y }: { x: number; y: number }) => ({ x: expect.closeTo(x, 6), y: expect.closeTo(y, 6) });

    fireEvent.pointerMove(edges()[0], pointerAt(along(length / 2, 5)));
    expect(addMarker()).toEqual(close(along(length / 2)));
    fireEvent.pointerMove(edges()[0], pointerAt(along(length / 3, -6)));
    expect(addMarker()).toEqual(close(along(length / 3)));
    // A corner's held anywhere in its 16px.
    fireEvent.pointerMove(edges()[0], pointerAt(along(2, 7)));
    expect(addMarker()).toEqual(close(along(8)));
    fireEvent.pointerLeave(edges()[0]);
    expect(addMarker()).toBeNull();
  });

  it("adds a corner where an edge is clicked, between its two, Undo taking it away", () => {
    const onChange = vi.fn();
    render(<Held initial={FOOTPRINT} onChange={onChange} />);
    const before = outline();
    const middle = { x: (before[1][0] + before[2][0]) / 2, y: (before[1][1] + before[2][1]) / 2 };
    fireEvent.pointerMove(edges()[1], pointerAt(middle));
    fireEvent.pointerDown(edges()[1], { pointerId: 1, ...pointerAt(middle) });
    fireEvent.pointerUp(edges()[1], { pointerId: 1, ...pointerAt(middle) });
    fireEvent.click(edges()[1], pointerAt(middle));

    const after = outline();
    expect(after).toHaveLength(5);
    expect(after[2][0]).toBeCloseTo(middle.x, 6);
    expect(after[2][1]).toBeCloseTo(middle.y, 6);
    expect(after.toSpliced(2, 1)).toEqual(before);
    expect(corners()).toHaveLength(5);
    expect(addMarker()).toBeNull();

    const [added] = onChange.mock.lastCall as [Geofence];
    expect(added.toSpliced(2, 1)).toEqual(FOOTPRINT);
    expect(added[2].lat).toBeCloseTo((FOOTPRINT[1].lat + FOOTPRINT[2].lat) / 2, 6);
    expect(added[2].lng).toBeCloseTo((FOOTPRINT[1].lng + FOOTPRINT[2].lng) / 2, 6);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(outline()).toEqual(before);
    expect(onChange).toHaveBeenLastCalledWith(FOOTPRINT);
  });

  it("frames the geofence in the middle of its box, clear of every side, at every size", () => {
    for (const size of ["wide", "small", "large", "location"] as const) {
      render(<GeofenceMap place={PLACE} value={FOOTPRINT} size={size} editable={false} />);
      const { width, height, padding } = FRAMES[size];
      const xs = outline().map(([x]) => x);
      const ys = outline().map(([, y]) => y);
      expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(width, 6);
      expect(Math.min(...ys) + Math.max(...ys)).toBeCloseTo(height, 6);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(padding - 1e-6);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(padding - 1e-6);
      cleanup();
    }
  });

  it("stands its pin on the outline, where the building's entered, and keeps it there as a corner's dragged", () => {
    render(<Held initial={FOOTPRINT} />);
    expect(fromOutline(pinTip())).toBeCloseTo(0, 6);
    const corner = corners()[0];
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(fromOutline(pinTip())).toBeCloseTo(0, 6);
  });

  it("draws its pin at the entrance it's given, on the outline", () => {
    render(<GeofenceMap place={PLACE} value={FOOTPRINT} entrance={FOOTPRINT[2]} editable={false} />);
    const [x, y] = outline()[2];
    expect(pinTip().x).toBeCloseTo(x, 6);
    expect(pinTip().y).toBeCloseTo(y, 6);
  });

  it("drags its pin along the outline, handing back where it's left as the entrance", () => {
    const onEntranceChange = vi.fn();
    render(<Held initial={FOOTPRINT} onEntranceChange={onEntranceChange} />);
    const pin = document.querySelector("[data-pin]")!;
    const drag = (to: { x: number; y: number }) => {
      const from = pinTip();
      fireEvent.pointerDown(pin, { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(pin, { pointerId: 1, clientX: to.x - from.x, clientY: to.y - from.y });
      fireEvent.pointerUp(pin, { pointerId: 1 });
    };
    const [x, y] = outline()[2];
    drag({ x, y });
    expect(pinTip().x).toBeCloseTo(x, 6);
    expect(pinTip().y).toBeCloseTo(y, 6);
    expect(onEntranceChange).toHaveBeenLastCalledWith({ lat: expect.closeTo(FOOTPRINT[2].lat, 9), lng: expect.closeTo(FOOTPRINT[2].lng, 9) });
    // Let go inside the building, or out past it, it stands on the nearest wall.
    drag({ x: x - 40, y: y - 30 });
    expect(fromOutline(pinTip())).toBeCloseTo(0, 6);
    drag({ x: x + 200, y });
    expect(fromOutline(pinTip())).toBeCloseTo(0, 6);
  });

  it("leaves its pin where it is where it isn't editable", () => {
    const onEntranceChange = vi.fn();
    render(<GeofenceMap place={PLACE} value={FOOTPRINT} editable={false} onEntranceChange={onEntranceChange} />);
    const pin = document.querySelector("[data-pin]")!;
    const from = pinTip();
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(pin, { pointerId: 1 });
    expect(onEntranceChange).not.toHaveBeenCalled();
    expect(pinTip()).toEqual(from);
  });

  it("keeps its framing while a corner's dragged", () => {
    render(<Held initial={FOOTPRINT} />);
    const [, , , unmoved] = outline();
    const corner = corners()[1];
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 160, clientY: 40 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(outline()[3]).toEqual(unmoved);
  });

  it("draws its address's building where it isn't editable, keeping it to itself", async () => {
    const onChange = vi.fn();
    render(
      <GeoContext value={geo({ footprint: vi.fn(async () => FOOTPRINT) })}>
        <GeofenceMap place={PLACE} value={null} editable={false} onChange={onChange} />
      </GeoContext>,
    );
    await waitFor(() => expect(outline()).toHaveLength(4));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("frames the worker and the site together, as tightly as keeps both clear of the sides", () => {
    render(<GeofenceMap place={PLACE} value={FOOTPRINT} size="location" editable={false} worker={(fence) => offset(centroid(fence), 7300, 250)} />);
    const { width, height, padding } = FRAMES.location;
    const dot = document.querySelector<SVGElement>("[data-worker]")!;
    const worker = { x: parseFloat(dot.style.left) + 6, y: parseFloat(dot.style.top) + 6 };
    const xs = [...outline().map(([x]) => x), worker.x];
    const ys = [...outline().map(([, y]) => y), worker.y];
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(width, 6);
    expect(Math.min(...xs)).toBeCloseTo(padding, 6);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(padding - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(height - padding + 1e-6);
  });

  it("bows an arc up from a worker off the site to its pin, and none for one inside it", () => {
    render(<GeofenceMap place={PLACE} value={FOOTPRINT} size="location" editable={false} worker={(fence) => offset(centroid(fence), 7300, 250)} />);
    const dot = document.querySelector<SVGElement>("[data-worker]")!;
    const pin = document.querySelector<SVGElement>("[data-pin]")!;
    const [fromX, fromY, bendX, bendY, toX, toY] = document
      .querySelector("[data-arc] path")!
      .getAttribute("d")!
      .match(/-?[\d.]+/g)!
      .map(Number);
    expect(fromX).toBeCloseTo(parseFloat(dot.style.left) + 6, 6);
    expect(fromY).toBeCloseTo(parseFloat(dot.style.top) + 6, 6);
    expect(toX).toBeCloseTo(parseFloat(pin.style.left) + 14, 6);
    expect(toY).toBeCloseTo(parseFloat(pin.style.top) + 25, 6);
    // Off the straight line between them, above its middle.
    const across = (toX - fromX) * (bendY - fromY) - (toY - fromY) * (bendX - fromX);
    expect(Math.abs(across) / Math.hypot(toX - fromX, toY - fromY)).toBeGreaterThan(10);
    expect(bendY).toBeLessThan((fromY + toY) / 2);
    cleanup();

    render(<GeofenceMap place={PLACE} value={FOOTPRINT} size="location" editable={false} worker={(fence) => centroid(fence)} />);
    expect(document.querySelector("[data-worker]")).not.toBeNull();
    expect(document.querySelector("[data-arc]")).toBeNull();
  });

  it("rings a worker whose location can't be tracked where it was last known, their dot and arc marked untracked", () => {
    render(
      <GeofenceMap place={PLACE} value={FOOTPRINT} size="location" editable={false} worker={(fence) => offset(centroid(fence), 7300, 250)} untracked />,
    );
    const dot = document.querySelector<SVGElement>("[data-worker]")!;
    const ring = document.querySelector<HTMLElement>("[data-last-known]")!;
    expect(parseFloat(ring.style.left)).toBeCloseTo(parseFloat(dot.style.left) + 6, 6);
    expect(parseFloat(ring.style.top)).toBeCloseTo(parseFloat(dot.style.top) + 6, 6);
    expect(dot.hasAttribute("data-untracked")).toBe(true);
    expect(document.querySelector("[data-arc]")!.hasAttribute("data-untracked")).toBe(true);
    // Under the dot.
    expect(ring.compareDocumentPosition(dot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    render(<GeofenceMap place={PLACE} value={FOOTPRINT} size="location" editable={false} worker={(fence) => offset(centroid(fence), 7300, 250)} />);
    expect(document.querySelector("[data-worker]")).not.toBeNull();
    expect(document.querySelector("[data-last-known], [data-untracked]")).toBeNull();
  });

  it("draws the geofence without corners to drag or edges to add one to where it isn't editable", () => {
    render(<Held initial={FOOTPRINT} editable={false} />);
    expect(outline()).toHaveLength(4);
    expect(corners()).toHaveLength(0);
    expect(edges()).toHaveLength(0);
  });

  it("without keys, stands a square on the static map and asks nothing of the network", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const onChange = vi.fn();
    render(<Held onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(squareAround(PLACE)));
    expect(document.querySelector("img")).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("loads Google's map with its key, falling back to the static map where it can't", async () => {
    render(
      <GeoContext value={geo({ mapKey: "test-key" })}>
        <Held initial={FOOTPRINT} />
      </GeoContext>,
    );
    expect(setOptions).toHaveBeenCalledWith(expect.objectContaining({ key: "test-key" }));
    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    expect(corners()).toHaveLength(4);
  });

  it("hides Google's businesses, landmarks and stations so only the building stands out", async () => {
    const Map = vi.fn();
    vi.mocked(importLibrary).mockResolvedValueOnce({ Map, OverlayView: class { setMap() {} } } as never);
    render(
      <GeoContext value={geo({ mapKey: "test-key" })}>
        <Held initial={FOOTPRINT} />
      </GeoContext>,
    );
    await waitFor(() => expect(Map).toHaveBeenCalled());
    expect(Map.mock.calls[0][1].styles).toEqual(
      expect.arrayContaining([
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit.station", stylers: [{ visibility: "off" }] },
      ]),
    );
  });
});

describe("GeofenceMap's toolbar", () => {
  // The toolbar's 2.5rem, over the top of the map.
  const TOOLBAR = 40;
  const button = (name: string) => screen.getByRole<HTMLButtonElement>("button", { name });
  const disabled = () => ["Undo", "Redo", "Delete"].map((name) => button(name).disabled);
  const picked = () => corners().map((corner) => corner.hasAttribute("data-selected"));
  const click = (corner: Element) => {
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
  };
  const drag = (corner: Element) => {
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 120, clientY: 90 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
  };

  it("heads an editable map, Undo, Redo and Delete disabled until there's something for them to do", () => {
    render(<Held initial={FOOTPRINT} />);
    expect(disabled()).toEqual([true, true, true]);
  });

  it("isn't there where the map isn't editable", () => {
    render(<GeofenceMap place={PLACE} value={FOOTPRINT} editable={false} />);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("frames the geofence in the middle of the map under it, clear of it", () => {
    render(<Held initial={FOOTPRINT} />);
    const { height, padding } = FRAMES.wide;
    const ys = outline().map(([, y]) => y);
    expect(Math.min(...ys) + Math.max(...ys)).toBeCloseTo(height + TOOLBAR, 6);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(TOOLBAR + padding - 1e-6);
  });

  it("picks a clicked corner, filling it, and Delete takes it away", () => {
    const onChange = vi.fn();
    render(<Held initial={FOOTPRINT} onChange={onChange} />);
    click(corners()[1]);
    expect(picked()).toEqual([false, true, false, false]);
    expect(disabled()).toEqual([true, true, false]);
    fireEvent.click(button("Delete"));
    expect(onChange).toHaveBeenLastCalledWith([FOOTPRINT[0], FOOTPRINT[2], FOOTPRINT[3]]);
    expect(picked()).toEqual([false, false, false]);
    expect(disabled()).toEqual([false, true, true]);
  });

  it("keeps the three corners a geofence needs", () => {
    render(<Held initial={FOOTPRINT.slice(0, 3)} />);
    click(corners()[0]);
    expect(picked()).toEqual([true, false, false]);
    expect(button("Delete").disabled).toBe(true);
  });

  it("doesn't pick a dragged corner, and lets a picked one go when it's dragged", () => {
    render(<Held initial={FOOTPRINT} />);
    drag(corners()[1]);
    expect(picked()).toEqual([false, false, false, false]);
    click(corners()[2]);
    drag(corners()[2]);
    expect(picked()).toEqual([false, false, false, false]);
  });

  it("lets a picked corner go at a press anywhere but the toolbar, or at Escape", () => {
    render(<Held initial={FOOTPRINT} />);
    click(corners()[1]);
    fireEvent.pointerDown(button("Delete"));
    expect(picked()).toEqual([false, true, false, false]);
    fireEvent.pointerDown(document.body);
    expect(picked()).toEqual([false, false, false, false]);
    click(corners()[2]);
    act(() => [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer")));
    expect(picked()).toEqual([false, false, false, false]);
  });

  it("undoes and redoes each drag and deletion, a new edit dropping what could be redone", () => {
    const onChange = vi.fn();
    render(<Held initial={FOOTPRINT} onChange={onChange} />);
    const start = outline();
    drag(corners()[1]);
    const dragged = outline();
    click(corners()[0]);
    fireEvent.click(button("Delete"));
    expect(outline()).toHaveLength(3);
    fireEvent.click(button("Undo"));
    expect(outline()).toEqual(dragged);
    expect(disabled()).toEqual([false, false, true]);
    fireEvent.click(button("Undo"));
    expect(outline()).toEqual(start);
    expect(onChange).toHaveBeenLastCalledWith(FOOTPRINT);
    expect(disabled()).toEqual([true, false, true]);
    fireEvent.click(button("Redo"));
    expect(outline()).toEqual(dragged);
    drag(corners()[2]);
    expect(disabled()).toEqual([false, true, true]);
  });

  it("undoes the pin's move along the outline", () => {
    const onEntranceChange = vi.fn();
    render(<Held initial={FOOTPRINT} onEntranceChange={onEntranceChange} />);
    const pin = document.querySelector("[data-pin]")!;
    const from = pinTip();
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: outline()[2][0] - from.x, clientY: outline()[2][1] - from.y });
    fireEvent.pointerUp(pin, { pointerId: 1 });
    expect(button("Undo").disabled).toBe(false);
    fireEvent.click(button("Undo"));
    expect(pinTip().x).toBeCloseTo(from.x, 6);
    expect(pinTip().y).toBeCloseTo(from.y, 6);
    expect(onEntranceChange).toHaveBeenLastCalledWith(null);
  });

  it("starts afresh at another address", () => {
    const { rerender } = render(<Held initial={FOOTPRINT} />);
    drag(corners()[1]);
    click(corners()[0]);
    rerender(<Held place={{ ...PLACE, id: "elsewhere" }} initial={FOOTPRINT} />);
    expect(disabled()).toEqual([true, true, true]);
    expect(picked()).toEqual([false, false, false, false]);
  });

  // Google's map as far as the switch needs it: a map that takes its type, and a layer added at once.
  const google = () => {
    const setMapTypeId = vi.fn();
    const Map = vi.fn<(element: Element, options: { tilt?: number }) => void>(function (this: object) {
      Object.assign(this, { setCenter() {}, setZoom() {}, setMapTypeId });
    });
    class OverlayView {
      setMap(map: unknown) {
        if (map) (this as unknown as { onAdd(): void }).onAdd();
      }
      getPanes() {
        return { overlayMouseTarget: document.createElement("div") };
      }
      getProjection() {
        return { fromLatLngToDivPixel: () => ({ x: 0, y: 0 }) };
      }
    }
    vi.mocked(importLibrary).mockResolvedValueOnce({ Map, OverlayView } as never);
    return { Map, setMapTypeId };
  };

  it("switches Google's map to satellite, labelled, and back, held flat under the geofence", async () => {
    const { Map, setMapTypeId } = google();
    render(
      <GeoContext value={geo({ mapKey: "test-key" })}>
        <Held initial={FOOTPRINT} />
      </GeoContext>,
    );
    await waitFor(() => expect(setMapTypeId).toHaveBeenLastCalledWith("roadmap"));
    expect(Map.mock.calls[0][1].tilt).toBe(0);
    expect(screen.getByRole("group", { name: "View" })).not.toBeNull();
    expect(button("Map").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button("Satellite"));
    expect(setMapTypeId).toHaveBeenLastCalledWith("hybrid");
    expect(button("Satellite").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button("Map"));
    expect(setMapTypeId).toHaveBeenLastCalledWith("roadmap");
  });

  it("has no satellite switch over the static map, or where Google's map can't load", async () => {
    render(<Held initial={FOOTPRINT} />);
    expect(screen.queryByRole("button", { name: "Satellite" })).toBeNull();
    cleanup();
    render(
      <GeoContext value={geo({ mapKey: "test-key" })}>
        <Held initial={FOOTPRINT} />
      </GeoContext>,
    );
    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());
    expect(screen.queryByRole("button", { name: "Satellite" })).toBeNull();
  });
});

describe("RangeMap", () => {
  const middleOf = (points: number[][]) => ({
    x: (Math.min(...points.map(([x]) => x)) + Math.max(...points.map(([x]) => x))) / 2,
    y: (Math.min(...points.map(([, y]) => y)) + Math.max(...points.map(([, y]) => y))) / 2,
  });
  const drag = (by: { x: number; y: number }, letGo = true) => {
    const pin = document.querySelector<SVGElement>("[data-pin][data-draggable]")!;
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 100 + by.x, clientY: 100 + by.y });
    if (letGo) fireEvent.pointerUp(pin, { pointerId: 1 });
  };

  it("marks the address with the map's pin, its tip in the middle of the range's circle, and no worker's dot", () => {
    render(<RangeMap place={PLACE} km={5} />);
    expect(pinTip().x).toBeCloseTo(middleOf(outline()).x, 0);
    expect(pinTip().y).toBeCloseTo(middleOf(outline()).y, 0);
    expect(document.querySelector("[data-place], [data-worker]")).toBeNull();
    expect(document.querySelector("[data-pin][data-draggable]")).toBeNull();
  });

  it("drags its pin wide, the circle following, and moves the place only where it's let go", () => {
    const onMove = vi.fn();
    render(<RangeMap place={PLACE} km={5} onMove={onMove} />);
    const [tip, middle] = [pinTip(), middleOf(outline())];
    drag({ x: 40, y: -20 }, false);
    expect(pinTip().x).toBeCloseTo(tip.x + 40, 0);
    expect(pinTip().y).toBeCloseTo(tip.y - 20, 0);
    expect(middleOf(outline()).x).toBeCloseTo(middle.x + 40, 0);
    expect(middleOf(outline()).y).toBeCloseTo(middle.y - 20, 0);
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.pointerUp(document.querySelector("[data-pin]")!, { pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    const [to] = onMove.mock.calls[0] as [LatLng];
    expect(to.lng).toBeGreaterThan(PLACE.lng);
    expect(to.lat).toBeGreaterThan(PLACE.lat);
  });

  it("holds its view for the place its pin was let go at, and frames any other afresh", () => {
    const onMove = vi.fn();
    const { rerender } = render(<RangeMap place={PLACE} km={5} onMove={onMove} />);
    const tip = pinTip();
    drag({ x: 40, y: -20 });
    const [to] = onMove.mock.calls[0] as [LatLng];
    rerender(<RangeMap place={{ id: "dropped", label: "Dropped", ...to }} km={5} onMove={onMove} />);
    expect(pinTip().x).toBeCloseTo(tip.x + 40, 0);
    expect(pinTip().y).toBeCloseTo(tip.y - 20, 0);
    rerender(<RangeMap place={{ id: "far", label: "Far", lat: 43.65, lng: -79.38 }} km={5} onMove={onMove} />);
    expect(pinTip().x).toBeCloseTo(tip.x, 0);
    expect(pinTip().y).toBeCloseTo(tip.y, 0);
  });

  it("is a button mini, opening wide when pressed, its pin held still", () => {
    const onExpand = vi.fn();
    render(<RangeMap place={PLACE} km={5} size="mini" onExpand={onExpand} onMove={() => {}} />);
    expect(document.querySelector("[data-pin][data-draggable]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: EXPAND }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
