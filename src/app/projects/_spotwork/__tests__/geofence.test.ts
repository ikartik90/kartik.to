import { describe, expect, it } from "vitest";
import { alongEdge, centroid, footprintOf, framing, fromWorldPixel, inside, lowered, moveAnchor, offset, onOutline, squareAround, worldPixel, type LatLng } from "../geofence";

const PLACE = { lat: 43.6750237, lng: -79.7143516 };

// Geoapify Place Details' features=building: GeoJSON, rings of [lon, lat] closed on their first point.
const building = (coordinates: number[][][]) => ({
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { feature_type: "details" }, geometry: { type: "Point", coordinates: [-79.7143, 43.675] } },
    { type: "Feature", properties: { feature_type: "building" }, geometry: { type: "Polygon", coordinates } },
  ],
});

describe("footprintOf", () => {
  it("reads the building's outer ring as corners, without the ring's closing point", () => {
    const ring = [
      [-79.715, 43.676],
      [-79.713, 43.676],
      [-79.713, 43.674],
      [-79.715, 43.674],
      [-79.715, 43.676],
    ];
    expect(footprintOf(building([ring, [[-79.714, 43.675], [-79.7139, 43.675], [-79.7139, 43.6749], [-79.714, 43.675]]]))).toEqual([
      { lat: 43.676, lng: -79.715 },
      { lat: 43.676, lng: -79.713 },
      { lat: 43.674, lng: -79.713 },
      { lat: 43.674, lng: -79.715 },
    ]);
  });

  it("takes the largest part of a building drawn in several", () => {
    const small = [[-79.7, 43.6], [-79.6999, 43.6], [-79.6999, 43.5999], [-79.7, 43.6]];
    const large = [[-79.715, 43.676], [-79.713, 43.676], [-79.713, 43.674], [-79.715, 43.676]];
    const response = {
      features: [{ properties: { feature_type: "building" }, geometry: { type: "MultiPolygon", coordinates: [[small], [large]] } }],
    };
    expect(footprintOf(response)).toEqual([
      { lat: 43.676, lng: -79.715 },
      { lat: 43.676, lng: -79.713 },
      { lat: 43.674, lng: -79.713 },
    ]);
  });

  it("is null where there's no building, or nothing it can read", () => {
    expect(footprintOf({ features: [{ properties: { feature_type: "details" }, geometry: { type: "Point", coordinates: [0, 0] } }] })).toBeNull();
    expect(footprintOf({})).toBeNull();
    expect(footprintOf(null)).toBeNull();
  });
});

describe("the geofence's geometry", () => {
  it("stands a square round a place, its corners the same distance away", () => {
    const square = squareAround(PLACE);
    expect(square).toHaveLength(4);
    const centre = worldPixel(PLACE, 20);
    const reach = square.map((corner) => {
      const { x, y } = worldPixel(corner, 20);
      return [Math.round(x - centre.x), Math.round(y - centre.y)];
    });
    const [dx, dy] = reach[0].map(Math.abs);
    expect(dx).toBeGreaterThan(0);
    expect(reach).toEqual([
      [-dx, -dy],
      [dx, -dy],
      [dx, dy],
      [-dx, dy],
    ]);
  });

  it("finds a place again from its pixel", () => {
    const back = fromWorldPixel(worldPixel(PLACE, 17), 17);
    expect(back.lat).toBeCloseTo(PLACE.lat, 9);
    expect(back.lng).toBeCloseTo(PLACE.lng, 9);
  });

  it("moves one corner, leaving the rest", () => {
    const square = squareAround(PLACE);
    const moved = moveAnchor(square, 2, { lat: 1, lng: 2 });
    expect(moved).toEqual([square[0], square[1], { lat: 1, lng: 2 }, square[3]]);
    expect(square[2]).not.toEqual({ lat: 1, lng: 2 });
  });
});

// CCLS's building at 250 First Gulf, a long rectangle on the diagonal.
const BUILDING: LatLng[] = [
  { lat: 43.6756, lng: -79.7151 },
  { lat: 43.6757, lng: -79.7135 },
  { lat: 43.6744, lng: -79.7134 },
  { lat: 43.6743, lng: -79.715 },
];

describe("framing", () => {
  const BOX = { width: 600, height: 300 };
  const PADDING = 48;
  const offCentre = (points: LatLng[], { center, zoom }: { center: LatLng; zoom: number }) => {
    const middle = worldPixel(center, zoom);
    return points.map((point) => {
      const { x, y } = worldPixel(point, zoom);
      return { x: x - middle.x, y: y - middle.y };
    });
  };
  const fits = (points: LatLng[], view: { center: LatLng; zoom: number }) =>
    offCentre(points, view).every(({ x, y }) => Math.abs(x) <= BOX.width / 2 - PADDING + 1e-6 && Math.abs(y) <= BOX.height / 2 - PADDING + 1e-6);
  const touches = (points: LatLng[], view: { center: LatLng; zoom: number }) =>
    offCentre(points, view).some(({ x, y }) => Math.abs(Math.abs(x) - (BOX.width / 2 - PADDING)) < 1e-6 || Math.abs(Math.abs(y) - (BOX.height / 2 - PADDING)) < 1e-6);

  it("puts the middle of the fence's bounds in the middle of the box", () => {
    const view = framing(BUILDING, BOX, PADDING, 21);
    const xs = offCentre(BUILDING, view).map(({ x }) => x);
    const ys = offCentre(BUILDING, view).map(({ y }) => y);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...ys) + Math.max(...ys)).toBeCloseTo(0, 6);
  });

  it("zooms in as far as keeps every corner the padding clear of each side", () => {
    const view = framing(BUILDING, BOX, PADDING, 21);
    expect(fits(BUILDING, view)).toBe(true);
    expect(touches(BUILDING, view)).toBe(true);
  });

  it("stops at the closest zoom it's allowed", () => {
    expect(framing(squareAround(PLACE, 1), BOX, PADDING, 19).zoom).toBe(19);
  });
});

describe("lowered", () => {
  it("moves what a view centres down the box by as many pixels, at the same zoom", () => {
    const view = framing(BUILDING, { width: 600, height: 300 }, 48, 21);
    const low = lowered(view, 20);
    const was = worldPixel(view.center, view.zoom);
    const now = worldPixel(low.center, low.zoom);
    expect(low.zoom).toBe(view.zoom);
    expect(was.x - now.x).toBeCloseTo(0, 6);
    expect(was.y - now.y).toBeCloseTo(20, 6);
  });
});

describe("centroid", () => {
  it("is the middle of a square", () => {
    const middle = centroid(squareAround(PLACE));
    expect(middle.lat).toBeCloseTo(PLACE.lat, 9);
    expect(middle.lng).toBeCloseTo(PLACE.lng, 9);
  });

  it("weighs a shape by its area, not its corners", () => {
    const crowded = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.5 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 1.5 },
      { lat: 0, lng: 2 },
      { lat: 2, lng: 2 },
      { lat: 2, lng: 0 },
    ];
    expect(centroid(crowded).lng).toBeCloseTo(1, 9);
    expect(centroid(crowded).lat).toBeCloseTo(1, 9);
  });
});

describe("onOutline", () => {
  const SQUARE = squareAround(PLACE, 40);
  const NORTH = PLACE.lat + 40 / 111_320;

  it("stands on the wall nearest an address out in the street, across from it", () => {
    const door = onOutline(SQUARE, offset(PLACE, 100, 0));
    expect(door.lat).toBeCloseTo(NORTH, 9);
    expect(door.lng).toBeCloseTo(PLACE.lng, 9);
  });

  it("stands on the nearest wall when the address falls inside the building", () => {
    const door = onOutline(SQUARE, offset(PLACE, 30, 0));
    expect(door.lat).toBeCloseTo(NORTH, 9);
    expect(door.lng).toBeCloseTo(PLACE.lng, 9);
  });

  it("stands on the corner nearest an address off past it", () => {
    expect(onOutline(SQUARE, offset(SQUARE[1], 100, 45))).toEqual({ lat: expect.closeTo(SQUARE[1].lat, 9), lng: expect.closeTo(SQUARE[1].lng, 9) });
  });
});

describe("alongEdge", () => {
  const A = { x: 0, y: 0 };
  const B = { x: 100, y: 0 };
  const at = (x: number, y: number) => ({ x: expect.closeTo(x, 9), y: expect.closeTo(y, 9) });

  it("stands on the edge across from a point beside it", () => {
    expect(alongEdge(A, B, { x: 30, y: 6 }, 8)).toEqual(at(30, 0));
    expect(alongEdge({ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 19, y: 17 }, 8)).toEqual(at(15, 20));
  });

  it("keeps the margin clear of either corner", () => {
    expect(alongEdge(A, B, { x: 3, y: -5 }, 8)).toEqual(at(8, 0));
    expect(alongEdge(A, B, { x: 140, y: 2 }, 8)).toEqual(at(92, 0));
  });

  it("stands in the middle of an edge too short to keep the margin clear of both corners", () => {
    expect(alongEdge(A, { x: 12, y: 0 }, { x: 2, y: 1 }, 8)).toEqual(at(6, 0));
    expect(alongEdge(A, A, { x: 2, y: 1 }, 8)).toEqual(A);
  });
});

describe("inside", () => {
  const SQUARE = squareAround(PLACE, 40);

  it("holds a place within the walls, not one out past them", () => {
    expect(inside(SQUARE, PLACE)).toBe(true);
    expect(inside(SQUARE, offset(PLACE, 30, 120))).toBe(true);
    expect(inside(SQUARE, offset(PLACE, 50, 0))).toBe(false);
    expect(inside(SQUARE, offset(PLACE, 7300, 250))).toBe(false);
  });

  it("leaves out the notch of a building shaped like an L", () => {
    const [nw, ne, se, sw] = SQUARE;
    const middle = { lat: PLACE.lat, lng: PLACE.lng };
    const ell = [nw, { lat: nw.lat, lng: middle.lng }, middle, { lat: middle.lat, lng: ne.lng }, se, sw];
    expect(inside(ell, offset(PLACE, 20, 45))).toBe(false);
    expect(inside(ell, offset(PLACE, 20, 225))).toBe(true);
  });
});

describe("offset", () => {
  it("moves a place the metres given along a bearing, clockwise from north", () => {
    const north = offset(PLACE, 1000, 0);
    expect(north.lat).toBeCloseTo(PLACE.lat + 1000 / 111_320, 9);
    expect(north.lng).toBeCloseTo(PLACE.lng, 9);
    const east = offset(PLACE, 1000, 90);
    expect(east.lat).toBeCloseTo(PLACE.lat, 9);
    expect(east.lng).toBeGreaterThan(PLACE.lng);
    expect(offset(PLACE, 0, 250)).toEqual(PLACE);
  });
});
