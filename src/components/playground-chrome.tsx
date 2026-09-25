"use client";

import { css } from "../../styled-system/css";
import { MenuButton } from "@/components/menu-button";
import { ScrimBlur } from "@/components/scrim-blur";
import { ThemeToggleButton } from "@/components/theme-toggle";

// Its height comes from the page's `--chrome-band`; the page reserves that room itself.
const CHROME_BAND = "var(--chrome-band, token(spacing.5xl))";

const SCRIM_CLEARANCE = "token(spacing.3xl)";

// Two boxes: a fixed box measures against the viewport, so the inner one takes the space left of the rail.
const chromeStyle = css({
  position: "fixed",
  insetBlockStart: 0,
  insetInlineStart: 0,
  height: `calc(${CHROME_BAND} + ${SCRIM_CLEARANCE})`,
  backgroundImage:
    "linear-gradient(to bottom, token(colors.bg.canvas), transparent)",
  // The scrollport runs underneath, so the strip must not eat the wheel.
  pointerEvents: "none",
  zIndex: 1,
  insetInlineEnd: "var(--page-inset-end, 0px)",
  // Matches the 200ms ease-out globals.css moves the page by.
  transition: "inset-inline-end 200ms ease-out",
});

const chromeRowStyle = css({
  // Positioned so it paints above the band's absolutely positioned frosting.
  position: "relative",
  zIndex: 1,
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  marginInline: "auto",
  height: CHROME_BAND,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  _bottomSheet: { paddingBlockStart: "md" },
  "& > *": { pointerEvents: "auto" },
});

const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

export function PlaygroundChrome() {
  return (
    <div className={chromeStyle}>
      <ScrimBlur towards="bottom" />
      <div className={chromeRowStyle}>
        <MenuButton />

        <div className={chromeEndStyle}>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}
