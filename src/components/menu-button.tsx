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
// out of the way. `visibility` rather than `display` so the button never moves,
// on the tooltip's own 150ms ease-out so one hands over to the other.
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
  transitionTimingFunction: "ease-out",
  "button:hover ~ &": {
    opacity: 0,
    visibility: "hidden",
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
