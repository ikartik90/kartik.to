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

/** A sweep in progress. A ref rather than state: no frame reads it. */
interface Sweep {
  origin: Point;
  /** The selection before the drag; an additive sweep adds to it. */
  base: string[];
  additive: boolean;
  tiles: TileBox[];
  moved: boolean;
  /** The last hit set, joined — compared to skip a write that changes nothing. */
  hits: string;
}

export interface IconMarqueeOptions {
  /** Passed in, not returned: the React Compiler reads a hook result reaching `ref` as a ref. */
  surfaceRef: RefObject<HTMLDivElement | null>;
  selection: string[];
  onSelectionChange: (keys: string[]) => void;
}

export interface IconMarquee {
  surfaceProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  /** In canvas coordinates. */
  band: Rect | null;
  sweeping: boolean;
  /** Whether this click ends a sweep, spending the flag: the drag's pointerup clicks what is under it. */
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
    event.shiftKey || Boolean(event.metaKey) || Boolean(event.ctrlKey);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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
      // Not every engine supports capture; the drag works without it.
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
