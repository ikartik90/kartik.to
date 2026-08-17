"use client";

import { useCallback, useEffect, useRef } from "react";
import { getCursorTooltipPosition } from "@/data/cursor";
import { isSyntheticPointer } from "@/utils/synthetic-pointer";

// ---------------------------------------------------------------------------
// The cursor-following positioning engine shared by every tooltip that trails
// the custom cursor — the social links, and now Button/Link. Owns POSITIONING
// only: the consumer owns the `visible` boolean (a plain hover, or the social
// component's copy/dismiss state) and toggles `data-visible` on the element for
// the `tooltip` recipe's show transition.
//
// Position is written imperatively through `ref` (ref + rAF), so tracking the
// pointer never triggers a React re-render on every pointermove. Returns the
// element `ref` and `seed(x, y)` — call `seed` from the pointer event that
// opens the tooltip so it appears in place instead of at a stale spot before
// the first pointermove lands.
// ---------------------------------------------------------------------------
export function useCursorTooltip(visible: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  const position = useCallback(() => {
    rafRef.current = 0;
    const el = ref.current;
    if (!el) return;
    // `offsetWidth` is the label at its natural width — read before writing,
    // and only ever compared against the viewport, so this is one measurement
    // per frame that already had to touch layout, not a read-write-read.
    const { left, top } = getCursorTooltipPosition(
      pointerRef.current.x,
      pointerRef.current.y,
      { width: el.offsetWidth, viewportWidth: window.innerWidth },
    );
    el.style.left = left;
    el.style.top = top;
  }, []);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(position);
  }, [position]);

  useEffect(() => {
    if (!visible) return;

    function onPointerMove(event: PointerEvent) {
      // A self-playing demo drags by dispatching this very event at its OWN
      // stand-in cursor. This tooltip belongs to whatever the REAL pointer is
      // resting on — a Replay control the visitor has just pressed, say — so
      // following the show would tear the label off the thing it names.
      if (isSyntheticPointer(event)) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      schedule();
    }

    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [visible, schedule]);

  const seed = useCallback(
    (x: number, y: number) => {
      pointerRef.current = { x, y };
      position();
    },
    [position],
  );

  return { ref, seed };
}
