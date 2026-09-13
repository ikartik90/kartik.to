"use client";

import { useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  isDragging,
  keysWithin,
  marqueeRect,
  selectionAfterMarquee,
  type Point,
  type Rect,
  type TileBox,
} from "./icon-selection";

// ---------------------------------------------------------------------------
// The sweep: a band dragged across the canvas, and everything it touches.
//
// It lives here rather than in the grid because of WHERE it has to be
// listened for. The band is a gesture of the page — the whole canvas under
// the chrome, margins and all — while the grid is a 960px column centred in
// it. Hung off the grid, a sweep could only start on a tile or in the gaps
// between them, and reaching into the room beside the set did nothing; hung
// off the canvas, the hand can start anywhere it can see the set from. The
// panel is not part of it: the canvas is inset by the panel's width, so its
// box already ends where the rail begins.
//
// What the gesture MEANS is `icon-selection`, which is pure. This is only the
// part that must touch the DOM: measuring the tiles, following the pointer,
// and holding the band.
//
// The band is measured in the canvas's OWN coordinates, converted from the
// pointer on every move against a freshly read rect. That is what keeps it
// honest while the page scrolls under a drag — the origin was stored in
// canvas space once, so it stays on the page rather than on the glass. The
// tiles are measured once when the drag begins, since nothing reflows during
// one and two hundred `getBoundingClientRect` calls a frame is not a thing to
// do.
// ---------------------------------------------------------------------------

/** A sweep in progress. A ref rather than state: no frame reads it. */
interface Sweep {
  origin: Point;
  /** The selection the drag started from — what an additive sweep adds to. */
  base: string[];
  additive: boolean;
  tiles: TileBox[];
  moved: boolean;
  /** The last hit set, joined — compared to skip a write that changes nothing. */
  hits: string;
}

export interface IconMarqueeOptions {
  /**
   * The canvas. Owned by the page and passed IN rather than handed back, so
   * that nothing off this hook's result is ever given to a `ref` attribute —
   * the React Compiler reads the whole result as a ref when anything is, and
   * every other property taken off it during render then fails.
   */
  surfaceRef: RefObject<HTMLDivElement | null>;
  selection: string[];
  onSelectionChange: (keys: string[]) => void;
}

export interface IconMarquee {
  /** Handlers for the canvas element. */
  surfaceProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  /** The band to draw, in canvas coordinates, or nothing. */
  band: Rect | null;
  /** True while one is being drawn — the grid hides its hover label then. */
  sweeping: boolean;
  /**
   * Whether the click now arriving is the tail of a sweep, spending the flag
   * if it is. The pointerup that ends a drag fires a click on whatever is
   * under it, and a press handler that replaced the selection would undo the
   * whole sweep.
   */
  consumeSweep: () => boolean;
}

/** Every tile inside the canvas, in the canvas's coordinates. */
function measureTiles(surface: HTMLElement | null): TileBox[] {
  if (!surface) return [];
  const origin = surface.getBoundingClientRect();

  return Array.from(
    surface.querySelectorAll<HTMLElement>("[data-icon-tile]"),
  ).map((tile) => {
    const rect = tile.getBoundingClientRect();
    return {
      key: tile.dataset.iconTile ?? "",
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      right: rect.right - origin.left,
      bottom: rect.bottom - origin.top,
    };
  });
}

export function useIconMarquee({
  surfaceRef,
  selection,
  onSelectionChange,
}: IconMarqueeOptions): IconMarquee {
  const [band, setBand] = useState<Rect | null>(null);
  const sweepRef = useRef<Sweep | null>(null);
  const sweptRef = useRef(false);

  /** The pointer, in the canvas's coordinates rather than the viewport's. */
  const pointIn = (event: { clientX: number; clientY: number }): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const isAdditive = (event: {
    shiftKey: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
  }) =>
    // Shift is what was asked for; the platform's own modifier comes along
    // because that is what the hand reaches for on a grid of things.
    event.shiftKey || Boolean(event.metaKey) || Boolean(event.ctrlKey);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A finger is how the page is scrolled. Claiming the gesture would trap
    // the canvas, and there is no cursor to draw a band with anyway.
    if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0) {
      return;
    }

    sweptRef.current = false;
    sweepRef.current = {
      origin: pointIn(event),
      base: selection,
      additive: isAdditive(event),
      tiles: [],
      moved: false,
      hits: "\u0000",
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const sweep = sweepRef.current;
    if (!sweep) return;

    const point = pointIn(event);
    if (!sweep.moved) {
      if (!isDragging(sweep.origin, point)) return;
      sweep.moved = true;
      sweep.tiles = measureTiles(surfaceRef.current);
      // Held from here so the band survives the pointer leaving the canvas.
      // Not every engine has it, and none of this depends on it.
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // No capture: the drag simply ends if the pointer leaves the canvas.
      }
    }

    const rect = marqueeRect(sweep.origin, point);
    setBand(rect);

    const hits = keysWithin(sweep.tiles, rect);
    const signature = hits.join("\u0000");
    if (signature === sweep.hits) return;
    sweep.hits = signature;
    onSelectionChange(selectionAfterMarquee(sweep.base, hits, sweep.additive));
  };

  const endSweep = () => {
    const sweep = sweepRef.current;
    sweepRef.current = null;
    if (!sweep) return;
    if (sweep.moved) sweptRef.current = true;
    setBand(null);
  };

  const consumeSweep = () => {
    if (!sweptRef.current) return false;
    sweptRef.current = false;
    return true;
  };

  return {
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endSweep,
      onPointerCancel: endSweep,
    },
    band,
    sweeping: band !== null,
    consumeSweep,
  };
}
