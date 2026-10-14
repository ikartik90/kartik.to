"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { css, cx } from "../../../../styled-system/css";
import { IconDrawing } from "@/components/icon-drawing";
import type { IconViewSettings } from "@/domain/icon";
import type { IconEntry } from "./use-icon-library";

const tileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Allowed below its content width, or a 4× drawing pushes over the next column.
  width: "token(spacing.full)",
  minWidth: 0,
  padding: "md",
  borderRadius: "lg",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "solid",
  borderColor: "transparent",
  backgroundColor: "transparent",
  cursor: "pointer",
  color: "text.default",
  focusVisibleRing: "outside",
  transition: "background-color 120ms ease-out, color 120ms ease-out",

  // Scoped: a bare `_hover` ties with the selected rule and would win by emit order.
  "&[aria-pressed='false']:hover": { backgroundColor: "bg.itemHover" },

  "&[aria-pressed='true']": {
    backgroundColor: "bg.highlight",
    color: "text.highlight",
  },

  "&[data-held]": {
    borderStyle: "dashed",
    borderColor: "border.divider",
  },
});

const wellStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "token(spacing.full)",
  height: "var(--icon-well)",
});

const srOnlyStyle = css({ srOnly: true });

const brokenStyle = css({
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  borderRadius: "sm",
  borderWidth: "token(spacing.xxs)",
  borderStyle: "dashed",
  borderColor: "border.divider",
});

export interface IconTileProps {
  entry: IconEntry;
  settings: IconViewSettings;
  selected: boolean;
  onPress: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerEnter?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: () => void;
  /** The author is looking; held icons are marked only for them. */
  showsReview: boolean;
}

export function IconTile({
  entry,
  settings,
  selected,
  onPress,
  onPointerEnter,
  onPointerLeave,
  showsReview,
}: IconTileProps) {
  const { icon, svg } = entry;
  const held = showsReview && icon.review === "held";
  const drawn = settings.size * settings.zoom;

  return (
    <button
      type="button"
      className={tileStyle}
      aria-pressed={selected}
      data-held={held || undefined}
      // The marquee collects tiles by this attribute and reads the key off it.
      data-icon-tile={icon.key}
      onClick={onPress}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className={wellStyle}>
        {svg === undefined ? (
          null
        ) : svg ? (
          <IconDrawing svg={svg} settings={settings} size={drawn} data-icon-drawing />
        ) : (
          <span className={cx(brokenStyle)} data-icon-broken aria-hidden />
        )}
      </span>

      {/* Hidden text, not `aria-label`: browsers add their own hover hint to an aria-label-only control. */}
      <span className={srOnlyStyle}>
        {[icon.name, `${icon.native} grid`, held ? "held for review" : null]
          .filter(Boolean)
          .join(", ")}
      </span>
    </button>
  );
}

/** The `--icon-draw` and `--icon-well` lengths the grid lays out against. */
export function iconWellStyle(settings: IconViewSettings): CSSProperties {
  const drawn = settings.size * settings.zoom;
  return {
    "--icon-draw": `${drawn}px`,
    "--icon-well": `max(80px, ${drawn + 32}px)`,
  } as CSSProperties;
}
