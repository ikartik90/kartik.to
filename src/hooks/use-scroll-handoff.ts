"use client";

import { useEffect, type RefObject } from "react";
import { resolveHandoff, type ScrollBox } from "@/utils/scroll-handoff";

// Hands a wheel an embedded scroller can't use to its ancestors; not for modal surfaces.
// Attached per element, since a non-passive wheel listener costs the fast scroll path.

/** Marks a clipping surface the scroll must not escape (`overscroll-behavior` is inert there). */
export const SCROLL_BOUNDARY_ATTR = "data-scroll-boundary";

export const scrollBoundary = { [SCROLL_BOUNDARY_ATTR]: "" } as const;

/** A line of a line-mode wheel, in pixels. Firefox on a mouse reports these. */
const LINE_HEIGHT = 16;

const SEALED = new Set(["contain", "none"]);

function isScrollContainer(style: CSSStyleDeclaration): boolean {
  return (
    style.overflowY === "auto" ||
    style.overflowY === "scroll" ||
    style.overflowY === "overlay"
  );
}

function isSealed(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  // The Y longhand: `contain auto` seals sideways only.
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
    // The viewport scroller scrolls even when its overflow computes to `visible`.
    scrollable: isScrollContainer(style) || el === document.scrollingElement,
    sealed: isSealed(el, style),
  };
}

/** `el` and every scrolling or sealed ancestor, innermost first, ending at the page scroller. */
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
      // Pinch-zoom and sideways gestures aren't ours to redirect.
      if (event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const delta = pixelDelta(event, el);
      if (delta === 0) return;

      const chain = scrollChainFrom(el);
      const index = resolveHandoff(chain.map(readBox), delta);
      // Below 1 means leave it to the browser.
      if (index < 1) return;

      event.preventDefault();
      chain[index].scrollTop += delta;
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [ref]);
}
