"use client";

import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
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
  /**
   * Whether the grid's one properties panel is currently showing THIS card.
   * The panel is a single docked surface shared by every cell, so which card
   * has it is the grid's state rather than the cell's.
   */
  propertiesOpen: boolean;
  onToggleProperties: () => void;
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

  // A column, so the card can be told to fill the cell without a percentage
  // height — and so the cell measures the card when the card is the taller of
  // the two, which is the point of the whole arrangement.
  display: "flex",
  flexDirection: "column",

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

  // The cell states its own shape, and has to: the grid places items with
  // `align-self: start`, which sizes an item to its content rather than to the
  // rows it spans, and the controls that float over the cell are out of flow.
  // Without this a cell holding a short card measures that card and the shape
  // it was given means nothing.
  //
  // A MINIMUM height, not `aspect-ratio`. The shape is what the card is given
  // if it fits; it is not a ceiling. A demo frame stops shrinking with its
  // width at its own content's height plus its padding, so on a narrow screen
  // a card is regularly taller than its shape — `aspect-ratio` states an exact
  // height and left the frame to overflow it, which is how a demo needing
  // 717px came to be cut off inside a 233px card on a phone. `--aspect-height`
  // is that same shape at the width the card landed at, handed down by
  // `masonryGrid` from the very variables the row span is computed from, so
  // the reserved space and the drawn box cannot disagree.
  minHeight: "var(--aspect-height, 0px)",

  // The controls are hidden until hover / keyboard focus. Those two rules live
  // in globals.css against `[data-grid-cell]`, not here: Panda emits a class
  // for a selector with `&` in the MIDDLE (`html[…] &:focus-within …`) but no
  // rule to go with it, so the keyboard half silently did nothing.
});

/**
 * Publish the height the cell actually took, for the grid to reserve rows for.
 *
 * The grid packs cards into 1px rows and states each card's span in CSS, so it
 * needs the card's height as a number — and a rendered height is the one thing
 * CSS cannot be asked for. Hence a measurement, written back as a custom
 * property the span arithmetic reads (`--card-height`), rather than as a span
 * this would have to compute itself: the shape's height is still CSS's to work
 * out, and a span set from here would be a second, staler copy of it that also
 * had to know the gutter.
 *
 * Writing to the observed element does not restart the observer: the only
 * thing `--card-height` feeds is `grid-row`, and the grid sizes these items
 * with `align-self: start`, so the rows a card is given never change how tall
 * it is.
 */
function useCardHeight(cell: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = cell.current;
    if (!node) return;

    const publish = () => {
      // Up, never down: the span is a whole number of 1px rows, so a card of
      // 233.33px rounded down is one that finishes in a row the grid gave to
      // whatever packs in beneath it.
      const height = Math.ceil(node.getBoundingClientRect().height);
      // Nothing to say until there is a layout. A measured zero — an unmounted
      // grid, a hidden tab — would otherwise overwrite a real height with one
      // that loses every `max()` it is put into.
      if (height > 0) node.style.setProperty("--card-height", `${height}px`);
    };

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    publish();

    return () => observer.disconnect();
  }, [cell]);
}

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
  propertiesOpen,
  onToggleProperties,
  onUnpublish,
  onInsertBefore,
  onInsertAfter,
  label,
  moved,
  children,
}: GridItemProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  useCardHeight(cellRef);

  return (
    <div
      ref={cellRef}
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
            propertiesOpen={propertiesOpen}
            onToggleProperties={onToggleProperties}
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
