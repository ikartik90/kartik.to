"use client";

import { css, cx } from "../../styled-system/css";
import { hotkey } from "../../styled-system/recipes";
import MenuIcon from "@/assets/icons/menu.svg";
import { useShortcutLabel } from "@/hooks/use-shortcut-label";
import { openCommandPalette } from "@/utils/command-palette-channel";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

// Hidden while the tooltip is up, keyed off its state rather than :hover. The 150ms return delay
// must match the tooltip's fade-out, or the chip lands back under it.
const shortcutStyle = css({
  display: "none",
  _hasCursor: { display: "flex" },
  transitionProperty: "opacity, visibility",
  transitionDuration: "150ms",
  transitionDelay: "150ms",
  transitionTimingFunction: "ease-out",
  "button[data-tooltip-visible] ~ &": {
    opacity: 0,
    visibility: "hidden",
    transitionDuration: "0s",
    transitionDelay: "0s",
  },
});

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
});

export function MenuButton() {
  const shortcut = useShortcutLabel("K");

  return (
    <div className={rowStyle}>
      <Button variant="icon" aria-label="Menu" onClick={openCommandPalette}>
        <MenuIcon />
        <Button.Tooltip>
          <Tooltip.Text>Menu</Tooltip.Text>
        </Button.Tooltip>
      </Button>
      <kbd className={cx(hotkey(), shortcutStyle)} data-site-menu-shortcut>
        {shortcut}
      </kbd>
    </div>
  );
}
