"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  getAnchoredTooltipPosition,
  getCursorTooltipPosition,
} from "@/data/cursor";
import { PANEL_INSET_ATTR } from "@/hooks/use-properties-panel-inset";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

// Positions a fixed tooltip imperatively (ref + rAF): after the cursor, under an `anchor`,
// or not at all when `docked`, where the stylesheet places it.

/** The docked panel's inset, read from the body's padding so tooltips and page agree on the edge. */
export function reservedRightInset(): number {
  if (!document.body.hasAttribute(PANEL_INSET_ATTR)) return 0;
  return parseFloat(getComputedStyle(document.body).paddingInlineEnd) || 0;
}

export function useCursorTooltip(
  visible: boolean,
  docked = false,
  /** Hang it under this element instead of the cursor. */
  anchor?: HTMLElement | null,
) {
  const ref = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const anchorRef = useRef<HTMLElement | null>(anchor ?? null);
  const rafRef = useRef(0);

  const position = useCallback(() => {
    rafRef.current = 0;
    const el = ref.current;
    if (!el) return;
    const fit = {
      width: el.offsetWidth,
      viewportWidth: window.innerWidth,
      reservedRight: reservedRightInset(),
    };
    const anchored = anchorRef.current;
    const { left, top } = anchored
      ? getAnchoredTooltipPosition(anchored.getBoundingClientRect(), fit)
      : getCursorTooltipPosition(pointerRef.current.x, pointerRef.current.y, fit);
    el.style.left = left;
    el.style.top = top;
  }, []);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(position);
  }, [position]);

  useEffect(() => {
    if (!docked) return;
    const el = ref.current;
    if (!el) return;
    el.style.left = "";
    el.style.top = "";
  }, [docked, visible]);

  useEffect(() => {
    anchorRef.current = anchor ?? null;
    // Never while docked: inline left/top would outrank the stylesheet's placement.
    if (visible && !docked) position();
  }, [anchor, visible, docked, position]);

  // Capture phase: the scroller is some ancestor, and scroll doesn't bubble.
  useEffect(() => {
    if (!visible || docked || !anchor) return;

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [visible, docked, anchor, schedule]);

  useEffect(() => {
    if (!visible || docked) return;

    function onPointerMove(event: PointerEvent) {
      // Follow the real pointer, not a demo's synthetic one.
      if (isSyntheticPointer(event)) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      // Recorded even when anchored, in case the anchor goes away while the label is up.
      if (!anchorRef.current) schedule();
    }

    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [visible, docked, schedule]);

  const seed = useCallback(
    (x: number, y: number) => {
      pointerRef.current = { x, y };
      // Drop any previous anchor, or the box stays under the element just left.
      anchorRef.current = null;
      position();
    },
    [position],
  );

  const seedAnchor = useCallback(
    (element: HTMLElement) => {
      anchorRef.current = element;
      position();
    },
    [position],
  );

  return { ref, seed, seedAnchor };
}
