// A template's geofence: the outline of its building, corner by corner, as a map draws and drags it.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  id: string;
  label: string;
  city?: string;
  /** Its IANA timezone, as "America/Toronto". */
  timezone?: string;
}

export type Geofence = LatLng[];

export interface Point {
  x: number;
  y: number;
}

type Ring = number[][];
type Geometry = { type?: string; coordinates?: unknown };
type Feature = { properties?: { feature_type?: string }; geometry?: Geometry };

const TILE = 256;

/** Web Mercator, as Google's tiles are drawn: the place's pixel in the whole world's map at `zoom`. */
export function worldPixel({ lat, lng }: LatLng, zoom: number): Point {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

export function fromWorldPixel({ x, y }: Point, zoom: number): LatLng {
  const size = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / size;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / size) * 360 - 180 };
}

const METRES_PER_DEGREE = 111_320;
// Close enough in that a building spans whole pixels, for the arithmetic's sake.
const ENTRANCE_ZOOM = 20;

/** The stand-in geofence where no building is known: a square `reach` metres from the place each way. */
export function squareAround({ lat, lng }: LatLng, reach = 40): Geofence {
  const dLat = reach / METRES_PER_DEGREE;
  const dLng = reach / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat + dLat, lng: lng - dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat - dLat, lng: lng + dLng },
    { lat: lat - dLat, lng: lng - dLng },
  ];
}

export function moveAnchor(fence: Geofence, index: number, to: LatLng): Geofence {
  return fence.map((corner, i) => (i === index ? to : corner));
}

/** A place `metres` away along `bearing`, in degrees clockwise from north. */
export function offset({ lat, lng }: LatLng, metres: number, bearing: number): LatLng {
  const turn = (bearing * Math.PI) / 180;
  return {
    lat: lat + (metres * Math.cos(turn)) / METRES_PER_DEGREE,
    lng: lng + (metres * Math.sin(turn)) / (METRES_PER_DEGREE * Math.cos((lat * Math.PI) / 180)),
  };
}

/** How far apart two places are, in metres, measured as `offset` moves. */
export function metresBetween(from: LatLng, to: LatLng) {
  const north = (to.lat - from.lat) * METRES_PER_DEGREE;
  const east = (to.lng - from.lng) * METRES_PER_DEGREE * Math.cos((((from.lat + to.lat) / 2) * Math.PI) / 180);
  return Math.hypot(north, east);
}

/** The middle of the fence's area. Measured from its first corner, since the shoelace's products cancel out far from 0. */
export function centroid(fence: Geofence): LatLng {
  const [origin] = fence;
  const points = fence.map(({ lat, lng }) => ({ x: lng - origin.lng, y: lat - origin.lat }));
  let area = 0;
  let x = 0;
  let y = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    area += cross;
    x += (p.x + q.x) * cross;
    y += (p.y + q.y) * cross;
  });
  return area ? { lat: origin.lat + y / (3 * area), lng: origin.lng + x / (3 * area) } : origin;
}

/** The point on the fence's outline nearest `point`, where a pin marking the building's entrance stands. */
export function onOutline(fence: Geofence, point: LatLng): LatLng {
  const ring = fence.map((corner) => worldPixel(corner, ENTRANCE_ZOOM));
  const p = worldPixel(point, ENTRANCE_ZOOM);
  const nearest = ring
    .map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      const t = length && Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length));
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    })
    .reduce((best, next) => (Math.hypot(next.x - p.x, next.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? next : best));
  return fromWorldPixel(nearest, ENTRANCE_ZOOM);
}

/** The point on the edge from `a` to `b` nearest `p`, kept `margin` clear of both corners, or its middle where it's too short. */
export function alongEdge(a: Point, b: Point, p: Point, margin: number): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const along = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length;
  const t = length > 2 * margin ? Math.max(margin, Math.min(length - margin, along)) / length : 0.5;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Whether `point` falls within the fence's walls: a line due east from it crosses them an odd number of times. */
export function inside(fence: Geofence, { lat, lng }: LatLng) {
  return fence.reduce((within, a, i) => {
    const b = fence[(i + 1) % fence.length];
    const crosses = a.lat > lat !== b.lat > lat && lng < a.lng + ((lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng);
    return crosses ? !within : within;
  }, false);
}

export interface View {
  center: LatLng;
  zoom: number;
}

/**
 * The centre and zoom that put the middle of the points' bounds in the middle of a `box`, as close in as keeps them
 * `padding` pixels clear of every side, and no closer than `maxZoom`.
 */
export function framing(points: LatLng[], box: { width: number; height: number }, padding: number, maxZoom: number): View {
  const all = points.map((point) => worldPixel(point, 0));
  const xs = all.map(({ x }) => x);
  const ys = all.map(({ y }) => y);
  const middle = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const reachX = Math.max(...xs) - middle.x;
  const reachY = Math.max(...ys) - middle.y;
  const scale = Math.min((box.width / 2 - padding) / reachX, (box.height / 2 - padding) / reachY);
  return { center: fromWorldPixel(middle, 0), zoom: Math.min(maxZoom, Math.log2(scale)) };
}

/** `view` with what it centres `by` pixels further down its box. */
export function lowered({ center, zoom }: View, by: number): View {
  const { x, y } = worldPixel(center, zoom);
  return { center: fromWorldPixel({ x, y: y - by }, zoom), zoom };
}

const area = (ring: Ring) =>
  Math.abs(ring.reduce((sum, [x, y], i) => sum + x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y, 0));

const isRing = (ring: unknown): ring is Ring =>
  Array.isArray(ring) && ring.every((point) => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite));

/** The outer ring of the building in a Geoapify Place Details response (`features=building`), or null. */
export function footprintOf(response: unknown): Geofence | null {
  const features = (response as { features?: Feature[] } | null)?.features ?? [];
  const geometry = features.find((feature) => feature.properties?.feature_type === "building")?.geometry;
  const outers =
    geometry?.type === "Polygon"
      ? [(geometry.coordinates as unknown[])?.[0]]
      : geometry?.type === "MultiPolygon"
        ? ((geometry.coordinates as unknown[][]) ?? []).map((polygon) => polygon?.[0])
        : [];
  const rings = outers.filter(isRing);
  if (!rings.length) return null;
  const ring = rings.reduce((largest, next) => (area(next) > area(largest) ? next : largest));
  const [first, last] = [ring[0], ring.at(-1)!];
  const open = first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
  return open.length >= 3 ? open.map(([lng, lat]) => ({ lat, lng })) : null;
}
