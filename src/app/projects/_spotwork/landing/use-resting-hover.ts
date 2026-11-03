"use client";

import { useEffect, useState } from "react";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

// How long nothing may scroll before the page counts as at rest.
const REST_MS = 150;

const cardUnder = (target: EventTarget | null) =>
  (target instanceof Element && target.closest("[data-sheet-card]")?.getAttribute("data-sheet-card")) || null;

/**
 * The card (its `data-sheet-card`) under the visitor's mouse, as it was when the page last came to rest: while anything
 * scrolls, a card's hover stays as it was. A card's hover restyles its whole live app, which mid-scroll drops frames.
 */
export function useRestingHover(enabled: boolean) {
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let at: { x: number; y: number } | null = null;
    let moving = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || isSyntheticPointer(event)) return;
      at = { x: event.clientX, y: event.clientY };
      if (!moving) setHovered(cardUnder(event.target));
    };
    const onLeave = () => {
      at = null;
      if (!moving) setHovered(null);
    };
    // A demo scrolling inside a card's app moves no card.
    const onScroll = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-cover]")) return;
      moving = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        moving = false;
        setHovered(at ? cardUnder(document.elementFromPoint(at.x, at.y)) : null);
      }, REST_MS);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("scroll", onScroll, { capture: true });
      setHovered(null);
    };
  }, [enabled]);

  return enabled ? hovered : null;
}
