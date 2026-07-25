"use client";

import { menuIcon, selectionPopover } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/ui/popover";
import { Menu } from "@/components/menu/menu";
import type { ListMarkerStyle } from "@/utils/list-numbering";
import ContinueNumberingIcon from "@/assets/icons/continue-numbering.svg";
import ResetNumberingIcon from "@/assets/icons/reset-numbering.svg";
import AlphabetedListIcon from "@/assets/icons/alphabeted-list.svg";
import NumberedListIcon from "@/assets/icons/numbered-list.svg";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NumberToolbarProps {
  /** Viewport-relative rect of the clicked ordinal marker. */
  rect: PopoverRect;
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

const iconStyle = menuIcon();
const toolbarClass = selectionPopover({ align: "start" });
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NumberToolbar({
  rect,
  marker,
  continueActive,
  onContinue,
  onReset,
  onSwapStyle,
  onDismiss,
}: NumberToolbarProps) {
  const isAlpha = marker === "alpha";
  const SwapIcon = isAlpha ? NumberedListIcon : AlphabetedListIcon;
  const swapLabel = isAlpha
    ? "Switch to numbered list"
    : "Switch to lettered list";

  return (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      role="toolbar"
      ariaLabel="List numbering options"
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <Menu.Toolbar>
        <Menu.Button
          ariaLabel="Continue numbering from previous list"
          pressed={continueActive}
          onClick={onContinue}
        >
          <ContinueNumberingIcon className={iconStyle} aria-hidden />
        </Menu.Button>
        <Menu.Button
          ariaLabel="Reset numbering at this item"
          onClick={onReset}
        >
          <ResetNumberingIcon className={iconStyle} aria-hidden />
        </Menu.Button>
        <Menu.Group>
          <Menu.Button ariaLabel={swapLabel} onClick={onSwapStyle}>
            <SwapIcon className={iconStyle} aria-hidden />
          </Menu.Button>
        </Menu.Group>
      </Menu.Toolbar>
    </Popover>
  );
}
