"use client";

import {
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { css } from "../../../../styled-system/css";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { Tooltip, TooltipHostContext } from "@/components/ui/tooltip";
import type { IconViewSettings } from "@/domain/icon";
import { selectionAfterClick, type Rect } from "./icon-selection";
import { IconTile, iconWellStyle } from "./icon-tile";
import type { IconEntry } from "./use-icon-library";

// ---------------------------------------------------------------------------
// The sheet of marks: what you are pointing at, and what you have taken.
//
// TAKING. A press takes one icon and lets go of the rest; shift makes it
// additive; a drag sweeps a band and takes everything it touches. What each
// gesture MEANS is `icon-selection`, which is pure.
//
// Only the PRESS is here. The sweep belongs to `use-icon-marquee`, because it
// is listened for on the page's whole canvas rather than on this column —
// a hand reaching into the room beside the set is still reaching for the set.
// This file draws the band (`MarqueeBand`) but does not own it; what it owns
// of the gesture is `consumeSweep`, the flag that stops the click ending a
// drag from undoing the drag.
//
// POINTING. ONE tooltip for the whole grid rather than one per tile — the set
// runs to a couple of hundred icons, and a tooltip is a portalled node with a
// hook behind it, so per-tile would be two hundred hidden boxes in the body
// to keep one visible. The grid holds the hover and the label moves.
//
// WHERE the label is drawn depends on whether the icon is taken:
//
//   hovering    at the cursor, trailing it like every other tooltip on the
//               site. Nothing else on screen says which tile you mean, so the
//               label has to be where you are looking.
//
//   selected    hung two pixels under the tile. A taken tile is already marked
//               — the brand wash and the mark in brand ink — so a label
//               chasing the pointer would be answering a question the tile has
//               already answered, and answering it in the wrong place.
//
// Both placements are `useCursorTooltip`'s; this only chooses. The anchor is
// derived from the CURRENT selection rather than latched when the hover
// opened, so pressing the tile you are pointing at moves the label under it on
// the spot instead of on the next hover.
// ---------------------------------------------------------------------------

// The column the set is read as, centred in the canvas the band is drawn on.
//
// A size CONTAINER, so the grid inside lays itself out against the room it
// actually has rather than against the window: the two differ by the docked
// panel's width, and the ten-across rule below would otherwise be true only
// while the panel was away.
//
// The cap lives HERE rather than on the canvas, which is the whole point of
// the split — the canvas runs edge to edge so a sweep can start anywhere in
// it, while the icons stay in a column narrow enough to read.
const columnStyle = css({
  containerType: "inline-size",
  containerName: "iconSheet",
  marginInline: "auto",
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
});

// As many cells as fit, each at least a cell wide and sharing the surplus.
// `auto-fill` rather than `auto-fit`, so a set of three does not stretch three
// cells across a desktop and draw the icons a hand's width apart.
const gridStyle = css({
  display: "grid",
  gap: "sm",
  justifyItems: "stretch",

  // Narrow: as many as fit, each no smaller than the drawing's band plus the
  // tile's own inline padding.
  gridTemplateColumns:
    "repeat(auto-fill, minmax(calc(var(--icon-well) + 2 * token(spacing.md)), 1fr))",

  // A full column: TEN across, which is the sheet the set is read as. 960 is
  // the site's own column (`sizes.articleShowcase`), so this is the grid at
  // its full width rather than an arbitrary breakpoint — a tenth of it, gaps
  // taken off first.
  //
  // Still `auto-fill` over a minimum rather than a flat `repeat(10, …)`,
  // because the drawing has to fit in what a tenth leaves: at 4× on a 24 grid
  // an icon is 96px and a tenth of 960 is 92, so the `max()` hands those rows
  // back to the number that DOES fit instead of letting neighbours collide.
  // At every size and zoom below that the tenth wins, which is ten across.
  "@container iconSheet (min-width: 960px)": {
    gridTemplateColumns:
      "repeat(auto-fill, minmax(max(calc(var(--icon-draw) + 2 * token(spacing.md)), calc((token(spacing.full) - 9 * token(spacing.sm)) / 10)), 1fr))",
  },
});

// The band itself, in the same brand pair a taken tile wears — it is the same
// claim being made, in the act of making it.
const marqueeStyle = css({
  position: "absolute",
  zIndex: 1,
  borderRadius: "xs",
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "text.highlight",
  backgroundColor: "bg.highlight",
  // It is a drawing of the gesture, never a target for it.
  pointerEvents: "none",
});

/**
 * The icon the pointer is on.
 *
 * `visible` is separate from the hint being null so the label keeps its text
 * while it fades out — cleared on leave, it would empty and collapse in front
 * of you rather than dissolve.
 */
interface IconHint {
  key: string;
  label: string;
  element: HTMLElement;
  visible: boolean;
}

export interface IconGridProps {
  entries: IconEntry[];
  settings: IconViewSettings;
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  /** Whether the author is looking — the only person a held icon is marked for. */
  showsReview: boolean;
  /**
   * Whether the click now arriving is the tail of a sweep — see
   * `use-icon-marquee`. Spent by asking, so a press may only ask once.
   */
  consumeSweep: () => boolean;
  /** True while a band is being drawn: no label follows a drag. */
  sweeping: boolean;
}

export function IconGrid({
  entries,
  settings,
  selection,
  onSelectionChange,
  showsReview,
  consumeSweep,
  sweeping,
}: IconGridProps) {
  const [hint, setHint] = useState<IconHint | null>(null);

  // Read against the LIVE selection, so the label moves under a tile the
  // moment it is taken rather than waiting for the pointer to leave and come
  // back. Null while the icon is merely hovered, which is the cursor mode.
  const anchor = hint && selection.includes(hint.key) ? hint.element : null;

  const { ref, seed, seedAnchor } = useCursorTooltip(
    Boolean(hint?.visible),
    false,
    anchor,
  );

  // A finger never opens the label: the tap is over before it lands, nothing
  // on a touchscreen corresponds to leaving, and the name it carries is
  // already the tile's own text. The same gate `useActionTooltip` keeps, and
  // per EVENT rather than per device — a laptop with a touchscreen answers
  // `(hover: hover)` truthfully for its trackpad.
  const openHint = (entry: IconEntry, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const element = event.currentTarget;

    // Seeded from the handler so the label opens in place. It matters most
    // moving between two selected tiles, where the box is already at full
    // opacity and would otherwise be seen at the old tile for a frame.
    if (selection.includes(entry.icon.key)) seedAnchor(element);
    else seed(event.clientX, event.clientY);

    setHint({
      key: entry.icon.key,
      label: entry.icon.title,
      element,
      visible: true,
    });
  };

  const closeHint = () =>
    setHint((current) => (current ? { ...current, visible: false } : null));

  const pressTile = (entry: IconEntry, event: ReactMouseEvent<HTMLElement>) => {
    // The click that follows a sweep is the sweep's own pointer coming up,
    // not a press: it would take the one icon under it and drop everything
    // the band had just gathered.
    if (consumeSweep()) return;
    onSelectionChange(
      selectionAfterClick(
        selection,
        entry.icon.key,
        // Shift is what was asked for; the platform's own modifier comes
        // along because that is what the hand reaches for on a grid.
        event.shiftKey || event.metaKey || event.ctrlKey,
      ),
    );
  };

  return (
    <>
      <div className={columnStyle}>
        <div className={gridStyle} style={iconWellStyle(settings)}>
          {entries.map((entry) => (
            <IconTile
              key={entry.icon.key}
              entry={entry}
              settings={settings}
              selected={selection.includes(entry.icon.key)}
              onPress={(event) => pressTile(entry, event)}
              onPointerEnter={(event) => openHint(entry, event)}
              onPointerLeave={closeHint}
              showsReview={showsReview}
            />
          ))}
        </div>

      </div>

      {/* The label. Fed by context rather than by props because that is the
          seam `Tooltip` has — it carries no position or visibility of its own,
          and a host supplies both (see `Button.Tooltip`, which is the same
          arrangement with the host being one button rather than a grid). */}
      <TooltipHostContext.Provider value={{ ref, visible: Boolean(hint?.visible) && !sweeping }}>
        <Tooltip>
          <Tooltip.Text>{hint?.label ?? ""}</Tooltip.Text>
        </Tooltip>
      </TooltipHostContext.Provider>
    </>
  );
}

/** Arithmetic over a live gesture, so it cannot be a Panda class. */
function bandStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

/**
 * The sweep, drawn. It lives on the canvas rather than in the column above,
 * because the canvas is what the gesture is measured against — a band that
 * began in the margin has coordinates the column could not place.
 */
export function MarqueeBand({ rect }: { rect: Rect }) {
  return (
    <div
      data-icon-marquee
      className={marqueeStyle}
      style={bandStyle(rect)}
      aria-hidden
    />
  );
}
