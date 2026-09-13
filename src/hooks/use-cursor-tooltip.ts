"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  getAnchoredTooltipPosition,
  getCursorTooltipPosition,
} from "@/data/cursor";
import { PANEL_INSET_ATTR } from "@/hooks/use-properties-panel-inset";
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
//
// ANCHORED is the case where trailing the cursor would answer a question the
// page has already answered. A SELECTED tile in the icons grid is marked in
// the brand colour, so a label following the pointer around it would be
// pointing at the thing that is already pointed at; hung under the tile it
// reads as that tile's name instead. Pass the element and it positions from
// its rect, tracking SCROLL rather than the pointer — the anchor moves with
// the page, and the box is fixed. `seedAnchor(el)` is `seed`'s twin for it,
// and for the same reason: called from the handler that opens the label, it
// lands in place rather than a frame later, which matters most when moving
// between two anchored triggers with the box already at full opacity.
//
// DOCKED is the case with no cursor to trail: a touch device, where the demos'
// invitation is drawn at the foot of the screen instead. The placement is the
// stylesheet's there (`data-docked` on the `tooltip` recipe), because a box
// pinned to the viewport's bottom edge has to survive a phone's URL bar
// sliding away, which a `top` computed once from `innerHeight` would not. All
// this hook does for it is get out of the way: no pointer to follow — a
// finger-scroll dispatches `pointermove` like anything else — and the inline
// `left`/`top` a previous cursor placement wrote has to go, since an inline
// style outranks the rule that would centre it.
// ---------------------------------------------------------------------------

/**
 * How much of the viewport's trailing edge a docked properties panel is holding.
 *
 * Read from the body's own inset rather than measured off the panel: that
 * padding IS the app's answer to the question (one rule in globals.css, keyed
 * off the mark `usePropertiesPanelInset` sets), so a tooltip and the page it is
 * drawn over cannot disagree about where the usable edge is. It also comes free
 * of the 820px gate — below it the panel overlays instead of insetting, the
 * padding is absent, and there is no narrower edge to aim at.
 *
 * Gated on the attribute so the common case is one attribute check per frame:
 * the computed-style read only happens on a page that actually has a rail up.
 * Mid-slide it returns the interpolated width, which is the right answer — the
 * label tracks the panel in rather than jumping when it lands.
 */
function reservedRightInset(): number {
  if (!document.body.hasAttribute(PANEL_INSET_ATTR)) return 0;
  return parseFloat(getComputedStyle(document.body).paddingInlineEnd) || 0;
}

export function useCursorTooltip(
  visible: boolean,
  docked = false,
  /** Hang it under this element instead of the cursor — see the note above. */
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
    // `offsetWidth` is the label at its natural width — read before writing,
    // and only ever compared against the usable edge, so this is one
    // measurement per frame that already had to touch layout, not a
    // read-write-read.
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

  // The prop is the truth about which mode this is; the ref is what `position`
  // reads inside a rAF. Kept in step here, and repositioned on the way past so
  // an anchor that changes while the label is up follows it.
  useEffect(() => {
    anchorRef.current = anchor ?? null;
    // Never while docked: that placement is the stylesheet's, and an inline
    // `left`/`top` written here would outrank the rule that centres it — the
    // very thing the effect above clears. It runs first, so this would undo it.
    if (visible && !docked) position();
  }, [anchor, visible, docked, position]);

  // An anchor is a box in the PAGE and the label is fixed to the viewport, so
  // everything that moves the page under it has to move the label with it.
  // Scroll in the capture phase, because the scroller is some ancestor of the
  // anchor rather than the window and a scroll event does not bubble.
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
      // A self-playing demo drags by dispatching this very event at its OWN
      // stand-in cursor. This tooltip belongs to whatever the REAL pointer is
      // resting on — a Replay control the visitor has just pressed, say — so
      // following the show would tear the label off the thing it names.
      if (isSyntheticPointer(event)) return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      // An anchored label is placed from its element, not from here — but the
      // pointer is still RECORDED, because the anchor can be taken away while
      // the label is up (deselecting the tile it hangs under) and the box then
      // has to have somewhere current to go. Tracked and not followed.
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
      // A trigger with no anchor of its own takes the label off the last one:
      // moving from an anchored trigger to a plain one otherwise leaves the
      // box hanging under the element the pointer has already left.
      anchorRef.current = null;
      position();
    },
    [position],
  );

  /** `seed`'s twin for the anchored mode — see the note at the top. */
  const seedAnchor = useCallback(
    (element: HTMLElement) => {
      anchorRef.current = element;
      position();
    },
    [position],
  );

  return { ref, seed, seedAnchor };
}
