"use client";

import { css } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Button } from "@/components/ui/button";
import AddIcon from "@/assets/icons/add.svg";

export interface GridInsertRailProps {
  /** The card edge this rail hugs. */
  side: "before" | "after";
  /** Must name the gap it fills: a card carries two rails. */
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
  // Centres the rail on the gutter; a gutter narrower than the button overhangs the cards.
  "--rail-offset":
    "calc(-1 * (var(--grid-gap) + token(sizes.toolbarButton)) / 2)",
  "&[data-side='before']": { insetInlineStart: "var(--rail-offset)" },
  "&[data-side='after']": { insetInlineEnd: "var(--rail-offset)" },
  zIndex: 1,
});

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
      {/* The backdrop blur hangs off `data-grid-rail-add` in globals.css: css() can't emit `backdrop-filter`. */}
      <Button aria-label={label} data-grid-rail-add onClick={onInsert}>
        <AddIcon className={iconStyle} />
      </Button>
      <span className={ruleStyle} aria-hidden="true" />
    </div>
  );
}
