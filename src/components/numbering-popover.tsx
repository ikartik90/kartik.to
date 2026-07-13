"use client";

import {
  menuIcon,
  selectionPopoverDivider,
  selectionPopoverItem,
} from "../../styled-system/recipes";
import {
  SelectionPopover,
  preserveSelection,
  type SelectionPopoverRect,
} from "@/components/selection-popover";
import type { ListMarkerStyle } from "@/utils/list-numbering";
import ContinueNumberingIcon from "@/assets/icons/continue-numbering.svg";
import ResetNumberingIcon from "@/assets/icons/reset-numbering.svg";
import AlphabetedListIcon from "@/assets/icons/alphabeted-list.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NumberingPopoverProps {
  /** Viewport-relative rect of the clicked ordinal marker. */
  rect: SelectionPopoverRect;
  /** Current run style — decides whether the swap button offers a→z or 1→n. */
  marker: ListMarkerStyle;
  /** Whether "continue numbering" is currently on for this run. */
  continueActive: boolean;
  onContinue: () => void;
  onReset: () => void;
  onSwapStyle: () => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const itemStyle = selectionPopoverItem();
const dividerStyle = selectionPopoverDivider();
const iconStyle = menuIcon();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NumberingPopover({
  rect,
  marker,
  continueActive,
  onContinue,
  onReset,
  onSwapStyle,
  onDismiss,
}: NumberingPopoverProps) {
  const isAlpha = marker === "alpha";
  const SwapIcon = isAlpha ? NumberedListIcon : AlphabetedListIcon;
  const swapLabel = isAlpha
    ? "Switch to numbered list"
    : "Switch to lettered list";

  return (
    <SelectionPopover
      rect={rect}
      align="start"
      ariaLabel="List numbering options"
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <button
        type="button"
        className={itemStyle}
        aria-label="Continue numbering from previous list"
        aria-pressed={continueActive}
        data-active={continueActive ? "true" : undefined}
        onMouseDown={preserveSelection}
        onClick={onContinue}
      >
        <ContinueNumberingIcon className={iconStyle} aria-hidden />
      </button>
      <button
        type="button"
        className={itemStyle}
        aria-label="Reset numbering at this item"
        onMouseDown={preserveSelection}
        onClick={onReset}
      >
        <ResetNumberingIcon className={iconStyle} aria-hidden />
      </button>
      <span className={dividerStyle} aria-hidden />
      <button
        type="button"
        className={itemStyle}
        aria-label={swapLabel}
        onMouseDown={preserveSelection}
        onClick={onSwapStyle}
      >
        <SwapIcon className={iconStyle} aria-hidden />
      </button>
    </SelectionPopover>
  );
}
