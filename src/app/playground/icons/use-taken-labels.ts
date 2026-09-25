"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { getAnchoredTooltipPosition } from "@/data/cursor";
import { reservedRightInset } from "@/hooks/use-cursor-tooltip";

export interface TakenLabels {
  /** Ref for the box naming `key`; fresh each render, since caching would read a ref during render. */
  register: (key: string) => (box: HTMLElement | null) => void;
  /** Re-place every label — for a caller that has moved the tiles itself. */
  place: () => void;
}

export function useTakenLabels(
  surfaceRef: RefObject<HTMLElement | null>,
  keys: string[],
): TakenLabels {
  const boxes = useRef(new Map<string, HTMLElement>());
  const frame = useRef(0);

  const place = useCallback(() => {
    frame.current = 0;
    const surface = surfaceRef.current;
    if (!surface) return;

    // Matched via `dataset`: keys contain dots and slashes a selector would need escaped.
    const tiles = new Map<string, HTMLElement>();
    for (const tile of surface.querySelectorAll<HTMLElement>("[data-icon-tile]")) {
      tiles.set(tile.dataset.iconTile ?? "", tile);
    }

    const fit = {
      viewportWidth: window.innerWidth,
      reservedRight: reservedRightInset(),
    };

    // Every read before any write, or each label forces its own layout.
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

  // Before paint, so a new label is never seen at the top-left corner.
  useLayoutEffect(() => {
    place();
  }, [place, keys]);

  // Scroll in the capture phase (scroll does not bubble); the observer covers resizes.
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
