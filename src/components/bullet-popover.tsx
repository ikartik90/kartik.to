"use client";

import { menuIcon, selectionPopoverItem } from "../../styled-system/recipes";
import {
  SelectionPopover,
  preserveSelection,
  type SelectionPopoverRect,
} from "@/components/selection-popover";
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
  onDismiss: () => void;
}

const itemStyle = selectionPopoverItem();
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
