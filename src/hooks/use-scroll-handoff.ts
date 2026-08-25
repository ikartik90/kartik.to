"use client";

import { useEffect, type RefObject } from "react";
import { resolveHandoff, type ScrollBox } from "@/utils/scroll-handoff";

// ---------------------------------------------------------------------------
// useScrollHandoff — let a wheel this box cannot use travel outward.
//
// Put it on any EMBEDDED scroller: an option list, the docked panel, a log
// pane. Reaching the end of one is not meant to be the end of scrolling, and
// the browser's own chaining does not cover it (see `scroll-handoff.ts` — a
// continuous gesture is latched to the box that first consumed it, so the rest
// of a flick is dropped).
//
// Do NOT put it on a modal surface. Those declare the edge instead, and the
// walk stops there — a scroller says it in CSS with `overscroll-behavior`
// (which the browser honours too, so there is one rule and not two), and a
// floating shell that clips rather than scrolls says it with
// {@link SCROLL_BOUNDARY_ATTR}, because `overscroll-behavior` is defined only
// on scroll containers and would be inert on a popover.
//
// The listener is on the element, not the document: a non-passive `wheel`
// listener costs the browser its fast scrolling path wherever it is attached,
// and that price is worth paying over a 200px list, not over the whole page.
// ---------------------------------------------------------------------------

/**
 * Marks a surface the scroll must not escape — set by the `Dialog` and
 * `Popover` shells, which clip rather than scroll and so cannot say it in CSS.
 */
export const SCROLL_BOUNDARY_ATTR = "data-scroll-boundary";

/** The same marker, ready to spread onto the surface's element. */
export const scrollBoundary = { [SCROLL_BOUNDARY_ATTR]: "" } as const;

/** A line of a line-mode wheel, in pixels. Firefox on a mouse reports these. */
const LINE_HEIGHT = 16;

/** `overscroll-behavior` values that mean "the scroll stops at me". */
const SEALED = new Set(["contain", "none"]);

function isScrollContainer(style: CSSStyleDeclaration): boolean {
  return (
    style.overflowY === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowY === "overlay"
  );
}

function isSealed(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  // The longhand, because that is the axis being scrolled: a surface written
  // `overscroll-behavior: contain auto` seals sideways only.
  return (
    el.hasAttribute(SCROLL_BOUNDARY_ATTR) ||
    SEALED.has(style.overscrollBehaviorY)
  );
}

function readBox(el: HTMLElement): ScrollBox {
  const style = getComputedStyle(el);
  return {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    // The viewport's scroller scrolls whatever its `overflow` computes to —
    // an untouched `<html>` says `visible` and still takes the page's wheel.
    scrollable: isScrollContainer(style) || el === document.scrollingElement,
    sealed: isSealed(el, style),
  };
}

/**
 * `el` and, above it, every ancestor with something to say about where a wheel
 * goes: the scroll containers that could take it, and the sealed surfaces that
 * end the walk. Innermost first, ending at the page.
 *
 * The page's own scroller is appended rather than tested for, because the
 * viewport scrolls whether or not its CSS says `overflow`. On this site the
 * walk has usually collected `<body>` already (Panda's preflight makes it the
 * scroll container); where it has not, `document.scrollingElement` is the
 * browser's own answer to which element the page scrolls on.
 */
function scrollChainFrom(el: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [el];
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (isScrollContainer(style) || isSealed(node, style)) chain.push(node);
  }
  const page = document.scrollingElement;
  if (page instanceof HTMLElement && !chain.includes(page)) chain.push(page);
  return chain;
}

/** The wheel's travel in pixels, whatever units it arrived in. */
function pixelDelta(event: WheelEvent, el: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * LINE_HEIGHT;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * el.clientHeight;
  }
  return event.deltaY;
}

export function useScrollHandoff(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      // A pinch is a zoom the browser owns, and a sideways gesture belongs to
      // whatever scrolls across — neither is ours to redirect.
      if (event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const delta = pixelDelta(event, el);
      if (delta === 0) return;

      const chain = scrollChainFrom(el);
      const index = resolveHandoff(chain.map(readBox), delta);
      // 0 is never returned — it would mean handing the box its own wheel back
      // — so anything below 1 is "leave this to the browser".
      if (index < 1) return;

      event.preventDefault();
      chain[index].scrollTop += delta;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [ref]);
}
