"use client";

import { css } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import AddIcon from "@/assets/icons/add.svg";

// ---------------------------------------------------------------------------
// The insertion point between two grid cards (Figma 974:1866 / 974:1873): a
// hairline down the gutter with an add button on it.
//
// It sits in the GUTTER rather than on the card, and is placed off the gutter's
// own width instead of a measured offset: a 28px button centred in the gap
// starts at half the gap plus half the button outside the card's edge, which at
// the design's 32px gutter is the 30px the frame states. Written as that
// expression so the rail follows the grid if the gutter ever changes, and so
// the two numbers cannot be corrected apart.
//
// That does set a floor on the gutter — below 28px the button is wider than the
// space it centres in and starts overlapping the cards either side. The grid's
// `--grid-gap` is 32px, which is where the design put it.
// ---------------------------------------------------------------------------

export interface GridInsertRailProps {
  /**
   * Which edge of the card this rail hugs. Both cards either side of a gutter
   * carry one, so the two overlap — the grid decides which is reachable by only
   * rendering the rails of the card being hovered.
   */
  side: "before" | "after";
  /**
   * The button's accessible name, and it must say WHERE. A grid in edit mode
   * shows two of these per card, so a name that is only "Add" tells a screen
   * reader nothing about which gap is about to be filled.
   */
  label: string;
  onInsert: () => void;
}

const railStyle = css({
  position: "absolute",
  insetBlock: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "token(sizes.toolbarButton)",
  // Half the gutter plus half the button, so the rail's centre line lands on
  // the gutter's centre line.
  "--rail-offset":
    "calc(-1 * (var(--grid-gap) + token(sizes.toolbarButton)) / 2)",
  "&[data-side='before']": { insetInlineStart: "var(--rail-offset)" },
  "&[data-side='after']": { insetInlineEnd: "var(--rail-offset)" },
  zIndex: 1,
});

// `border.divider`, not the frame's flat neutral-500. The export carries no
// layer opacity, so the solid stroke in it may or may not be what the eye was
// meant to get; the token is what every other rule in the app is drawn with,
// and a line that is uniquely darker here would read as the odd one out.
const ruleStyle = css({
  flex: "1 1 0",
  width: "token(spacing.xxs)",
  backgroundColor: "border.divider",
});

const iconStyle = menuIcon();

export function GridInsertRail({ side, label, onInsert }: GridInsertRailProps) {
  return (
    <div className={railStyle} data-side={side} data-grid-controls>
      <span className={ruleStyle} aria-hidden="true" />
      {/* The hover fill is translucent and the button sits in the gutter with
          cards either side, so you read straight through it. `data-grid-rail-add`
          hangs a backdrop blur off it in globals.css — `css()` will not take the
          raw `backdrop-filter` key, and Panda's utility emits only the -webkit-
          form, which Chromium ignores. */}
      <Button aria-label={label} data-grid-rail-add onClick={onInsert}>
        <AddIcon className={iconStyle} />
      </Button>
      <span className={ruleStyle} aria-hidden="true" />
    </div>
  );
}
