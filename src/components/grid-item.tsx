"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { css } from "../../styled-system/css";
import { GridInsertRail } from "@/components/grid-insert-rail";
import { GridItemToolbar } from "@/components/grid-item-toolbar";
import { gridItemVars } from "@/utils/grid-item-vars";
import { nearerInsertSide } from "@/utils/grid-insert-side";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";

// A wrapper because a link card is an <a>, and the toolbar's buttons cannot nest inside it.
export interface GridItemProps {
  aspect: DemoFrameAspectRatio;
  span?: number;
  editing: boolean;
  pinned: boolean;
  canMoveBack: boolean;
  canMoveForward: boolean;
  onTogglePin: () => void;
  onMoveBack: () => void;
  onMoveForward: () => void;
  canAddColumn: boolean;
  canRemoveColumn: boolean;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onAspectChange: (aspect: DemoFrameAspectRatio) => void;
  propertiesOpen: boolean;
  onToggleProperties: () => void;
  onUnpublish?: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  /** Names the card in the insertion controls' accessible labels. */
  label: string;
  /** Rings this card as the one that just moved. */
  moved?: boolean;
  children: ReactNode;
}

const cellStyle = css({
  position: "relative",

  display: "flex",
  flexDirection: "column",

  // Outline, not border, so the ring costs no layout.
  "&[data-moved]": {
    borderRadius: "lg",
    outlineWidth: "token(spacing.xs)",
    outlineStyle: "solid",
    outlineColor: "border.focusRing",
  },

  // A minimum, not `aspect-ratio`: on a narrow screen a demo can need more than its shape.
  minHeight: "var(--aspect-height, 0px)",
  // The hover/focus reveal lives in globals.css: Panda emits no rule for a mid-selector `&`.
});

/** Publishes the cell's rendered height as `--card-height` for the grid's row-span arithmetic. */
function useCardHeight(cell: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = cell.current;
    if (!node) return;

    const publish = () => {
      // Up, never down, or the card overruns the row given to the next one.
      const height = Math.ceil(node.getBoundingClientRect().height);
      // A measured zero (hidden tab, unmounted grid) must not overwrite a real height.
      if (height > 0) node.style.setProperty("--card-height", `${height}px`);
    };

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    publish();

    return () => observer.disconnect();
  }, [cell]);
}

/** Publishes the gutter nearest the cursor as `data-near-side`; DOM, not state, so a move never re-renders. */
function useNearSide(editing: boolean) {
  const track = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const cell = event.currentTarget;
    const side = nearerInsertSide(
      event.clientX,
      cell.getBoundingClientRect(),
    );
    if (cell.dataset.nearSide !== side) cell.dataset.nearSide = side;
  }, []);

  const clear = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.nearSide;
  }, []);

  return editing
    ? { onPointerMove: track, onPointerLeave: clear }
    : undefined;
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
  const nearSide = useNearSide(editing);

  return (
    <div
      ref={cellRef}
      className={cellStyle}
      data-grid-cell
      style={gridItemVars(aspect, span)}
      data-moved={moved ? "" : undefined}
      {...nearSide}
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
