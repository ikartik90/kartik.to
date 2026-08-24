"use client";

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// The page's own inset while a properties panel is docked.
//
// The panel is `position: fixed` at the viewport's edge, which means it takes
// no space: left alone it lies OVER whatever it is inspecting. Making room is
// therefore the page's job, not the panel's, and this is the one bit of state
// the two share — a mark on <body> that globals.css turns into the inset.
//
// A mark rather than a measured width, and on the BODY rather than on each
// consumer, because the answer has to be the same everywhere the panel can
// open: the collection's media inspector, the grid's card inspector, the card
// studio's rail. A consumer that reserved the width itself would be a fourth
// place for it to be reserved slightly differently.
// ---------------------------------------------------------------------------

/** The attribute globals.css keys the inset off. */
export const PANEL_INSET_ATTR = "data-properties-panel";

/**
 * How many panels are currently asking for the inset.
 *
 * Counted rather than set-and-cleared: the mark is ONE bit of global state with
 * more than one possible claimant, and a panel closing while another is still
 * open would otherwise clear the inset out from under it. Module scope is the
 * right scope for it — the thing being counted is the document's, not any one
 * React tree's.
 */
let claims = 0;

/**
 * Reserve the docked panel's width on the page for as long as `active`.
 *
 * Pass the panel's LIVE state, not its mounted-ness: a panel that has been
 * dismissed is still on screen for the length of its slide, and the page should
 * be reclaiming the width across those same 200ms rather than snapping open
 * once the node has gone.
 */
export function usePropertiesPanelInset(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    claims += 1;
    document.body.setAttribute(PANEL_INSET_ATTR, "");

    return () => {
      claims -= 1;
      if (claims === 0) document.body.removeAttribute(PANEL_INSET_ATTR);
    };
  }, [active]);
}
