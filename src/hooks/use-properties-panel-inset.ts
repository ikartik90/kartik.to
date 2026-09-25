"use client";

import { useLayoutEffect } from "react";

// Marks <body> while a docked (fixed) properties panel is open; globals.css turns the mark into the page inset.

/** The attribute globals.css keys the inset off. */
export const PANEL_INSET_ATTR = "data-properties-panel";

/** The attribute that takes the inset's 200ms slide off, for one frame. */
export const PANEL_INSET_INSTANT_ATTR = "data-properties-panel-instant";

/** On a page's root while its panel is open, so the server HTML is already inset. */
export const PANEL_RESERVED_ATTR = "data-properties-panel-reserved";

/** Matches the 500ms input window the layout-shift metric forgives. */
const INPUT_WINDOW = 500;

let lastInput = -Infinity;
let listening = false;

// Runs at module load, since the press that opens a panel lands before the panel mounts.
function watchInput(): void {
  if (listening || typeof document === "undefined") return;
  listening = true;

  const mark = () => (lastInput = performance.now());
  // Capture, so a stopped event still counts.
  for (const type of ["pointerdown", "keydown"])
    document.addEventListener(type, mark, { capture: true, passive: true });
}

watchInput();

// Counted, so one panel closing doesn't clear another's inset.
let claims = 0;

interface InsetOptions {
  /**
   * False only for a panel that arrives with the content it insets, where sliding the
   * padding walks the page (CLS). A reader's own opens always slide.
   */
  animate?: boolean;
}

/**
 * Reserves the docked panel's width while `active` (its live state, not whether it is
 * mounted). A layout effect, so the inset lands before the panel first paints.
 */
export function usePropertiesPanelInset(
  active: boolean,
  { animate = true }: InsetOptions = {},
): void {
  useLayoutEffect(() => {
    if (!active) return;

    claims += 1;
    const { body } = document;
    const instant = !animate && performance.now() - lastInput > INPUT_WINDOW;
    // Instant mark first, so the padding never resolves with the transition on.
    if (instant) body.setAttribute(PANEL_INSET_INSTANT_ATTR, "");
    body.setAttribute(PANEL_INSET_ATTR, "");

    const frame = instant
      ? requestAnimationFrame(() =>
          body.removeAttribute(PANEL_INSET_INSTANT_ATTR),
        )
      : null;

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      body.removeAttribute(PANEL_INSET_INSTANT_ATTR);
      claims -= 1;
      if (claims === 0) body.removeAttribute(PANEL_INSET_ATTR);
    };
  }, [active, animate]);
}
