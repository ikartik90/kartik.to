"use client";

import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { css } from "../../styled-system/css";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

// The control names and pictures the theme it OFFERS, never the one in force:
// it is a door, and a door is labelled with the room on the other side.
// "theme", the word the command palette has always used for the same act —
// one action the site names one way, wherever it is reached from.
const OFFER = {
  light: "Switch to light theme",
  dark: "Switch to dark theme",
} as const;

// Both glyphs ship on every render and the cascade picks between them, so the
// right one is there in the first painted frame — the theme is already on
// <html> by then, written by the blocking script in the document head. Choosing
// in JS instead would mean waiting for the mount `useThemeToggle` waits for,
// and showing the wrong glyph until it came.
const glyphForDark = css({ display: "block", _dark: { display: "none" } });
const glyphForLight = css({ display: "none", _dark: { display: "block" } });

export function ThemeToggle() {
  const { isDark, toggle } = useThemeToggle();
  const label = isDark ? OFFER.light : OFFER.dark;

  return (
    <div data-theme-toggle>
      <Button variant="icon" aria-label={label} onClick={toggle}>
        <DarkIcon className={glyphForDark} data-theme-glyph="dark" />
        <LightIcon className={glyphForLight} data-theme-glyph="light" />
        <Button.Tooltip>
          <Tooltip.Text>{label}</Tooltip.Text>
        </Button.Tooltip>
      </Button>
    </div>
  );
}
