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
import ContinueBulletingIcon from "@/assets/icons/continue-bulleting.svg";
import ResetBulletingIcon from "@/assets/icons/reset-bulleting.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import CheckedListIcon from "@/assets/icons/checked-list.svg";
import CrossedListIcon from "@/assets/icons/crossed-list.svg";

// ---------------------------------------------------------------------------
// Bullet styles — the default dot, or a per-item check / cross glyph.
// ---------------------------------------------------------------------------

export type BulletStyle = "dot" | "check" | "cross";

interface BulletPopoverProps {
  /** Viewport-relative rect of the clicked bullet marker. */
  rect: SelectionPopoverRect;
  /** The clicked item's current bullet style (drives the selected state). */
  style: BulletStyle;
  onSelect: (style: BulletStyle) => void;
  /** Carry the previous bulleted list's style forward onto this run. */
  onContinue: () => void;
  /** Reset this run back to the default dot bullet. */
  onReset: () => void;
  onDismiss: () => void;
}

const itemStyle = selectionPopoverItem();
const dividerStyle = selectionPopoverDivider();
const iconStyle = menuIcon();

const OPTIONS: {
  style: BulletStyle;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}[] = [
  { style: "dot", label: "Bulleted list", Icon: BulletedListIcon },
  { style: "check", label: "Checked list", Icon: CheckedListIcon },
  { style: "cross", label: "Crossed list", Icon: CrossedListIcon },
];

export function BulletPopover({
  rect,
  style,
  onSelect,
  onContinue,
  onReset,
  onDismiss,
}: BulletPopoverProps) {
  return (
    <SelectionPopover
      rect={rect}
      align="start"
      ariaLabel="List bullet options"
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <button
        type="button"
        className={itemStyle}
        aria-label="Continue bullets from previous list"
        onMouseDown={preserveSelection}
        onClick={onContinue}
      >
        <ContinueBulletingIcon className={iconStyle} aria-hidden />
      </button>
      <button
        type="button"
        className={itemStyle}
        aria-label="Reset bullets to the default style"
        onMouseDown={preserveSelection}
        onClick={onReset}
      >
        <ResetBulletingIcon className={iconStyle} aria-hidden />
      </button>
      <span className={dividerStyle} aria-hidden />
      {OPTIONS.map(({ style: optStyle, label, Icon }) => {
        const active = style === optStyle;
        return (
          <button
            key={optStyle}
            type="button"
            className={itemStyle}
            aria-label={label}
            aria-pressed={active}
            data-active={active ? "true" : undefined}
            onMouseDown={preserveSelection}
            onClick={() => onSelect(optStyle)}
          >
            <Icon className={iconStyle} aria-hidden />
          </button>
        );
      })}
    </SelectionPopover>
  );
}
