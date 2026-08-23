"use client";

import type { ReactNode } from "react";
import { css } from "../../styled-system/css";
import { GridInsertRail } from "@/components/grid-insert-rail";
import { GridItemToolbar } from "@/components/grid-item-toolbar";
import { gridItemVars } from "@/utils/grid-item-vars";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// ---------------------------------------------------------------------------
// One cell of the homepage grid: the card, and — while editing — the controls
// that place it.
//
// This exists as a wrapper rather than being folded into the cards themselves
// for a reason the markup forces: the toolbar is made of buttons, a link card
// is an `<a>`, and a `<button>` inside an `<a>` is invalid HTML that browsers
// un-nest at parse time. The card cannot host its own controls. So the cell
// takes the placement variables and the card simply fills it.
//
// It also means the two kinds of card — a link and a live component — get their
// controls from one place instead of each growing a copy.
// ---------------------------------------------------------------------------

export interface GridItemProps {
  aspect: DemoFrameAspectRatio;
  span?: number;
  /** Controls are mounted only in edit mode; nothing is rendered otherwise. */
  editing: boolean;
  pinned: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
  onTogglePin: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  /** Whether the card has room to get wider, or is already down to one column. */
  canAddColumn: boolean;
  canRemoveColumn: boolean;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onAspectChange: (aspect: DemoFrameAspectRatio) => void;
  /** Components only — see `GridItemToolbar`. */
  onUnpublish?: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  /** Names the card in the insertion controls' accessible labels. */
  label: string;
  /**
   * Ring this card as the one that just moved.
   *
   * A move changes a card's position, and in a masonry of near-identical tiles
   * that is very easy to lose: the thing you pressed a button about is now
   * somewhere else on screen. The ring says which one it went to.
   */
  moved?: boolean;
  children: ReactNode;
}

const cellStyle = css({
  position: "relative",

  // The ring for a card that has just been moved. `outline` rather than a
  // border so it costs no layout — a border would resize the cell and shift
  // every card after it, which is the opposite of what a "here it is" marker
  // should do. Flush to the card's edge, and radiused to match it.
  "&[data-moved]": {
    borderRadius: "lg",
    outlineWidth: "token(spacing.xs)",
    outlineStyle: "solid",
    outlineColor: "border.focusRing",
  },

  // The cell states its own shape, and has to. Everything inside it is
  // positioned — the card fills it, the controls float over it — so it has no
  // content to take a height from, and the grid places items with
  // `align-self: start`, which sizes an item to its content rather than to the
  // rows it spans. Without this the cell measures zero and the whole grid
  // renders as a blank page. Read from the same two variables the row span was
  // computed from, so the reserved space and the drawn box cannot disagree.
  aspectRatio: "var(--aspect-w) / var(--aspect-h)",

  // The controls are hidden until hover / keyboard focus. Those two rules live
  // in globals.css against `[data-grid-cell]`, not here: Panda emits a class
  // for a selector with `&` in the MIDDLE (`html[…] &:focus-within …`) but no
  // rule to go with it, so the keyboard half silently did nothing.
});

export function GridItem({
  aspect,
  span,
  editing,
  pinned,
  canMoveBack,
  canMoveForward,
  onTogglePin,
  onMoveBack,
  onMoveForward,
  canAddColumn,
  canRemoveColumn,
  onAddColumn,
  onRemoveColumn,
  onAspectChange,
  onUnpublish,
  onInsertBefore,
  onInsertAfter,
  label,
  moved,
  children,
}: GridItemProps) {
  return (
    <div
      className={cellStyle}
      data-grid-cell
      style={gridItemVars(aspect, span)}
      data-moved={moved ? "" : undefined}
    >
      {children}
      {editing && (
        <>
          <GridInsertRail
            side="before"
            label={`Add before ${label}`}
            onInsert={onInsertBefore}
          />
          <GridItemToolbar
            pinned={pinned}
            canMoveBack={canMoveBack}
            canMoveForward={canMoveForward}
            canAddColumn={canAddColumn}
            canRemoveColumn={canRemoveColumn}
            onTogglePin={onTogglePin}
            onMoveBack={onMoveBack}
            onMoveForward={onMoveForward}
            onAddColumn={onAddColumn}
            onRemoveColumn={onRemoveColumn}
            aspect={aspect}
            onAspectChange={onAspectChange}
            onUnpublish={onUnpublish}
          />
          <GridInsertRail
            side="after"
            label={`Add after ${label}`}
            onInsert={onInsertAfter}
          />
        </>
      )}
    </div>
  );
}
