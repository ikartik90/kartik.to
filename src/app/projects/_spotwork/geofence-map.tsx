"use client";

import Image from "next/image";
import { importLibrary } from "@googlemaps/js-api-loader";
import {
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useWireframe } from "@/components/ui/wireframe";
import { css, cx } from "../../../../styled-system/css";
import { EXPAND_MAP } from "./copy";
import { GeoContext, keyGoogle } from "./geo";
import {
  alongEdge,
  framing,
  fromWorldPixel,
  inside,
  lowered,
  moveAnchor,
  offset,
  onOutline,
  squareAround,
  worldPixel,
  type Geofence,
  type LatLng,
  type Place,
  type Point,
  type View,
} from "./geofence";
import { historyOf, record, redo, undo, type History } from "./shifts";
import { Button, Divider, SegmentedControl, Toolbar, Tooltip, mapStyle, useEscapeLayer } from "./ui";
import mapToronto from "./assets/map-toronto.png";
import AddMarkerIcon from "./assets/add-marker.svg";
import LocationPinIcon from "./assets/location-pin.svg";
import MapDotIcon from "./assets/map-dot.svg";
import MapPinIcon from "./assets/map-pin.svg";
import PinIcon from "./assets/pin-small.svg";
import TrashIcon from "./assets/trash.svg";

// An address's map: Google's where its key is set, otherwise Figma's Toronto picture, with the building's geofence
// drawn over it in SVG in the middle of the box, its corners dragged to reshape it. Wide, the Address & Wage step's
// (25637:26399); small, the Address & Location atom's; large, the Shift Summary's; location, View Location's
// (6989:28063), with the worker's dot; and Find by Location's (23280:27869), a range's circle round an address.

type Size = "wide" | "small" | "large" | "location";

/**
 * Each size's box until it's measured, and how far its fence, pin and dot keep from its sides: further than the pin
 * stands above its tip.
 */
export const FRAMES: Record<Size, { width: number; height: number; padding: number }> = {
  wide: { width: 584, height: 300, padding: 48 },
  small: { width: 200, height: 100, padding: 20 },
  large: { width: 300, height: 148, padding: 32 },
  location: { width: 560, height: 308, padding: 32 },
};

/** How close the map comes in; before the fence arrives, how close it stands on the address. */
const MAX_ZOOM = 19;
const UNFENCED_ZOOM: Record<Size, number> = { wide: 17, small: 16, large: 16, location: 15 };

const PIN = {
  wide: { Icon: LocationPinIcon, tip: { x: 13, y: 22 } },
  small: { Icon: PinIcon, tip: { x: 10, y: 17.87 } },
  large: { Icon: MapPinIcon, tip: { x: 14, y: 25 } },
  location: { Icon: MapPinIcon, tip: { x: 14, y: 25 } },
};
const DOT = 6;
const IMAGE = {
  wide: { width: 1059, height: 636 },
  small: { width: 482, height: 295 },
  large: { width: 723, height: 444 },
  location: { width: 640, height: 392, sizes: "640px" },
};

// A corner's dot is a Range Type end's: 8px across with its ring, 12px pointed at or held, held anywhere in its 16px.
const ANCHOR = 3;
export const HIT = 8;
const EDGE = HIT;
// Half Add Marker's 20px box, which it's centred in, and what fills the plus cut out of its 12px disc, inside its rim.
const MARKER = 10;
const PLUS = 5;
// The toolbar's 2.5rem, over the top of an editable map.
const TOOLBAR = 40;
// How far a press on a corner goes before it's a drag, not a click.
const SLOP = 4;
// How far the arc's bend stands off the middle of the line it bows from, as a share of that line's length.
const BEND = 0.25;

const layerStyle = css({ position: "absolute", inset: 0 });

// Its own layer, or Safari paints Google's tiles over it whatever its z-index.
const barStyle = css({ position: "absolute", insetBlockStart: 0, insetInline: 0, transform: "translateZ(0)" });

const canvasStyle = css({ position: "absolute", inset: 0, isolation: "isolate" });

const grabRaw = css.raw({ cursor: "grab", touchAction: "none", "&:active": { cursor: "grabbing" } });

const drawingStyle = css({
  position: "absolute",
  overflow: "visible",
  pointerEvents: "none",
  "& polygon": {
    fill: "var(--sw-border-target)",
    fillOpacity: 0.2,
    stroke: "var(--sw-border-target)",
    strokeWidth: "2px",
    strokeLinejoin: "round",
  },
  "& [data-anchor]": { ...grabRaw, fill: "none", pointerEvents: "all" },
  "& [data-anchor] > :last-child": {
    fill: "var(--sw-surface-default)",
    stroke: "var(--sw-border-target)",
    strokeWidth: "2px",
  },
  "& [data-anchor]:is(:hover, [data-pressed]) > :last-child": { r: "5px" },
  "& [data-anchor]:is([data-pressed], [data-selected]) > :last-child": { fill: "var(--sw-glyph-selected)" },
  "& [data-edge]": { stroke: "transparent", pointerEvents: "stroke", cursor: "pointer" },
  "& [data-add-marker]": { color: "var(--sw-glyph-target)", fill: "var(--sw-glyph-inverted-default)" },
  "&[data-arc] path": {
    fill: "none",
    stroke: "var(--sw-colors-blue-ribbon-600)",
    strokeWidth: "2px",
    strokeLinecap: "round",
  },
  "&[data-untracked] path": { stroke: "var(--sw-border-alert)" },
});

const pinStyle = css({ position: "absolute", pointerEvents: "none", "&[data-draggable]": { ...grabRaw, pointerEvents: "auto" } });

const dotStyle = css({
  color: "var(--sw-glyph-target)",
  "&[data-untracked]": { color: "var(--sw-glyph-alert)" },
  "&[data-trail]": { opacity: 0.5 },
});

// Centred on the point it's placed at.
const lastKnownStyle = css({
  position: "absolute",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "var(--sw-radius-full)",
  border: "1.5px dashed var(--sw-border-alert)",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
});

/**
 * Pointer handlers that move a point by the pointer's travel, from where `start` is given it, and let it go where it was
 * last moved to.
 */
function useDrag() {
  const drag = useRef<{
    x: number;
    y: number;
    from: Point;
    to?: Point;
    scale: number;
    onMove: (to: Point) => void;
    onEnd?: (to: Point) => void;
    onPress?: () => void;
  } | null>(null);
  return {
    // The window may be scaled, so the travel is divided by the drawing's drawn size over its own.
    start: (from: Point, onMove: (to: Point) => void, onEnd?: (to: Point) => void, onPress?: () => void) => (event: ReactPointerEvent<SVGElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
      const scale = svg.getBoundingClientRect().width / parseFloat(svg.getAttribute("width") ?? "") || 1;
      drag.current = { x: event.clientX, y: event.clientY, from, scale, onMove, onEnd, onPress };
    },
    move: (event: ReactPointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.stopPropagation();
      if (!held.to && held.onPress && Math.hypot(event.clientX - held.x, event.clientY - held.y) < SLOP) return;
      held.to = { x: held.from.x + (event.clientX - held.x) / held.scale, y: held.from.y + (event.clientY - held.y) / held.scale };
      held.onMove(held.to);
    },
    end: (event: ReactPointerEvent) => {
      const held = drag.current;
      if (!held) return;
      event.stopPropagation();
      drag.current = null;
      if (held.to) held.onEnd?.(held.to);
      else if (event.type === "pointerup") held.onPress?.();
    },
  };
}

/**
 * The geofence's outline in its parent's pixels, its corners dragged by the pointer's travel, `onDrop` hearing where one's
 * let go, and clicked to `onSelect` it. Add Marker stands on an edge pointed at, where a click has `onAdd` put a corner
 * after the edge's first.
 */
function Fence({ points, editable, selected = null, onMove, onDrop, onSelect, onAdd }: {
  points: Point[];
  editable: boolean;
  selected?: number | null;
  onMove: (index: number, to: Point) => void;
  onDrop?: (index: number, to: Point) => void;
  onSelect?: (index: number) => void;
  onAdd?: (index: number, at: Point) => void;
}) {
  const { start, move, end } = useDrag();
  const [held, setHeld] = useState<number | null>(null);
  const [marker, setMarker] = useState<Point | null>(null);
  const letGo = (event: ReactPointerEvent) => {
    end(event);
    setHeld(null);
  };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs) - EDGE;
  const top = Math.min(...ys) - EDGE;
  const width = Math.max(...xs) + EDGE - left;
  const height = Math.max(...ys) + EDGE - top;
  // The window may be scaled, as a drag's travel is.
  const onEdge = (index: number, event: ReactMouseEvent<SVGElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const scale = box.width / width || 1;
    const pointer = { x: left + (event.clientX - box.left) / scale, y: top + (event.clientY - box.top) / scale };
    return alongEdge(points[index], points[(index + 1) % points.length], pointer, HIT);
  };

  return (
    <svg
      className={drawingStyle}
      style={{ left, top }}
      width={width}
      height={height}
      viewBox={`${left} ${top} ${width} ${height}`}
      aria-hidden
    >
      <polygon points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
      {editable &&
        onAdd &&
        points.map(({ x, y }, index) => {
          const next = points[(index + 1) % points.length];
          return (
            <line
              key={index}
              data-edge=""
              x1={x}
              y1={y}
              x2={next.x}
              y2={next.y}
              strokeWidth={2 * HIT}
              onPointerMove={(event) => setMarker(onEdge(index, event))}
              onPointerLeave={() => setMarker(null)}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                setMarker(null);
                onAdd(index, onEdge(index, event));
              }}
            />
          );
        })}
      {marker && (
        <g data-add-marker="">
          <circle cx={marker.x} cy={marker.y} r={PLUS} />
          <AddMarkerIcon x={marker.x - MARKER} y={marker.y - MARKER} />
        </g>
      )}
      {editable &&
        points.map(({ x, y }, index) => (
          <g
            key={index}
            data-anchor=""
            data-pressed={held === index ? "" : undefined}
            data-selected={selected === index ? "" : undefined}
            onPointerDown={(event) => {
              setHeld(index);
              start(
                points[index],
                (to) => onMove(index, to),
                (to) => onDrop?.(index, to),
                onSelect && (() => onSelect(index)),
              )(event);
            }}
            onPointerMove={move}
            onPointerUp={letGo}
            onPointerCancel={letGo}
          >
            <circle cx={x} cy={y} r={HIT} />
            <circle cx={x} cy={y} r={ANCHOR} />
          </g>
        ))}
    </svg>
  );
}

/** A curve from `from` to `to` in its parent's pixels, bowed upward. */
function Arc({ from, to, untracked }: { from: Point; to: Point; untracked: boolean }) {
  const side = to.x >= from.x ? 1 : -1;
  const bend = {
    x: (from.x + to.x) / 2 + side * (to.y - from.y) * BEND,
    y: (from.y + to.y) / 2 - side * (to.x - from.x) * BEND,
  };
  const xs = [from.x, bend.x, to.x];
  const ys = [from.y, bend.y, to.y];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  return (
    <svg
      className={drawingStyle}
      style={{ left, top }}
      width={width}
      height={height}
      viewBox={`${left} ${top} ${width} ${height}`}
      aria-hidden
      data-arc=""
      data-untracked={untracked ? "" : undefined}
    >
      <path d={`M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${to.x} ${to.y}`} />
    </svg>
  );
}

interface Projection {
  toPoint(at: LatLng): Point;
  toLatLng(point: Point): LatLng;
}

/** The pin, its tip at `at`; given `onMove`, it's dragged by the pointer's travel, and `onDrop` hears where it's let go. */
function Pin({ size, at, onMove, onDrop }: { size: Size; at: Point; onMove?: (to: Point) => void; onDrop?: (to: Point) => void }) {
  const { Icon, tip } = PIN[size];
  const { start, move, end } = useDrag();
  return (
    <Icon
      aria-hidden
      data-pin=""
      data-draggable={onMove ? "" : undefined}
      className={pinStyle}
      style={{ left: at.x - tip.x, top: at.y - tip.y }}
      {...(onMove && { onPointerDown: start(at, onMove, onDrop), onPointerMove: move, onPointerUp: end, onPointerCancel: end })}
    />
  );
}

type Shape = { fence: Geofence; entrance: LatLng | null };

/**
 * The fence, the pin at its entrance (on the outline, nearest `entrance` or else the address; at the address where
 * there's no fence) and the worker's dot, an arc joining it to the pin where it's outside the fence, in a projection's
 * pixels; given a `trail`, their earlier places faint and no arc. An untracked worker's dot and arc are Alert, the dot
 * ringed. `onDrop` hears the shape a corner or the pin is let go at.
 */
function Overlay({ place, fence, entrance, worker, trail, untracked, size, editable, projection, selected, onChange, onEntranceChange, onDrop, onSelect }: {
  place: Place;
  fence: Geofence | null;
  entrance: LatLng | null;
  worker: LatLng | null;
  trail?: LatLng[];
  untracked: boolean;
  size: Size;
  editable: boolean;
  projection: Projection;
  selected?: number | null;
  onChange?: (fence: Geofence) => void;
  onEntranceChange?: (entrance: LatLng) => void;
  onDrop?: (shape: Shape) => void;
  onSelect?: (index: number) => void;
}) {
  const dot = worker && projection.toPoint(worker);
  const door = projection.toPoint(fence ? onOutline(fence, entrance ?? place) : place);
  return (
    <>
      {fence && (
        <Fence
          points={fence.map(projection.toPoint)}
          editable={editable && !!onChange}
          selected={selected}
          onMove={(index, to) => onChange?.(moveAnchor(fence, index, projection.toLatLng(to)))}
          onDrop={(index, to) => onDrop?.({ fence: moveAnchor(fence, index, projection.toLatLng(to)), entrance })}
          onSelect={onSelect}
          onAdd={(index, at) => {
            const added = fence.toSpliced(index + 1, 0, projection.toLatLng(at));
            onChange?.(added);
            onDrop?.({ fence: added, entrance });
          }}
        />
      )}
      {dot && fence && !trail && !inside(fence, worker) && <Arc from={dot} to={door} untracked={untracked} />}
      {trail?.map(projection.toPoint).map((at, i) => (
        <MapDotIcon key={i} aria-hidden data-trail="" className={cx(pinStyle, dotStyle)} style={{ left: at.x - DOT, top: at.y - DOT }} />
      ))}
      <Pin
        size={size}
        at={door}
        onMove={fence && editable && onEntranceChange ? (to) => onEntranceChange(onOutline(fence, projection.toLatLng(to))) : undefined}
        onDrop={fence && editable && onEntranceChange ? (to) => onDrop?.({ fence, entrance: onOutline(fence, projection.toLatLng(to)) }) : undefined}
      />
      {dot && untracked && <span aria-hidden data-last-known="" className={lastKnownStyle} style={{ left: dot.x, top: dot.y }} />}
      {dot && (
        <MapDotIcon
          aria-hidden
          data-worker=""
          data-untracked={untracked ? "" : undefined}
          className={cx(pinStyle, dotStyle)}
          style={{ left: dot.x - DOT, top: dot.y - DOT }}
        />
      )}
    </>
  );
}

/** The picture's projection: the view's centre in the middle of the box. */
function staticProjection({ center, zoom }: View, { width, height }: { width: number; height: number }): Projection {
  const middle = worldPixel(center, zoom);
  return {
    toPoint: (latLng) => {
      const { x, y } = worldPixel(latLng, zoom);
      return { x: width / 2 + x - middle.x, y: height / 2 + y - middle.y };
    },
    toLatLng: ({ x, y }) => fromWorldPixel({ x: middle.x + x - width / 2, y: middle.y + y - height / 2 }, zoom),
  };
}

const QUIET: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },
];

const authFailures = new Set<() => void>();

function loadMaps(key: string) {
  keyGoogle(key);
  // Google calls this when its key is refused, leaving its own error on the map.
  (window as { gm_authFailure?: () => void }).gm_authFailure ??= () => authFailures.forEach((fail) => fail());
  return importLibrary("maps");
}

/** How long a following map takes to glide to its next view. */
const GLIDE = 600;

const easeOut = (k: number) => 1 - (1 - k) ** 3;

/**
 * Google's map, its labelled satellite imagery when `satellite`, the `overlay` drawn in its overlay pane so it pans and
 * zooms with the map; `glide`, it eases to each new view.
 */
function GoogleMap({ mapKey, view, editable, satellite, glide, onFail, overlay }: {
  mapKey: string;
  view: View;
  editable: boolean;
  satellite: boolean;
  glide: boolean;
  onFail: () => void;
  overlay: (projection: Projection) => ReactNode;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<{ map: google.maps.Map; view: google.maps.OverlayView; pane: Element } | null>(null);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const fail = useEffectEvent(onFail);
  const first = useEffectEvent(() => view);

  useEffect(() => {
    let live = true;
    let view: google.maps.OverlayView | undefined;
    const refused = () => live && fail();
    authFailures.add(refused);
    loadMaps(mapKey)
      .then(({ Map, OverlayView }) => {
        if (!live || !canvas.current) return;
        const { center, zoom } = first();
        const map = new Map(canvas.current, {
          center,
          zoom,
          isFractionalZoomEnabled: true,
          disableDefaultUI: true,
          zoomControl: editable,
          clickableIcons: false,
          keyboardShortcuts: false,
          styles: QUIET,
          // Flat, or 45° imagery would skew the map out from under the geofence.
          tilt: 0,
          gestureHandling: editable ? "cooperative" : "none",
        });
        class Layer extends OverlayView {
          onAdd() {
            setLayer({ map, view: this, pane: this.getPanes()!.overlayMouseTarget });
          }
          draw() {
            redraw();
          }
          onRemove() {
            setLayer(null);
          }
        }
        view = new Layer();
        view.setMap(map);
      })
      .catch(refused);
    return () => {
      live = false;
      authFailures.delete(refused);
      view?.setMap(null);
    };
  }, [mapKey, editable]);

  const map = layer?.map;
  useEffect(() => {
    if (!map) return;
    const center = glide && !matchMedia("(prefers-reduced-motion: reduce)").matches ? map.getCenter() : undefined;
    const zoom = center && map.getZoom();
    if (!center || zoom === undefined) {
      map.setCenter(view.center);
      map.setZoom(view.zoom);
      return;
    }
    const from = { lat: center.lat(), lng: center.lng(), zoom };
    let start: number | undefined;
    let frame = requestAnimationFrame(function step(now) {
      start ??= now;
      const k = easeOut(Math.min((now - start) / GLIDE, 1));
      map.moveCamera({
        center: { lat: from.lat + (view.center.lat - from.lat) * k, lng: from.lng + (view.center.lng - from.lng) * k },
        zoom: from.zoom + (view.zoom - from.zoom) * k,
      });
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [map, view, glide]);
  useEffect(() => {
    map?.setMapTypeId(satellite ? "hybrid" : "roadmap");
  }, [map, satellite]);

  const projection = layer?.view.getProjection();
  return (
    <>
      <div ref={canvas} className={canvasStyle} />
      {layer &&
        projection &&
        createPortal(
          overlay({
            toPoint: (at) => {
              const point = projection.fromLatLngToDivPixel(at);
              return { x: point?.x ?? 0, y: point?.y ?? 0 };
            },
            toLatLng: ({ x, y }) => projection.fromDivPixelToLatLng(new google.maps.Point(x, y))!.toJSON(),
          }),
          layer.pane,
        )}
    </>
  );
}

/**
 * The map of an address, holding its geofence: a building's outline from Geoapify by default (a square round the
 * address where none is known), reshaped by dragging its corners while `editable`, or clicking an edge to add one, its
 * pin at the building's `entrance`, dragged along the outline, and where `worker` says they are beside it, or were last
 * where `untracked`. The fence and the worker sit in the middle of the box as tightly as fits, their `trail` wherever it falls. The framing holds
 * until the address or the box changes, or given a `trail`, the worker moves, Google's map gliding after them. Editable, a toolbar heads it: Undo and Redo for each corner or pin let go and
 * each corner added or deleted since the address was picked, Delete for a clicked corner while more than three are left, and over Google's map, Map
 * or Satellite.
 */
export function GeofenceMap({
  place,
  value,
  onChange,
  entrance = null,
  onEntranceChange,
  size = "wide",
  editable = true,
  worker,
  trail,
  untracked = false,
}: {
  place: Place;
  value: Geofence | null;
  onChange?: (fence: Geofence) => void;
  /** Where the pin stands on the outline, nearest this; `null` for the wall nearest the address. */
  entrance?: LatLng | null;
  onEntranceChange?: (entrance: LatLng | null) => void;
  size?: Size;
  editable?: boolean;
  /** Where the worker is, given the site's fence. */
  worker?: (fence: Geofence) => LatLng;
  /** Where they were before, drawn faint with no arc to the pin, not framed. */
  trail?: (fence: Geofence) => LatLng[];
  /** Whether their location can no longer be tracked, `worker` being where it was last known. */
  untracked?: boolean;
}) {
  const geo = use(GeoContext);
  const [found, setFound] = useState<{ id: string; fence: Geofence } | null>(null);
  const fence = value ?? (found?.id === place.id ? found.fence : null);
  const missing = !value;
  const loading = useWireframe()?.mode === "loading";

  const lookUp = useEffectEvent((signal: AbortSignal) => {
    const settle = (building: Geofence | null) => {
      if (signal.aborted) return;
      const fence = building ?? squareAround(place);
      setFound({ id: place.id, fence });
      if (editable) onChange?.(fence);
    };
    geo.footprint(place, signal).then(settle, () => settle(null));
  });
  useEffect(() => {
    if (!missing || loading) return;
    const abort = new AbortController();
    lookUp(abort.signal);
    return () => abort.abort();
  }, [geo, place.id, missing, loading]);

  const box = useRef<HTMLDivElement>(null);
  const { padding, ...unmeasured } = FRAMES[size];
  const area = useMeasured(box) ?? unmeasured;

  const edits = editable && !!onChange;
  const top = edits ? TOOLBAR : 0;
  const workerAt = fence && worker ? worker(fence) : null;
  const trailAt = fence && trail ? trail(fence) : [];
  const followed = trail && workerAt ? ` ${trailAt.length} ${workerAt.lat},${workerAt.lng}` : "";
  const key = `${place.id} ${fence ? "fenced" : ""} ${area.width}x${area.height}${followed}`;
  const [framed, setFramed] = useState<{ key: string; view: View } | null>(null);
  let view = framed?.key === key ? framed.view : null;
  if (!view) {
    const below = { width: area.width, height: area.height - top };
    view = lowered(
      fence
        ? framing([...fence, ...(workerAt ? [workerAt] : [])], below, padding, MAX_ZOOM)
        : { center: place, zoom: UNFENCED_ZOOM[size] },
      top / 2,
    );
    setFramed({ key, view });
  }

  // What's been done to the fence since its address was picked, and the corner clicked.
  const [edited, setEdited] = useState<{ id: string; history: History<Shape> } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  if (edits && fence && edited?.id !== place.id) {
    setEdited({ id: place.id, history: historyOf({ fence, entrance }) });
    setSelected(null);
  }
  const history = edited?.id === place.id ? edited.history : null;
  const remember = (shape: Shape) => setEdited((last) => last && { ...last, history: record(last.history, shape) });
  const show = (next: History<Shape>) => {
    setEdited({ id: place.id, history: next });
    setSelected(null);
    onChange?.(next.present.fence);
    onEntranceChange?.(next.present.entrance);
  };
  const deletable = history && fence && selected !== null && fence.length > 3;
  const [mapType, setMapType] = useState<"map" | "satellite">("map");

  const bar = useRef<HTMLDivElement>(null);
  useEscapeLayer(bar, selected !== null, () => setSelected(null));
  useEffect(() => {
    if (selected === null) return;
    const away = (event: PointerEvent) => !bar.current?.contains(event.target as Node) && setSelected(null);
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [selected]);

  const overlay = (projection: Projection) => (
    <Overlay
      place={place}
      fence={fence}
      entrance={entrance}
      worker={workerAt}
      trail={trail && trailAt}
      untracked={untracked}
      size={size}
      editable={editable}
      projection={projection}
      selected={selected}
      onChange={onChange}
      onEntranceChange={onEntranceChange}
      onDrop={remember}
      onSelect={setSelected}
    />
  );
  return (
    <MapBox
      box={box}
      size={size}
      view={view}
      area={area}
      editable={editable}
      satellite={mapType === "satellite"}
      glide={!!trail}
      overlay={overlay}
    >
      {(google) =>
        edits &&
        !loading && (
          <div ref={bar} className={barStyle} data-escape-layer={selected === null ? undefined : ""}>
            <Toolbar
              end={
                google && (
                  <SegmentedControl value={mapType} onChange={setMapType} size="small" aria-label="View">
                    <SegmentedControl.Segment value="map">Map</SegmentedControl.Segment>
                    <SegmentedControl.Segment value="satellite">Satellite</SegmentedControl.Segment>
                  </SegmentedControl>
                )
              }
            >
              <Toolbar.History
                onUndo={history?.past.length ? () => show(undo(history)) : undefined}
                onRedo={history?.future.length ? () => show(redo(history)) : undefined}
              />
              <Divider orientation="vertical" />
              <Toolbar.Group>
                <Button
                  size="icon"
                  tone="destructive"
                  aria-label="Delete"
                  disabled={!deletable}
                  onClick={() => deletable && show(record(history, { fence: fence.toSpliced(selected, 1), entrance }))}
                >
                  <TrashIcon aria-hidden />
                  <Tooltip start>Delete</Tooltip>
                </Button>
              </Toolbar.Group>
            </Toolbar>
          </div>
        )
      }
    </MapBox>
  );
}

/** The box's size once it's laid out, kept as it resizes. */
function useMeasured(box: RefObject<HTMLDivElement | null>) {
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width && height) setMeasured((last) => (last?.width === width && last.height === height ? last : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);
  return measured;
}

/**
 * A map's box: Google's map where its key is set and taken, otherwise Figma's Toronto picture, `overlay` over it and
 * `children` over both, given whether it's Google's. `fill`, it's as tall as what it's in.
 */
function MapBox({ box, size, fill, view, area, editable, satellite = false, glide = false, overlay, children }: {
  box: RefObject<HTMLDivElement | null>;
  size: Size;
  fill?: boolean;
  view: View;
  area: { width: number; height: number };
  editable: boolean;
  satellite?: boolean;
  glide?: boolean;
  overlay: (projection: Projection) => ReactNode;
  children?: ReactNode | ((google: boolean) => ReactNode);
}) {
  const geo = use(GeoContext);
  const [failed, setFailed] = useState(false);
  const mapKey = failed ? null : geo.mapKey;
  // Loading, a blank box of its size.
  const loading = useWireframe()?.mode === "loading";
  return (
    <div ref={box} className={mapStyle} data-size={size === "small" ? undefined : size} data-fill={fill ? "" : undefined} data-map="">
      {loading ? null : mapKey ? (
        <GoogleMap
          mapKey={mapKey}
          view={view}
          editable={editable}
          satellite={satellite}
          glide={glide}
          onFail={() => setFailed(true)}
          overlay={overlay}
        />
      ) : (
        <>
          <Image src={mapToronto} alt="" {...IMAGE[size]} />
          <div className={layerStyle}>{overlay(staticProjection(view, area))}</div>
        </>
      )}
      {typeof children === "function" ? children(!!mapKey) : children}
    </div>
  );
}

// The whole minimap, over Google's map and its links.
const expandStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: 1,
  padding: 0,
  border: "none",
  borderRadius: "inherit",
  backgroundColor: "transparent",
  cursor: "pointer",
  outline: "none",
  _focusVisible: { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
});

// How many corners a range's circle is drawn with.
const ROUND = 72;

const ringOf = (place: LatLng, km: number) => Array.from({ length: ROUND }, (_, i) => offset(place, km * 1000, (i * 360) / ROUND));

const same = (a: LatLng | null, b: LatLng) => !!a && a.lat === b.lat && a.lng === b.lng;

/**
 * The map round `place` as far as `km`, its circle about the address's pin and framed to fit: Find by Location's. Mini,
 * a corner's as tall as what it's in, a press on it calls `onExpand`; wide, given `onMove`, its pin drags, the circle
 * following, and `onMove` hears where it's let go. Its view holds still for that place, and frames any other afresh.
 */
export function RangeMap({
  place,
  km,
  size = "wide",
  onExpand,
  onMove,
}: {
  place: Place;
  km: number;
  size?: "mini" | "wide";
  onExpand?: () => void;
  onMove?: (to: LatLng) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const wide = size === "wide";
  const { padding, ...unmeasured } = FRAMES[wide ? "wide" : "small"];
  const area = useMeasured(box) ?? unmeasured;
  // Where the pin is while it's dragged, and where it was let go.
  const [held, setHeld] = useState<LatLng | null>(null);
  const [dropped, setDropped] = useState<LatLng | null>(null);
  const own = same(dropped, place);
  if (held && own) setHeld(null);
  const at = held ?? place;

  const key = `${km} ${area.width}x${area.height}`;
  const [framed, setFramed] = useState<{ key: string; at: LatLng; view: View } | null>(null);
  let view = framed?.key === key && (own || held || same(framed.at, place)) ? framed.view : null;
  if (!view) {
    view = framing(ringOf(place, km), area, padding, MAX_ZOOM);
    setFramed({ key, at: place, view });
  }

  const drags = wide && onMove;
  const overlay = (projection: Projection) => (
    <>
      <Fence points={ringOf(at, km).map(projection.toPoint)} editable={false} onMove={() => {}} />
      <Pin
        size={wide ? "wide" : "small"}
        at={projection.toPoint(at)}
        onMove={drags ? (to) => setHeld(projection.toLatLng(to)) : undefined}
        onDrop={
          drags
            ? (to) => {
                const spot = projection.toLatLng(to);
                setDropped(spot);
                onMove(spot);
              }
            : undefined
        }
      />
    </>
  );
  return (
    <MapBox box={box} size={wide ? "wide" : "small"} fill={!wide} view={view} area={area} editable={false} overlay={overlay}>
      {!wide && onExpand && <button type="button" className={expandStyle} aria-label={EXPAND_MAP} onClick={onExpand} />}
    </MapBox>
  );
}
