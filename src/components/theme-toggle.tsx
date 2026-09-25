"use client";

import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { css } from "../../styled-system/css";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

// Names the theme it offers, not the one in force. The command palette reads this too.
export const OFFER = {
  light: "Light theme",
  dark: "Dark theme",
} as const;

// Both glyphs render and CSS picks, so the right one shows before hydration.
const glyphForDark = css({ display: "block", _dark: { display: "none" } });
const glyphForLight = css({ display: "none", _dark: { display: "block" } });

/** The bare control, for consumers that place it themselves. */
export function ThemeToggleButton() {
  const { isDark, toggle } = useThemeToggle();
  const label = isDark ? OFFER.light : OFFER.dark;

  return (
    <Button variant="icon" aria-label={label} onClick={toggle}>
      <DarkIcon className={glyphForDark} data-theme-glyph="dark" />
      <LightIcon className={glyphForLight} data-theme-glyph="light" />
      <Button.Tooltip>
        <Tooltip.Text>{label}</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );
}

/** In the `[data-theme-toggle]` slot that globals.css positions. */
export function ThemeToggle() {
  return (
    <div data-theme-toggle>
      <ThemeToggleButton />
    </div>
  );
}
