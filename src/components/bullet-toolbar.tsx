"use client";

import { menuIcon, selectionPopover } from "../../styled-system/recipes";
import { Popover, type PopoverRect } from "@/components/menu/popover";
import { Menu } from "@/components/menu/menu";
import ContinueBulletingIcon from "@/assets/icons/continue-bulleting.svg";
import ResetBulletingIcon from "@/assets/icons/reset-bulleting.svg";
import BulletedListIcon from "@/assets/icons/bulleted-list.svg";
import CheckedListIcon from "@/assets/icons/checked-list.svg";
import CrossedListIcon from "@/assets/icons/crossed-list.svg";

// ---------------------------------------------------------------------------
// Bullet styles — the default dot, or a per-item check / cross glyph.
// ---------------------------------------------------------------------------

export type BulletStyle = "dot" | "check" | "cross";

interface BulletToolbarProps {
  /** Viewport-relative rect of the clicked bullet marker. */
  rect: PopoverRect;
  /** The clicked item's current bullet style (drives the selected state). */
  style: BulletStyle;
  onSelect: (style: BulletStyle) => void;
  /** Carry the previous bulleted list's style forward onto this run. */
  onContinue: () => void;
  /** Reset this run back to the default dot bullet. */
  onReset: () => void;
  onDismiss: () => void;
}

const iconStyle = menuIcon();
const toolbarClass = selectionPopover({ align: "start" });
// Pairs with the selectionPopover recipe's `position-anchor`.
const selectionAnchor = "--selection-popover";

const OPTIONS: {
  style: BulletStyle;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}[] = [
  { style: "dot", label: "Bulleted list", Icon: BulletedListIcon },
  { style: "check", label: "Checked list", Icon: CheckedListIcon },
  { style: "cross", label: "Crossed list", Icon: CrossedListIcon },
];

export function BulletToolbar({
  rect,
  style,
  onSelect,
  onContinue,
  onReset,
  onDismiss,
}: BulletToolbarProps) {
  return (
    <Popover
      rect={rect}
      anchorName={selectionAnchor}
      className={toolbarClass}
      role="toolbar"
      ariaLabel="List bullet options"
      dismissOnReflow
      onDismiss={onDismiss}
    >
      <Menu.Toolbar>
        <Menu.Button
          ariaLabel="Continue bullets from previous list"
          onClick={onContinue}
        >
          <ContinueBulletingIcon className={iconStyle} aria-hidden />
        </Menu.Button>
        <Menu.Button
          ariaLabel="Reset bullets to the default style"
          onClick={onReset}
        >
          <ResetBulletingIcon className={iconStyle} aria-hidden />
        </Menu.Button>
        <Menu.Group>
          {OPTIONS.map(({ style: optStyle, label, Icon }) => (
            <Menu.Button
              key={optStyle}
              ariaLabel={label}
              pressed={style === optStyle}
              onClick={() => onSelect(optStyle)}
            >
              <Icon className={iconStyle} aria-hidden />
            </Menu.Button>
          ))}
        </Menu.Group>
      </Menu.Toolbar>
    </Popover>
  );
}
