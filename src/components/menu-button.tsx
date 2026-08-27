"use client";

import { css, cx } from "../../styled-system/css";
import { hotkey } from "../../styled-system/recipes";
import MenuIcon from "@/assets/icons/menu.svg";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { openCommandPalette } from "@/utils/command-palette-channel";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

// ---------------------------------------------------------------------------
// MenuButton — the one control every surface opens with.
//
// The home page has always had it; an article and the card studio used to have
// a back link in that same seat instead. They are one control now, because
// "back" is a command like any other and belongs in the palette with the rest
// of them — so the gutter offers the way IN to everything rather than the one
// way out.
//
// It brings no box of its own: where it SITS differs by surface (the home page
// and an article hang it off `[data-site-menu]`, the studio stands it in the
// band across the top of its canvas), and a component that positioned itself
// could only ever be right on one of them.
// ---------------------------------------------------------------------------

// The shortcut and the tooltip are the same button's label wearing two faces,
// and they are never both up. At rest the chip says how to reach the menu
// without the mouse; the moment a cursor arrives, the tooltip beside it says
// what the menu IS, and the chip that was answering the other question steps
// out of the way. `visibility` rather than `display` so the button never moves.
//
// Keyed off the TOOLTIP being up, not off `:hover`, and that is the whole of
// why they cannot both be on screen. They looked equivalent and were not: the
// tooltip is React state set from `mouseenter`/`mouseleave`, where `:hover` is
// the browser's own — recomputed on its own schedule, and sticky when the DOM
// changes under a pointer that has not moved. Two answers to "is the cursor
// here" is two answers, and the pair drifted apart on whichever events the two
// disagreed about. One fact now drives both faces.
//
// A HANDOVER, not a crossfade, and the asymmetry below is the whole of it.
// Both faces used to run the same 150ms ease-out in both directions, which
// meant they ran it AT THE SAME TIME: for the width of that fade the chip was
// half out while the tooltip was half in, and both were on screen — exactly
// what keying off one fact was supposed to prevent. One fact was never enough
// on its own; the two faces also have to take their turns.
//
// So the chip CUTS on the way out (`0s`, no delay) — gone on the frame the
// tooltip starts arriving — and waits a full fade before coming back. CSS
// takes a transition's duration and delay from the state being moved TO, so
// each direction reads its own: entering, the `[data-tooltip-visible]` branch's
// zeroes; leaving, the base's `150ms` delay and then its `150ms` fade. The
// delay is the tooltip's own fade-out duration — if that changes, this moves
// with it, or the chip lands back under a tooltip still on its way out.
//
// `visibility` is what makes the wait airtight rather than merely faint: a
// delayed transition holds the START value throughout the delay, so the chip is
// `hidden` — unpainted, unhittable — for the whole of the tooltip's exit, and
// flips to `visible` only as its own fade begins.
//
// Both faces are cursor-first by nature — `_hasCursor` withholds the chip from
// a device with no key to press, exactly as hover withholds the tooltip from a
// device with no pointer to reveal it. A touch visitor gets the icon and its
// accessible name, which is all that is true for them.
const shortcutStyle = css({
  display: "none",
  _hasCursor: { display: "flex" },
  transitionProperty: "opacity, visibility",
  transitionDuration: "150ms",
  transitionDelay: "150ms",
  transitionTimingFunction: "ease-out",
  "button[data-tooltip-visible] ~ &": {
    opacity: 0,
    visibility: "hidden",
    transitionDuration: "0s",
    transitionDelay: "0s",
  },
});

// Measured from the chip's BOX, which the icon button already pads by 4px
// around its 20px glyph — so the gap the eye reads is this plus that. The
// shortcut belongs to the button beside it and has to sit close enough to be
// read as its label rather than as the next thing along.
const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
});

export function MenuButton() {
  // The chip names the key this visitor's keyboard actually has — ⌘K on Apple
  // hardware, Ctrl K on a PC — which is the same shortcut the palette listens
  // for on each.
  const shortcut = useShortcutLabel("K");

  return (
    <div className={rowStyle}>
      <Button variant="icon" aria-label="Menu" onClick={openCommandPalette}>
        <MenuIcon />
        <Button.Tooltip>
          <Tooltip.Text>Menu</Tooltip.Text>
        </Button.Tooltip>
      </Button>
      <kbd className={cx(hotkey(), shortcutStyle)} data-site-menu-shortcut>
        {shortcut}
      </kbd>
    </div>
  );
}
