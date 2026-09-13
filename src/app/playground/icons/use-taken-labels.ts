"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { getAnchoredTooltipPosition } from "@/data/cursor";
import { reservedRightInset } from "@/hooks/use-cursor-tooltip";

// ---------------------------------------------------------------------------
// Where the name of every TAKEN icon hangs.
//
// A taken icon is named for as long as it is taken, not for as long as it is
// pointed at — which is the whole use of the page: you take the four marks you
// are deciding between and read them side by side. A label that needed a hover
// could only ever name one of the four, and only while you were pointing at
// it, so the comparison the selection exists for could not actually be made.
//
// So: one label per taken icon, and all of them placed HERE rather than each
// running its own `useCursorTooltip`. That is not a style preference. An
// anchored label positions by reading its anchor's rect and its own width, and
// a sweep can take two hundred icons at once; two hundred independent
// positioners means two hundred scroll listeners, each waking on the same
// frame to read a rect and then write a `left` that invalidates the layout the
// next one is about to read. Batched, it is one listener, one frame, and every
// READ before any WRITE — see `place`.
//
// It places and nothing else: what the box looks like is `Tooltip`, and which
// icons are taken is the grid's. The anchored maths is `getAnchoredTooltipPosition`,
// shared with the cursor tooltip so a label under a tile and a label under a
// button cannot drift apart.
// ---------------------------------------------------------------------------

export interface TakenLabels {
  /**
   * Ref for the box naming `key`. A fresh function each render, which React
   * answers with a detach and a re-attach — two Map writes, on the renders
   * where the selection or the layout changed. Caching them would mean reading
   * a ref during render, which is the more expensive mistake.
   */
  register: (key: string) => (box: HTMLElement | null) => void;
  /** Re-place every label — for a caller that has moved the tiles itself. */
  place: () => void;
}

export function useTakenLabels(
  /** The element the tiles are inside. */
  surfaceRef: RefObject<HTMLElement | null>,
  /** The taken icons, in the order they are drawn. Placement runs on a change. */
  keys: string[],
): TakenLabels {
  const boxes = useRef(new Map<string, HTMLElement>());
  const frame = useRef(0);

  const place = useCallback(() => {
    frame.current = 0;
    const surface = surfaceRef.current;
    if (!surface) return;

    // The tiles, by key, in ONE pass and without touching layout. Matched
    // through `dataset` rather than a `[data-icon-tile="…"]` selector because
    // an object key is a path with dots and slashes in it, and the selector
    // would have to be escaped to survive them.
    const tiles = new Map<string, HTMLElement>();
    for (const tile of surface.querySelectorAll<HTMLElement>("[data-icon-tile]")) {
      tiles.set(tile.dataset.iconTile ?? "", tile);
    }

    const fit = {
      viewportWidth: window.innerWidth,
      reservedRight: reservedRightInset(),
    };

    // Every READ first. `getBoundingClientRect` and `offsetWidth` both force
    // the pending layout, so a loop that read and wrote in turn would pay for
    // one full layout per taken icon.
    const placements: Array<[HTMLElement, { left: string; top: string }]> = [];
    for (const [key, box] of boxes.current) {
      const tile = tiles.get(key);
      if (!tile) continue;
      placements.push([
        box,
        getAnchoredTooltipPosition(tile.getBoundingClientRect(), {
          ...fit,
          width: box.offsetWidth,
        }),
      ]);
    }

    for (const [box, { left, top }] of placements) {
      box.style.left = left;
      box.style.top = top;
    }
  }, [surfaceRef]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(place);
  }, [place]);

  // Before the paint that first shows a label, so it is never seen at the
  // top-left corner on its way to the tile it belongs to. `keys` is what makes
  // this run: a label that has just mounted has no position yet, and every
  // label moves when one is added or removed and the grid reflows.
  useLayoutEffect(() => {
    place();
  }, [place, keys]);

  // The anchors are boxes in the PAGE and a label is fixed to the viewport, so
  // everything that moves a tile has to move its label. Scroll in the capture
  // phase, since the scroller is an ancestor and a scroll event does not
  // bubble; the observer for everything else — the panel docking, a slider
  // widening every cell, the window itself — which all reach the label the
  // same way: the surface changes size.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const observer = new ResizeObserver(schedule);
    observer.observe(surface);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [surfaceRef, schedule]);

  const register = useCallback(
    (key: string) => (box: HTMLElement | null) => {
      if (box) boxes.current.set(key, box);
      else boxes.current.delete(key);
    },
    [],
  );

  return { register, place };
}
